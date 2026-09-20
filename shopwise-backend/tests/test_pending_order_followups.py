"""
Pending-order hardening: while an order waits on the customer's yes/no, confirm and cancel keep
working, and every other reply (correction, question, casual, ambiguous) is handled WITHOUT losing,
duplicating or auto-confirming the pending order.

These drive the real webhook (main.receive_message) and the real pending_order_handler. Mocked
boundaries: Gemini (the classification / interpretation), WhatsApp send, and the Supabase layer,
which is an in-memory fake that reproduces replace_order_items_with_stock's semantics (restock old
lines, check + reserve new ones, recalc total, refuse non-awaiting orders, all-or-nothing). The real
SQL function was exercised against the live DB inside a rolled-back transaction.
"""
import asyncio
import pytest

import main
import pending_order_handler as poh
import pending_response_classifier as prc
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
        "replace_calls": [], "action": "other", "interpretation": None, "interpret_error": None,
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

    def fake_interpret(text, current_lines, catalog, history=None):
        if st["interpret_error"]:
            raise st["interpret_error"]
        st["seen_current_lines"] = current_lines
        return st["interpretation"]

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
    m(main, "classify_pending_response", lambda t: st["action"])
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
    m(poh, "get_conversation_history", lambda *a, **k: [])
    m(poh, "interpret_correction", fake_interpret)
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


# ---- 3. CORRECTION: quantity ----------------------------------------------------------------
def test_quantity_correction_edits_same_order_and_reasks(env):
    env["start_order"](("v-candle", 1))
    env["action"] = "correct"
    env["interpretation"] = {"line_items": [{"variant_id": "v-candle", "quantity": 2}],
                             "confidence": 0.95, "ambiguous_note": None}
    result = run("actually make it 2")
    assert result["status"] == "pending_order_corrected"
    assert_pending_preserved(env, total=5000, item_qty={"v-candle": 2})
    assert env["stock"]["v-candle"] == 18, "stock: 1 restocked, 2 reserved"
    assert "2 x Lavender Candle" in env["replies"][-1] and "N5000" in env["replies"][-1]
    assert "confirm" in env["replies"][-1].lower(), "must ask for confirmation again"
    assert env["seen_current_lines"] == [{"variant_id": "v-candle", "product_name": "Lavender Candle", "quantity": 1}]


def test_correction_can_use_saved_quantity_of_zero_change_words(env):
    """'make it 3' after 2 restocks 2 and reserves 3 in one step."""
    env["start_order"](("v-candle", 2))
    env["action"] = "correct"
    env["interpretation"] = {"line_items": [{"variant_id": "v-candle", "quantity": 3}], "confidence": 0.9, "ambiguous_note": None}
    run("make it 3")
    assert_pending_preserved(env, total=7500, item_qty={"v-candle": 3})
    assert env["stock"]["v-candle"] == 17


# ---- 3b. CORRECTION: variant / color --------------------------------------------------------
def test_variant_color_correction_swaps_variant_and_uses_catalog_price(env):
    env["start_order"](("v-gown-m-blue", 1))
    env["action"] = "correct"
    # model tries to sneak in its own price: it must be ignored, price comes from the catalog
    env["interpretation"] = {"line_items": [{"variant_id": "v-gown-m-red", "quantity": 1, "unit_price": 1}],
                             "confidence": 0.9, "ambiguous_note": None}
    result = run("make it red instead")
    assert result["status"] == "pending_order_corrected"
    assert_pending_preserved(env, total=15000, item_qty={"v-gown-m-red": 1})
    assert env["items"][0]["unit_price"] == 15000
    assert env["stock"]["v-gown-m-blue"] == 5 and env["stock"]["v-gown-m-red"] == 2
    assert "Ankara Gown (M, red)" in env["replies"][-1]


def test_remove_one_line_keeps_the_rest(env):
    env["start_order"](("v-candle", 1), ("v-soap", 2))
    env["action"] = "correct"
    env["interpretation"] = {"line_items": [{"variant_id": "v-soap", "quantity": 2}], "confidence": 0.9, "ambiguous_note": None}
    run("remove the candle")
    assert_pending_preserved(env, total=2400, item_qty={"v-soap": 2})
    assert env["stock"]["v-candle"] == 20, "candle restocked"


def test_removing_everything_never_auto_cancels(env):
    env["start_order"](("v-candle", 1))
    env["action"] = "correct"
    env["interpretation"] = {"line_items": [], "confidence": 0.95, "ambiguous_note": None}
    result = run("remove the candle")
    assert result["status"] == "pending_order_correction_would_empty"
    assert_pending_preserved(env, total=2500, item_qty={"v-candle": 1})
    assert env["replace_calls"] == []
    assert "cancel" in env["replies"][-1].lower()


def test_correction_that_changes_nothing_skips_the_database(env):
    env["start_order"](("v-candle", 1))
    env["action"] = "correct"
    env["interpretation"] = {"line_items": [{"variant_id": "v-candle", "quantity": 1}], "confidence": 0.9, "ambiguous_note": None}
    result = run("make it 1")
    assert result["status"] == "pending_order_correction_no_change"
    assert env["replace_calls"] == []
    assert_pending_preserved(env, total=2500)


# ---- 3c. CORRECTION: ambiguous / unsafe -> ask, flag, preserve --------------------------------
def test_ambiguous_correction_asks_and_flags_without_touching_order(env):
    env["start_order"](("v-candle", 1), ("v-soap", 1))
    env["action"] = "correct"
    env["interpretation"] = {"line_items": [{"variant_id": "v-candle", "quantity": 2}], "confidence": 0.4,
                             "ambiguous_note": "Do you want 2 candles or 2 soaps?"}
    result = run("make it 2")
    assert result["status"] == "pending_order_correction_unclear"
    assert env["review"] == ["unparseable"]
    assert env["replace_calls"] == []
    assert "Do you want 2 candles or 2 soaps?" in env["replies"][-1] and REMINDER in env["replies"][-1]
    assert_pending_preserved(env, total=3700, item_qty={"v-candle": 1, "v-soap": 1})


@pytest.mark.parametrize("bad_items", [
    [{"variant_id": "v-does-not-exist", "quantity": 1}],
    [{"variant_id": "v-candle", "quantity": 0}],
    [{"variant_id": "v-candle", "quantity": -2}],
    [{"variant_id": "v-candle", "quantity": 1.5}],
    [{"variant_id": "v-candle", "quantity": True}],
    ["not-a-dict"],
])
def test_invalid_model_output_is_rejected_by_code_not_trusted(env, bad_items):
    env["start_order"](("v-candle", 1))
    env["action"] = "correct"
    env["interpretation"] = {"line_items": bad_items, "confidence": 0.99, "ambiguous_note": None}
    result = run("change it")
    assert result["status"] == "pending_order_correction_unclear"
    assert env["replace_calls"] == [] and env["review"] == ["unparseable"]
    assert_pending_preserved(env, total=2500, item_qty={"v-candle": 1})


def test_interpretation_crash_is_handled_and_order_kept(env):
    env["start_order"](("v-candle", 1))
    env["action"] = "correct"
    env["interpret_error"] = RuntimeError("503 UNAVAILABLE")
    result = run("make it 2")
    assert result["status"] == "pending_order_correction_unclear"
    assert_pending_preserved(env, total=2500, item_qty={"v-candle": 1})


def test_correction_beyond_stock_leaves_original_order_untouched(env):
    env["start_order"](("v-gown-m-red", 1))
    env["action"] = "correct"
    env["interpretation"] = {"line_items": [{"variant_id": "v-gown-m-red", "quantity": 10}], "confidence": 0.95, "ambiguous_note": None}
    result = run("make it 10")
    assert result["status"] == "pending_order_correction_insufficient_stock"
    assert env["review"] == ["insufficient_stock"]
    assert_pending_preserved(env, total=15000, item_qty={"v-gown-m-red": 1})
    assert env["stock"]["v-gown-m-red"] == 2, "original reservation intact"


def test_order_that_moved_forward_meanwhile_is_not_rewritten(env, monkeypatch):
    env["start_order"](("v-candle", 1))
    env["action"] = "correct"
    env["interpretation"] = {"line_items": [{"variant_id": "v-candle", "quantity": 2}], "confidence": 0.9, "ambiguous_note": None}

    def racing_replace(order_id, items):
        env["order"]["status"] = "pending_payment"   # paid/advanced between read and write
        raise OrderNotEditableError("order_not_editable: pending_payment")
    monkeypatch.setattr(poh, "replace_order_items", racing_replace)
    result = run("make it 2")
    assert result["status"] == "pending_order_not_editable"
    assert env["items"][0]["quantity"] == 1 and env["payments"] == []


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


# ---- The order survives a whole conversation, then can still be confirmed ----------------------
def test_order_survives_question_correction_casual_then_confirms_normally(env):
    env["start_order"](("v-candle", 1))
    env["faq"] = {"answered": True, "reply": "Yes we deliver to Lekki."}
    env["action"] = "question"; run("do you deliver to Lekki?")
    env["interpretation"] = {"line_items": [{"variant_id": "v-candle", "quantity": 2}], "confidence": 0.9, "ambiguous_note": None}
    env["action"] = "correct"; run("make it 2")
    env["action"] = "casual"; run("thanks")
    assert_pending_preserved(env, total=5000, item_qty={"v-candle": 2})
    env["action"] = "confirm"
    assert run("yes")["status"] == "order_pending_payment"
    assert env["payments"] == [("o1", "buyer@mail.com")] and env["orders_created"] == 0


# ---- Unit: validation + pending classifier parsing --------------------------------------------
def test_validate_revision_merges_duplicates_and_uses_catalog_prices():
    index = poh._variant_index(_catalog(BASE_STOCK))
    out = poh.validate_revision([{"variant_id": "v-candle", "quantity": 1}, {"variant_id": "v-candle", "quantity": 2},
                                 {"variant_id": "v-gown-m-blue", "quantity": 1, "unit_price": 1}], index)
    assert {(i["variant_id"], i["quantity"], i["unit_price"]) for i in out} == {
        ("v-candle", 3, 2500), ("v-gown-m-blue", 1, 15000)}


@pytest.mark.parametrize("payload,expected", [
    ('{"action": "confirm"}', "confirm"), ('{"action": "cancel"}', "cancel"), ('{"action": "correct"}', "correct"),
    ('{"action": "question"}', "question"), ('{"action": "casual"}', "casual"), ('{"action": "other"}', "other"),
    ('{"action": "nonsense"}', "other"), ('not json', "other"), ('{}', "other"),
])
def test_pending_classifier_parses_all_six_actions_and_fails_safe(monkeypatch, payload, expected):
    from unittest.mock import MagicMock
    fake = MagicMock()
    fake.models.generate_content.return_value = MagicMock(text=payload)
    monkeypatch.setattr(prc, "client", fake)
    assert prc.classify_pending_response("anything") == expected


def test_pending_prompt_never_lets_a_mixed_yes_and_change_confirm():
    assert "yes but make it 2" in prc.PROMPT and '"correct", never "confirm"' in prc.PROMPT


def test_interpret_correction_parses_and_fails_safe(monkeypatch):
    from unittest.mock import MagicMock
    for text, expect_conf in [('{"line_items": [{"variant_id": "v-candle", "quantity": 2}], "confidence": 0.9}', 0.9),
                              ("garbage", 0.0)]:
        fake = MagicMock()
        fake.models.generate_content.return_value = MagicMock(text=text)
        monkeypatch.setattr(poh, "client", fake)
        out = poh.interpret_correction("make it 2", [], _catalog(BASE_STOCK), [])
        assert out["confidence"] == expect_conf
