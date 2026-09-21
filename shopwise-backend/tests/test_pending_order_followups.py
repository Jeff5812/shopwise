"""
Pending-order hardening: while an order waits on the customer's yes/no, confirm and cancel keep
working, and every other reply (correction, question, casual, ambiguous) is handled WITHOUT losing,
duplicating or auto-confirming the pending order.

These drive the real webhook (main.receive_message) and the real pending_order_handler. Mocked
boundaries: Gemini (pending_understanding's output: intent + ops), WhatsApp send, and the Supabase layer,
which is an in-memory fake that reproduces replace_order_items_with_stock's semantics (restock old
lines, check + reserve new ones, recalc total, refuse non-awaiting orders, all-or-nothing). The real
SQL function was exercised against the live DB inside a rolled-back transaction.
"""
import asyncio
import json
import time
import pytest
from unittest.mock import MagicMock

import main
import pending_order_handler as poh
import pending_understanding as pu
from db import InsufficientStockError, OrderNotEditableError

BASE_STOCK = {
    "v-candle": 20, "v-gown-m-blue": 5, "v-gown-m-red": 3, "v-gown-42-blue": 2, "v-soap": 50,
}


def _catalog(stock):
    return [
        {"product_id": "p-candle", "name": "Lavender Candle", "sell_price": 2500, "floor_price": 2000,
         "variants": [{"variant_id": "v-candle", "size": None, "color": None, "stock_quantity": stock["v-candle"]}]},
        {"product_id": "p-gown", "name": "Ankara Gown", "sell_price": 15000, "floor_price": 12000,
         "variants": [
             {"variant_id": "v-gown-m-blue", "size": "M", "color": "blue", "stock_quantity": stock["v-gown-m-blue"]},
             {"variant_id": "v-gown-m-red", "size": "M", "color": "red", "stock_quantity": stock["v-gown-m-red"]},
             {"variant_id": "v-gown-42-blue", "size": "42", "color": "blue", "stock_quantity": stock["v-gown-42-blue"]},
         ]},
        {"product_id": "p-soap", "name": "Shea Soap", "sell_price": 1200, "floor_price": 1000,
         "variants": [{"variant_id": "v-soap", "size": None, "color": None, "stock_quantity": stock["v-soap"]}]},
    ]


PRICES = {"v-candle": 2500, "v-gown-m-blue": 15000, "v-gown-m-red": 15000, "v-gown-42-blue": 15000, "v-soap": 1200}


def _body(text):
    return {"entry": [{"changes": [{"value": {
        "metadata": {"phone_number_id": "PN"},
        "messages": [{"id": "wamid.1", "from": "2348000000000", "text": {"body": text}}],
    }}]}]}


class _Req:
    def __init__(self, body): self._b = body
    async def json(self): return self._b


@pytest.fixture
def env(monkeypatch):
    st = {
        "stock": dict(BASE_STOCK),
        "order": {"id": "o1", "status": "awaiting_confirmation", "total_amount": 0},
        "items": [],
        "replies": [], "review": [], "classified": [], "payments": [], "canceled": [], "marked_pending": [],
        "replace_calls": [], "action": "other", "understanding": {}, "understand_error": None,
        "faq": {"answered": False, "reply": None}, "orders_created": 0,
    }
    customer = {"id": "c1", "wa_id": "2348000000000", "email": "buyer@mail.com"}

    def start_order(*lines):
        """lines: (variant_id, qty). Reserves stock like create_order_with_stock would."""
        st["items"] = [{"product_variant_id": v, "quantity": q, "unit_price": PRICES[v]} for v, q in lines]
        for v, q in lines:
            st["stock"][v] -= q
        st["order"]["total_amount"] = sum(PRICES[v] * q for v, q in lines)
    st["start_order"] = start_order

    def fake_replace(order_id, items):
        assert order_id == st["order"]["id"], "correction must target the existing pending order"
        if st["order"]["status"] != "awaiting_confirmation":
            raise OrderNotEditableError("order_not_editable")
        stock = dict(st["stock"])
        for r in st["items"]:
            stock[r["product_variant_id"]] += r["quantity"]
        for i in items:
            if stock[i["variant_id"]] < i["quantity"]:
                raise InsufficientStockError("insufficient_stock")   # nothing mutated: all-or-nothing
            stock[i["variant_id"]] -= i["quantity"]
        st["stock"] = stock
        st["items"] = [{"product_variant_id": i["variant_id"], "quantity": i["quantity"],
                        "unit_price": i["unit_price"]} for i in items]
        st["order"]["total_amount"] = sum(i["quantity"] * i["unit_price"] for i in items)
        st["replace_calls"].append(items)
        return dict(st["order"])

    def fake_understand(text, pending_order, vendor, customer, message_id=None):
        if st["understand_error"]:
            raise st["understand_error"]
        u = {"action": st["action"], "confidence": 0.95, "ops": [], "also_question": False, "note": None}
        u.update(st["understanding"])
        return u

    async def reply(vendor_id, customer_id, wa_id, body):
        st["replies"].append(body)

    async def pay(order_id, email):
        st["payments"].append((order_id, email))
        return "https://paystack.test/checkout"

    def create_order_tripwire(*a, **k):
        st["orders_created"] += 1
        raise AssertionError("a follow-up must never create a second order")

    m = monkeypatch.setattr
    # webhook plumbing (main)
    m(main, "message_already_processed", lambda i: False)
    m(main, "get_or_create_vendor", lambda p: {"id": "v1"})
    m(main, "get_or_create_customer", lambda v, w: customer)
    m(main, "log_message", lambda **k: {"id": "m1"})
    m(main, "get_conversation_history", lambda *a, **k: [])
    m(main, "get_order_awaiting_email", lambda v, c: None)
    m(main, "get_pending_order",
      lambda v, c: dict(st["order"]) if st["order"]["status"] == "awaiting_confirmation" else None)
    m(main, "understand_pending_order", fake_understand)
    m(main, "update_message_classification", lambda mid, intent, conf: st["classified"].append(intent))
    m(main, "add_to_review_queue", lambda mid, reason: st["review"].append(reason))
    m(main, "mark_pending_payment", lambda oid: st["marked_pending"].append(oid) or st["order"].update(status="pending_payment"))
    m(main, "cancel_order", lambda oid: st["canceled"].append(oid) or st["order"].update(status="canceled"))
    m(main, "create_order", create_order_tripwire)
    m(main, "reply_and_log", reply)
    m(main, "create_payment_for_order", pay)
    m(main, "PAYSTACK_DEFAULT_EMAIL", "default@shopwise.test")
    # handler dependencies
    m(poh, "get_vendor_catalog", lambda vid: _catalog(st["stock"]))
    m(poh, "get_order_items", lambda oid: list(st["items"]))
    m(poh, "replace_order_items", fake_replace)
    m(poh, "get_faq_snippets", lambda vid: [])
    m(poh, "generate_faq_answer", lambda text, snippets: st["faq"])
    m(poh, "generate_order_confirmation",
      lambda items, total: "Updated: " + ", ".join(f"{i['quantity']} x {i['product_name']}" for i in items)
                           + f" = N{total:.0f}. Shall I confirm this for you?")
    m(poh, "add_to_review_queue", lambda mid, reason: st["review"].append(reason))
    m(poh, "update_message_classification", lambda mid, intent, conf: st["classified"].append(intent))
    return st


def run(text):
    return asyncio.run(main.receive_message(_Req(_body(text))))


def assert_pending_preserved(st, total=None, item_qty=None):
    """The invariant after ANY non-confirm/cancel interaction."""
    assert st["order"]["id"] == "o1"
    assert st["order"]["status"] == "awaiting_confirmation", "order must still be waiting, not confirmed/canceled"
    assert st["payments"] == [] and st["marked_pending"] == [], "must not enter the payment flow"
    assert st["canceled"] == [], "must not be canceled"
    assert st["orders_created"] == 0, "must not create a second order"
    if total is not None:
        assert st["order"]["total_amount"] == total
    if item_qty is not None:
        assert {r["product_variant_id"]: r["quantity"] for r in st["items"]} == item_qty


REMINDER = poh.PENDING_REMINDER


# ---- 1. CONFIRMATION: existing payment flow untouched ---------------------------------------
def test_confirm_still_goes_to_payment_flow(env):
    env["start_order"](("v-candle", 1))
    env["action"] = "confirm"
    result = run("yes")
    assert result["status"] == "order_pending_payment"
    assert env["marked_pending"] == ["o1"]
    assert env["payments"] == [("o1", "buyer@mail.com")]
    assert any("paystack.test/checkout" in r for r in env["replies"])


# ---- 2. CANCELLATION: existing cancel flow untouched ----------------------------------------
def test_cancel_still_cancels(env):
    env["start_order"](("v-candle", 1))
    env["action"] = "cancel"
    result = run("forget it")
    assert result["status"] == "order_canceled"
    assert env["canceled"] == ["o1"]
    assert env["payments"] == []


# ---- ops helpers -------------------------------------------------------------------------------
def SET(v, q): return {"op": "set_quantity", "variant_id": v, "quantity": q}
def ADD(v, q): return {"op": "add_item", "variant_id": v, "quantity": q}
def REMOVE(v): return {"op": "remove_item", "variant_id": v}
def SWAP(a, b): return {"op": "swap_variant", "from_variant_id": a, "to_variant_id": b}


def correct(env, *ops, conf=0.95, note=None, also_question=False):
    env["action"] = "correct"
    env["understanding"] = {"ops": list(ops), "confidence": conf, "note": note, "also_question": also_question}


# ---- 3. CORRECTION: quantity ----------------------------------------------------------------
def test_quantity_correction_edits_same_order_and_reasks(env):
    env["start_order"](("v-candle", 1))
    correct(env, SET("v-candle", 2))
    result = run("actually make it 2")
    assert result["status"] == "pending_order_corrected"
    assert_pending_preserved(env, total=5000, item_qty={"v-candle": 2})
    assert env["stock"]["v-candle"] == 18, "stock: 1 restocked, 2 reserved"
    assert "2 x Lavender Candle" in env["replies"][-1] and "N5000" in env["replies"][-1]
    assert "confirm" in env["replies"][-1].lower(), "must ask for confirmation again"


def test_quantity_can_go_down_and_up_in_one_atomic_step(env):
    env["start_order"](("v-candle", 2))
    correct(env, SET("v-candle", 3))
    run("make it 3")
    assert_pending_preserved(env, total=7500, item_qty={"v-candle": 3})
    assert env["stock"]["v-candle"] == 17


def test_add_item_on_an_existing_line_adds_to_its_quantity(env):
    """'give me another one' -> add_item of the same variant: 1 + 1 = 2."""
    env["start_order"](("v-candle", 1))
    correct(env, ADD("v-candle", 1))
    run("give me another one")
    assert_pending_preserved(env, total=5000, item_qty={"v-candle": 2})


def test_add_a_new_item(env):
    env["start_order"](("v-candle", 1))
    correct(env, ADD("v-soap", 2))
    run("add 2 soaps")
    assert_pending_preserved(env, total=4900, item_qty={"v-candle": 1, "v-soap": 2})


# ---- 3b. CORRECTION: variant / color ----------------------------------------------------------
def test_variant_swap_keeps_quantity_and_uses_catalog_price(env):
    env["start_order"](("v-gown-m-blue", 2))
    correct(env, SWAP("v-gown-m-blue", "v-gown-m-red"))
    result = run("make them red instead")
    assert result["status"] == "pending_order_corrected"
    assert_pending_preserved(env, total=30000, item_qty={"v-gown-m-red": 2})
    assert env["items"][0]["unit_price"] == 15000, "price comes from the catalog, never from the AI"
    assert env["stock"]["v-gown-m-blue"] == 5 and env["stock"]["v-gown-m-red"] == 1
    assert "Ankara Gown (M, red)" in env["replies"][-1]


def test_a_change_only_touches_the_lines_it_names(env):
    env["start_order"](("v-candle", 1), ("v-gown-m-red", 1), ("v-soap", 1))
    correct(env, SET("v-soap", 3))
    run("make the soap 3")
    assert_pending_preserved(env, total=2500 + 15000 + 3600, item_qty={"v-candle": 1, "v-gown-m-red": 1, "v-soap": 3})


def test_remove_one_line_keeps_the_rest(env):
    env["start_order"](("v-candle", 1), ("v-soap", 2))
    correct(env, REMOVE("v-candle"))
    run("remove the candle")
    assert_pending_preserved(env, total=2400, item_qty={"v-soap": 2})
    assert env["stock"]["v-candle"] == 20, "candle restocked"


def test_several_ops_in_one_message_apply_together(env):
    env["start_order"](("v-gown-m-red", 1), ("v-gown-42-blue", 1))
    correct(env, SWAP("v-gown-m-red", "v-gown-m-blue"), SET("v-gown-42-blue", 2))
    run("make the first one blue and the second 2")
    assert_pending_preserved(env, total=45000, item_qty={"v-gown-m-blue": 1, "v-gown-42-blue": 2})


def test_removing_everything_never_auto_cancels(env):
    env["start_order"](("v-candle", 1))
    correct(env, REMOVE("v-candle"))
    result = run("remove the candle")
    assert result["status"] == "pending_order_correction_would_empty"
    assert_pending_preserved(env, total=2500, item_qty={"v-candle": 1})
    assert env["replace_calls"] == []
    assert "cancel" in env["replies"][-1].lower()


def test_correction_that_changes_nothing_skips_the_database(env):
    env["start_order"](("v-candle", 1))
    correct(env, SET("v-candle", 1))
    result = run("make it 1")
    assert result["status"] == "pending_order_correction_no_change"
    assert env["replace_calls"] == []
    assert_pending_preserved(env, total=2500)


# ---- 3c. CORRECTION: ambiguous / unsafe -> ask, flag, preserve --------------------------------
def test_low_confidence_correction_asks_and_flags_without_touching_order(env):
    env["start_order"](("v-candle", 1), ("v-soap", 1))
    correct(env, SET("v-candle", 2), conf=0.4, note="Do you want 2 candles or 2 soaps?")
    result = run("make it 2")
    assert result["status"] == "pending_order_correction_unclear"
    assert env["review"] == ["unparseable"] and env["replace_calls"] == []
    assert "Do you want 2 candles or 2 soaps?" in env["replies"][-1] and REMINDER in env["replies"][-1]
    assert_pending_preserved(env, total=3700, item_qty={"v-candle": 1, "v-soap": 1})


def test_modify_with_no_ops_asks_instead_of_guessing(env):
    env["start_order"](("v-candle", 1))
    correct(env, note="What would you like to change?")
    assert run("change it")["status"] == "pending_order_correction_unclear"
    assert env["replace_calls"] == []
    assert_pending_preserved(env, total=2500)


@pytest.mark.parametrize("bad_ops", [
    [ADD("v-does-not-exist", 1)],                          # unknown variant
    [SET("v-soap", 2)],                                    # line not in the order
    [REMOVE("v-soap")],                                    # line not in the order
    [SWAP("v-candle", "v-gown-m-red")],                    # swap across different products
    [SWAP("v-candle", "v-candle")],                        # swap to itself
    [SWAP("v-candle", "v-gone")],                          # swap to unknown variant
    [SET("v-candle", 0)], [SET("v-candle", -2)], [SET("v-candle", 1.5)], [SET("v-candle", True)],
    [ADD("v-soap", 0)],
    [{"op": "set_quantity", "variant_id": "v-candle"}],    # missing field
    [{"op": "delete_everything"}],                         # unknown op
    ["not-a-dict"],
    [SET("v-candle", 2), REMOVE("v-soap")],                # first op fine, second bad: all-or-nothing
])
def test_invalid_ops_are_rejected_by_code_and_the_order_is_untouched(env, bad_ops):
    env["start_order"](("v-candle", 1))
    correct(env, *bad_ops)
    result = run("change it")
    assert result["status"] == "pending_order_correction_unclear"
    assert env["replace_calls"] == [] and env["review"] == ["unparseable"]
    assert_pending_preserved(env, total=2500, item_qty={"v-candle": 1})


def test_correction_beyond_stock_leaves_original_order_untouched(env):
    env["start_order"](("v-gown-m-red", 1))
    correct(env, SET("v-gown-m-red", 10))
    result = run("make it 10")
    assert result["status"] == "pending_order_correction_insufficient_stock"
    assert env["review"] == ["insufficient_stock"]
    assert_pending_preserved(env, total=15000, item_qty={"v-gown-m-red": 1})
    assert env["stock"]["v-gown-m-red"] == 2, "original reservation intact"


def test_order_that_moved_forward_meanwhile_is_not_rewritten(env, monkeypatch):
    env["start_order"](("v-candle", 1))
    correct(env, SET("v-candle", 2))

    def racing_replace(order_id, items):
        env["order"]["status"] = "pending_payment"   # paid/advanced between read and write
        raise OrderNotEditableError("order_not_editable: pending_payment")
    monkeypatch.setattr(poh, "replace_order_items", racing_replace)
    result = run("make it 2")
    assert result["status"] == "pending_order_not_editable"
    assert env["items"][0]["quantity"] == 1 and env["payments"] == []


def test_context_lookup_failure_asks_instead_of_crashing(env, monkeypatch):
    env["start_order"](("v-candle", 1))
    correct(env, SET("v-candle", 2))
    monkeypatch.setattr(poh, "get_order_items", lambda oid: (_ for _ in ()).throw(RuntimeError("supabase blip")))
    assert run("make it 2")["status"] == "pending_order_correction_unclear"
    assert_pending_preserved(env, total=2500)


# ---- compound: a change AND a question in one message -------------------------------------------
def test_change_plus_question_does_both_and_keeps_the_order_waiting(env):
    env["start_order"](("v-candle", 1))
    correct(env, SET("v-candle", 2), also_question=True)
    env["faq"] = {"answered": True, "reply": "Delivery to Lekki is N1500."}
    result = run("make it 2 and do you deliver to Lekki?")
    assert result["status"] == "pending_order_corrected"
    reply_text = env["replies"][-1]
    assert "2 x Lavender Candle" in reply_text and "Delivery to Lekki is N1500." in reply_text
    assert "confirm" in reply_text.lower()
    assert_pending_preserved(env, total=5000, item_qty={"v-candle": 2})


def test_change_plus_unanswerable_question_flags_the_question(env):
    env["start_order"](("v-candle", 1))
    correct(env, SET("v-candle", 2), also_question=True)
    env["faq"] = {"answered": False, "reply": None}
    run("make it 2 and can my brother collect it?")
    assert "passed your question on to the seller" in env["replies"][-1]
    assert env["review"] == ["unparseable"]
    assert_pending_preserved(env, total=5000, item_qty={"v-candle": 2})


# ---- 4. QUESTION / FAQ interruption -----------------------------------------------------------
def test_faq_question_is_answered_and_order_preserved(env):
    env["start_order"](("v-candle", 1))
    env["action"] = "question"
    env["faq"] = {"answered": True, "reply": "Delivery in Lekki is N1500."}
    result = run("do you deliver to Lekki?")
    assert result["status"] == "pending_order_question_answered"
    assert env["replies"][-1] == f"Delivery in Lekki is N1500. {REMINDER}"
    assert env["classified"][-1] == "question" and env["review"] == []
    assert_pending_preserved(env, total=2500, item_qty={"v-candle": 1})


def test_unanswerable_question_escalates_but_keeps_order(env):
    env["start_order"](("v-candle", 1))
    env["action"] = "question"
    env["faq"] = {"answered": False, "reply": None}
    result = run("can I pick it up?")
    assert result["status"] == "pending_order_question_escalated"
    assert env["review"] == ["unparseable"] and REMINDER in env["replies"][-1]
    assert_pending_preserved(env, total=2500, item_qty={"v-candle": 1})


# ---- 5. CASUAL --------------------------------------------------------------------------------
@pytest.mark.parametrize("text,opener", [("thanks", "You're welcome!"), ("hello", "Hi there!"), ("lol", "No problem!")])
def test_casual_message_gets_natural_reply_and_keeps_order(env, text, opener):
    env["start_order"](("v-candle", 1))
    env["action"] = "casual"
    result = run(text)
    assert result["status"] == "pending_order_casual"
    assert env["replies"][-1] == f"{opener} {REMINDER}"
    assert env["classified"][-1] == "noise" and env["review"] == []
    assert_pending_preserved(env, total=2500, item_qty={"v-candle": 1})


# ---- 6. AMBIGUOUS / RISKY ---------------------------------------------------------------------
def test_ambiguous_or_risky_message_flags_and_keeps_order(env):
    env["start_order"](("v-candle", 1))
    env["action"] = "other"
    result = run("abeg reduce am to 1000")
    assert result["status"] == "escalated_pending_order_unclear"
    assert env["review"] == ["unparseable"] and env["classified"][-1] == "unclassified"
    assert_pending_preserved(env, total=2500, item_qty={"v-candle": 1})


def test_unknown_action_string_is_treated_as_ambiguous(env):
    env["start_order"](("v-candle", 1))
    env["action"] = "totally-new-label"
    assert run("???")["status"] == "escalated_pending_order_unclear"
    assert_pending_preserved(env, total=2500)


def test_if_the_understanding_call_itself_fails_the_order_is_kept(env):
    """Gemini down / quota: main falls back to 'other' (ask + flag), never confirms or loses the order."""
    env["start_order"](("v-candle", 1))
    env["understand_error"] = RuntimeError("429 RESOURCE_EXHAUSTED")
    assert run("make it 2")["status"] == "escalated_pending_order_unclear"
    assert_pending_preserved(env, total=2500, item_qty={"v-candle": 1})


# ---- The order survives a whole conversation, then can still be confirmed ----------------------
def test_order_survives_question_correction_casual_then_confirms_normally(env):
    env["start_order"](("v-candle", 1))
    env["faq"] = {"answered": True, "reply": "Yes we deliver to Lekki."}
    env["action"] = "question"; run("do you deliver to Lekki?")
    correct(env, SET("v-candle", 2)); run("make it 2")
    env["understanding"] = {}; env["action"] = "casual"; run("thanks")
    assert_pending_preserved(env, total=5000, item_qty={"v-candle": 2})
    env["action"] = "confirm"
    assert run("yes")["status"] == "order_pending_payment"
    assert env["payments"] == [("o1", "buyer@mail.com")] and env["orders_created"] == 0


# ---- Unit: apply_ops (pure business rules) ---------------------------------------------------
INDEX = poh.variant_index(_catalog(BASE_STOCK))


def test_apply_ops_preserves_line_order_and_untouched_lines():
    current = {"v-candle": 1, "v-gown-m-red": 1, "v-soap": 1}
    out = poh.apply_ops(current, [SWAP("v-gown-m-red", "v-gown-m-blue")], INDEX)
    assert list(out.items()) == [("v-candle", 1), ("v-gown-m-blue", 1), ("v-soap", 1)]
    assert current == {"v-candle": 1, "v-gown-m-red": 1, "v-soap": 1}, "input is never mutated"


def test_apply_ops_swap_merges_into_an_existing_destination_line():
    out = poh.apply_ops({"v-gown-m-red": 1, "v-gown-m-blue": 2}, [SWAP("v-gown-m-red", "v-gown-m-blue")], INDEX)
    assert out == {"v-gown-m-blue": 3}


def test_apply_ops_later_ops_see_earlier_results():
    assert poh.apply_ops({"v-candle": 1}, [ADD("v-soap", 1), SET("v-soap", 4), REMOVE("v-candle")], INDEX) == {"v-soap": 4}


def test_apply_ops_raises_invalid_ops_for_anything_off():
    for ops in ([SET("v-soap", 1)], [ADD("nope", 1)], [SWAP("v-candle", "v-gown-m-red")], [{"op": "x"}], [{"op": "add_item"}]):
        with pytest.raises(poh.InvalidOps):
            poh.apply_ops({"v-candle": 1}, ops, INDEX)


def test_validate_revision_merges_duplicates_and_uses_catalog_prices():
    out = poh.validate_revision([{"variant_id": "v-candle", "quantity": 1}, {"variant_id": "v-candle", "quantity": 2},
                                 {"variant_id": "v-gown-m-blue", "quantity": 1, "unit_price": 1}], INDEX)
    assert {(i["variant_id"], i["quantity"], i["unit_price"]) for i in out} == {
        ("v-candle", 3, 2500), ("v-gown-m-blue", 1, 15000)}


# ---- Unit: pending_understanding (parsing, safety rules, context) ------------------------------
def _parse(**fields):
    base = {"intent": "modify_order", "ops": [], "also_question": False, "confidence": 0.9, "note": None}
    return pu.parse_understanding(json.dumps({**base, **fields}))


@pytest.mark.parametrize("intent,action", [
    ("confirm_order", "confirm"), ("cancel_order", "cancel"), ("modify_order", "correct"),
    ("ask_question", "question"), ("small_talk", "casual"), ("unknown", "other"), ("nonsense", "other"), (None, "other"),
])
def test_intents_map_to_the_actions_main_dispatches_on(intent, action):
    assert _parse(intent=intent, ops=[SET("v-candle", 2)] if action == "correct" else [])["action"] == action


@pytest.mark.parametrize("raw", ["not json", "", "[]", '"hi"', "{}", '{"intent": "confirm_order", "confidence": "high"}'])
def test_garbled_model_output_degrades_to_ask_and_flag(raw):
    out = pu.parse_understanding(raw)
    assert out["action"] == "other" and out["ops"] == [] and out["confidence"] == 0.0


def test_a_confirm_or_cancel_that_also_asks_something_becomes_a_question():
    """'yes, and how much is delivery?' must never start payment; 'no, ... ?' must never drop the order."""
    assert _parse(intent="confirm_order", also_question=True)["action"] == "question"
    assert _parse(intent="cancel_order", also_question=True)["action"] == "question"
    assert _parse(intent="small_talk", also_question=True)["action"] == "question"


def test_a_shaky_confirm_or_cancel_is_never_acted_on():
    assert _parse(intent="confirm_order", confidence=0.5)["action"] == "other"
    assert _parse(intent="cancel_order", confidence=0.5)["action"] == "other"
    assert _parse(intent="confirm_order", confidence=0.9)["action"] == "confirm"


def test_malformed_ops_zero_the_confidence_so_the_handler_asks():
    out = _parse(ops=[{"op": "set_quantity", "variant_id": "v-candle", "quantity": "2"}])
    assert out["action"] == "correct" and out["ops"] == [] and out["confidence"] == 0.0


def test_extra_fields_on_ops_are_dropped_so_the_model_cannot_smuggle_a_price():
    out = _parse(ops=[{"op": "set_quantity", "variant_id": "v-candle", "quantity": 2, "unit_price": 1}])
    assert out["ops"] == [SET("v-candle", 2)]


def test_also_question_only_survives_on_modify():
    assert _parse(ops=[SET("v-candle", 2)], also_question=True)["also_question"] is True
    assert _parse(intent="ask_question", also_question=True)["also_question"] is False


def _fake_client(monkeypatch, reply_json):
    seen = {}

    def gen(model, contents, config):
        seen.update(model=model, contents=contents, config=config)
        return MagicMock(text=json.dumps(reply_json))
    fake = MagicMock()
    fake.models.generate_content.side_effect = gen
    monkeypatch.setattr(pu, "client", fake)
    return seen


def _patch_context(monkeypatch, **overrides):
    ctx = dict(get_vendor_catalog=lambda vid: _catalog(BASE_STOCK),
               get_order_items=lambda oid: [{"product_variant_id": "v-candle", "quantity": 1, "unit_price": 2500}],
               get_conversation_history=lambda *a, **k: [{"direction": "outbound", "raw_text": "Shall I confirm?"}])
    ctx.update(overrides)
    for k, v in ctx.items():
        monkeypatch.setattr(pu, k, v)


def test_one_gemini_call_sees_order_history_and_a_catalog_without_prices_or_stock(monkeypatch):
    seen = _fake_client(monkeypatch, {"intent": "modify_order", "ops": [SET("v-candle", 2)], "confidence": 0.9})
    _patch_context(monkeypatch)
    out = pu.understand_pending_order("make it 2", {"id": "o1"}, {"id": "v1"}, {"id": "c1"}, "m1")
    assert out["action"] == "correct" and out["ops"] == [SET("v-candle", 2)]
    prompt = seen["config"]["system_instruction"]
    assert "Lavender Candle" in prompt and "v-candle" in prompt
    assert "sell_price" not in prompt and "floor_price" not in prompt and "stock_quantity" not in prompt
    assert "12000" not in prompt and "2500" not in prompt, "the model is never shown prices"
    assert any("Shall I confirm?" in str(c) for c in seen["contents"]), "history reaches the model"


def test_history_excludes_the_current_message(monkeypatch):
    _fake_client(monkeypatch, {"intent": "small_talk", "confidence": 0.9})
    got = {}
    _patch_context(monkeypatch, get_conversation_history=lambda vid, cid, exclude_message_id=None: got.update(x=exclude_message_id) or [])
    pu.understand_pending_order("thanks", {"id": "o1"}, {"id": "v1"}, {"id": "c1"}, "m-current")
    assert got["x"] == "m-current"


def test_a_failed_context_lookup_still_understands_a_plain_yes(monkeypatch):
    seen = _fake_client(monkeypatch, {"intent": "confirm_order", "confidence": 0.95})
    boom = lambda *a, **k: (_ for _ in ()).throw(RuntimeError("supabase blip"))
    _patch_context(monkeypatch, get_vendor_catalog=boom, get_conversation_history=boom)
    out = pu.understand_pending_order("yes", {"id": "o1"}, {"id": "v1"}, {"id": "c1"}, "m1")
    assert out["action"] == "confirm"
    assert "[]" in seen["config"]["system_instruction"]


def test_api_errors_propagate_so_main_can_fall_back(monkeypatch):
    fake = MagicMock()
    fake.models.generate_content.side_effect = RuntimeError("429 RESOURCE_EXHAUSTED")
    monkeypatch.setattr(pu, "client", fake)
    monkeypatch.setattr(time, "sleep", lambda s: None)
    _patch_context(monkeypatch)
    with pytest.raises(Exception):
        pu.understand_pending_order("yes", {"id": "o1"}, {"id": "v1"}, {"id": "c1"}, "m1")
