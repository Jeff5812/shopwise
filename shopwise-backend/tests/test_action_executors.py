"""
execute() tests: shape/business-rule coverage for each action-executor branch, mocking only
the db.py / reply_generator.py boundary (no real Supabase, no real Gemini). Not the 158-scenario
eval bank — that's a manual/live-trial tool per the user's call.
"""
import asyncio
import pytest

import action_executors as ex
from db import InsufficientStockError, OrderNotEditableError
from conftest import REAL_SHAPE_CATALOG, make_state


def run(coro):
    return asyncio.run(coro)


class FakeReply:
    """Collects (vendor_id, customer_id, wa_id, body) calls, standing in for main.reply_and_log."""
    def __init__(self):
        self.calls = []

    async def __call__(self, vendor_id, customer_id, wa_id, body):
        self.calls.append((vendor_id, customer_id, wa_id, body))

    @property
    def last_text(self):
        return self.calls[-1][3]


VENDOR = {"id": "vendor-1"}
CUSTOMER = {"id": "customer-1"}
WA_ID = "2348000000000"
MESSAGE_ID = "msg-1"
PENDING = {"id": "order-1", "status": "awaiting_confirmation"}


@pytest.fixture(autouse=True)
def patch_boundaries(monkeypatch):
    """Every db.py / reply_generator.py call action_executors.py makes, patched at the point of
    use (action_executors.<name>), mirroring the existing pending_order_handler test style."""
    monkeypatch.setattr(ex, "get_vendor_catalog", lambda vendor_id: REAL_SHAPE_CATALOG)
    monkeypatch.setattr(ex, "get_faq_snippets", lambda vendor_id: [])
    monkeypatch.setattr(ex, "update_message_classification", lambda *a, **kw: None)
    monkeypatch.setattr(ex, "add_to_review_queue", lambda *a, **kw: None)
    monkeypatch.setattr(ex, "generate_faq_answer", lambda text, snippets: {"answered": False, "reply": None})
    monkeypatch.setattr(ex, "generate_order_confirmation", lambda items, total: f"CONFIRM:{total}")


def A(type_, **kw):
    return {"type": type_, **kw}


def U(actions, confidence=0.9, note=None):
    return {"actions": actions, "confidence": confidence, "note": note}


def _items(*rows):
    return [{"product_variant_id": v, "quantity": q} for v, q in rows]


# --- New order (no pending order) -----------------------------------------------------------

def test_new_order_created(monkeypatch):
    created = {}

    def fake_create_order(vendor_id, customer_id, line_items, message_id):
        created["line_items"] = line_items
        return {"id": "order-1", "total_amount": 5000}

    monkeypatch.setattr(ex, "create_order", fake_create_order)
    reply = FakeReply()
    state = make_state(pending_order=None)
    understanding = U([A("add_item", variant_id="cand-lav-std", quantity=2)])

    result = run(ex.execute(understanding, text="2 candles", state=state, vendor=VENDOR, customer=CUSTOMER,
                            wa_id=WA_ID, message_id=MESSAGE_ID, reply=reply))

    assert result["status"] == "new_order_created"
    assert created["line_items"] == [
        {"variant_id": "cand-lav-std", "quantity": 2, "unit_price": 2500, "product_name": "Lavender Candle"}
    ]
    assert reply.last_text == "CONFIRM:5000"


def test_new_order_merges_duplicate_variant_across_actions(monkeypatch):
    created = {}

    def fake_create_order(vendor_id, customer_id, line_items, message_id):
        created["line_items"] = line_items
        return {"id": "o1", "total_amount": 5000}

    monkeypatch.setattr(ex, "create_order", fake_create_order)
    reply = FakeReply()
    state = make_state(pending_order=None)
    understanding = U([
        A("add_item", variant_id="cand-lav-std", quantity=1),
        A("add_item", variant_id="cand-lav-std", quantity=1),
    ])
    run(ex.execute(understanding, text="2 candles", state=state, vendor=VENDOR, customer=CUSTOMER,
                   wa_id=WA_ID, message_id=MESSAGE_ID, reply=reply))
    assert created["line_items"] == [
        {"variant_id": "cand-lav-std", "quantity": 2, "unit_price": 2500, "product_name": "Lavender Candle"}
    ]


def test_new_order_insufficient_stock(monkeypatch):
    def fake_create_order(*a, **kw):
        raise InsufficientStockError("not enough")
    monkeypatch.setattr(ex, "create_order", fake_create_order)
    reply = FakeReply()
    state = make_state(pending_order=None)
    understanding = U([A("add_item", variant_id="cand-lav-std", quantity=99)])

    result = run(ex.execute(understanding, text="99 candles", state=state, vendor=VENDOR, customer=CUSTOMER,
                            wa_id=WA_ID, message_id=MESSAGE_ID, reply=reply))
    assert result["status"] == "insufficient_stock"
    assert "enough" in reply.last_text.lower()


def test_new_order_unknown_variant_asks_instead_of_guessing():
    reply = FakeReply()
    state = make_state(pending_order=None)
    understanding = U([A("add_item", variant_id="does-not-exist", quantity=1)])
    result = run(ex.execute(understanding, text="a thing", state=state, vendor=VENDOR, customer=CUSTOMER,
                            wa_id=WA_ID, message_id=MESSAGE_ID, reply=reply))
    assert result["status"] == "new_order_unknown_variant"


def test_new_order_non_add_item_edit_asks_instead_of_crashing():
    # set_quantity with nothing pending means the model got confused about state.
    reply = FakeReply()
    state = make_state(pending_order=None)
    understanding = U([A("set_quantity", variant_id="cand-lav-std", quantity=2)])
    result = run(ex.execute(understanding, text="make it 2", state=state, vendor=VENDOR, customer=CUSTOMER,
                            wa_id=WA_ID, message_id=MESSAGE_ID, reply=reply))
    assert result["status"] == "new_order_unclear"


def test_new_order_plus_question_answers_both(monkeypatch):
    monkeypatch.setattr(ex, "create_order", lambda *a, **kw: {"id": "o1", "total_amount": 2500})
    monkeypatch.setattr(ex, "generate_faq_answer", lambda text, snippets: {"answered": True, "reply": "Yes, we deliver to Lekki."})
    reply = FakeReply()
    state = make_state(pending_order=None)
    understanding = U([A("add_item", variant_id="cand-lav-std", quantity=1), A("ask_question")])
    run(ex.execute(understanding, text="1 candle and do you deliver to Lekki?", state=state, vendor=VENDOR,
                   customer=CUSTOMER, wa_id=WA_ID, message_id=MESSAGE_ID, reply=reply))
    assert "Yes, we deliver to Lekki." in reply.last_text


# --- Correction (order already pending) ------------------------------------------------------

def test_correction_set_quantity(monkeypatch):
    monkeypatch.setattr(ex, "get_order_items", lambda order_id: _items(("cand-lav-std", 1)))
    updated = {}

    def fake_replace(order_id, items):
        updated["items"] = items
        return {"total_amount": 7500}

    monkeypatch.setattr(ex, "replace_order_items", fake_replace)
    reply = FakeReply()
    state = make_state(pending_order=PENDING, lines=[{"variant_id": "cand-lav-std", "product_name": "Lavender Candle", "quantity": 1}])
    understanding = U([A("set_quantity", variant_id="cand-lav-std", quantity=3)])

    result = run(ex.execute(understanding, text="make it 3", state=state, vendor=VENDOR, customer=CUSTOMER,
                            wa_id=WA_ID, message_id=MESSAGE_ID, reply=reply))
    assert result["status"] == "pending_order_corrected"
    assert updated["items"][0]["quantity"] == 3
    assert reply.last_text == "CONFIRM:7500"


def test_correction_no_change_short_circuits_without_calling_replace(monkeypatch):
    monkeypatch.setattr(ex, "get_order_items", lambda order_id: _items(("cand-lav-std", 2)))
    monkeypatch.setattr(ex, "replace_order_items", lambda *a, **kw: pytest.fail("must not call replace_order_items"))
    reply = FakeReply()
    state = make_state(pending_order=PENDING, lines=[{"variant_id": "cand-lav-std", "product_name": "Lavender Candle", "quantity": 2}])
    understanding = U([A("set_quantity", variant_id="cand-lav-std", quantity=2)])

    result = run(ex.execute(understanding, text="make it 2", state=state, vendor=VENDOR, customer=CUSTOMER,
                            wa_id=WA_ID, message_id=MESSAGE_ID, reply=reply))
    assert result["status"] == "pending_order_correction_no_change"


def test_correction_would_empty_never_auto_cancels(monkeypatch):
    monkeypatch.setattr(ex, "get_order_items", lambda order_id: _items(("cand-lav-std", 1)))
    reply = FakeReply()
    state = make_state(pending_order=PENDING, lines=[{"variant_id": "cand-lav-std", "product_name": "Lavender Candle", "quantity": 1}])
    understanding = U([A("remove_item", variant_id="cand-lav-std")])

    result = run(ex.execute(understanding, text="remove the candle", state=state, vendor=VENDOR, customer=CUSTOMER,
                            wa_id=WA_ID, message_id=MESSAGE_ID, reply=reply))
    assert result["status"] == "pending_order_correction_would_empty"
    assert "empty" in reply.last_text.lower()


def test_correction_invalid_op_asks_instead_of_guessing(monkeypatch):
    monkeypatch.setattr(ex, "get_order_items", lambda order_id: _items(("cand-lav-std", 1)))
    reply = FakeReply()
    state = make_state(pending_order=PENDING, lines=[{"variant_id": "cand-lav-std", "product_name": "Lavender Candle", "quantity": 1}])
    # set_quantity on a variant that isn't in the order at all
    understanding = U([A("set_quantity", variant_id="gown-ank-m-blue", quantity=2)])

    result = run(ex.execute(understanding, text="make it 2", state=state, vendor=VENDOR, customer=CUSTOMER,
                            wa_id=WA_ID, message_id=MESSAGE_ID, reply=reply))
    assert result["status"] == "pending_order_correction_unclear"


def test_correction_insufficient_stock_keeps_order_as_was(monkeypatch):
    monkeypatch.setattr(ex, "get_order_items", lambda order_id: _items(("cand-lav-std", 1)))

    def fake_replace(order_id, items):
        raise InsufficientStockError("not enough")

    monkeypatch.setattr(ex, "replace_order_items", fake_replace)
    reply = FakeReply()
    state = make_state(pending_order=PENDING, lines=[{"variant_id": "cand-lav-std", "product_name": "Lavender Candle", "quantity": 1}])
    understanding = U([A("set_quantity", variant_id="cand-lav-std", quantity=50)])

    result = run(ex.execute(understanding, text="make it 50", state=state, vendor=VENDOR, customer=CUSTOMER,
                            wa_id=WA_ID, message_id=MESSAGE_ID, reply=reply))
    assert result["status"] == "pending_order_correction_insufficient_stock"


def test_correction_not_editable(monkeypatch):
    monkeypatch.setattr(ex, "get_order_items", lambda order_id: _items(("cand-lav-std", 1)))

    def fake_replace(order_id, items):
        raise OrderNotEditableError("already confirmed")

    monkeypatch.setattr(ex, "replace_order_items", fake_replace)
    reply = FakeReply()
    state = make_state(pending_order=PENDING, lines=[{"variant_id": "cand-lav-std", "product_name": "Lavender Candle", "quantity": 1}])
    understanding = U([A("set_quantity", variant_id="cand-lav-std", quantity=2)])

    result = run(ex.execute(understanding, text="make it 2", state=state, vendor=VENDOR, customer=CUSTOMER,
                            wa_id=WA_ID, message_id=MESSAGE_ID, reply=reply))
    assert result["status"] == "pending_order_not_editable"


def test_correction_plus_question_answers_both(monkeypatch):
    monkeypatch.setattr(ex, "get_order_items", lambda order_id: _items(("cand-lav-std", 1)))
    monkeypatch.setattr(ex, "replace_order_items", lambda order_id, items: {"total_amount": 5000})
    monkeypatch.setattr(ex, "generate_faq_answer", lambda text, snippets: {"answered": True, "reply": "We deliver same day."})
    reply = FakeReply()
    state = make_state(pending_order=PENDING, lines=[{"variant_id": "cand-lav-std", "product_name": "Lavender Candle", "quantity": 1}])
    understanding = U([A("set_quantity", variant_id="cand-lav-std", quantity=2), A("ask_question")])

    run(ex.execute(understanding, text="make it 2 and do you deliver to Lekki?", state=state, vendor=VENDOR,
                   customer=CUSTOMER, wa_id=WA_ID, message_id=MESSAGE_ID, reply=reply))
    assert "We deliver same day." in reply.last_text


# --- Question / small talk / unknown, with and without a pending order -----------------------

def test_question_no_pending(monkeypatch):
    monkeypatch.setattr(ex, "generate_faq_answer", lambda text, snippets: {"answered": True, "reply": "We deliver islandwide."})
    reply = FakeReply()
    state = make_state(pending_order=None)
    understanding = U([A("ask_question")])
    result = run(ex.execute(understanding, text="do you deliver to Lekki?", state=state, vendor=VENDOR,
                            customer=CUSTOMER, wa_id=WA_ID, message_id=MESSAGE_ID, reply=reply))
    assert result["status"] == "question_answered"
    assert ex.PENDING_REMINDER not in reply.last_text


def test_question_with_pending_includes_reminder(monkeypatch):
    monkeypatch.setattr(ex, "generate_faq_answer", lambda text, snippets: {"answered": True, "reply": "We deliver islandwide."})
    reply = FakeReply()
    state = make_state(pending_order=PENDING)
    understanding = U([A("ask_question")])
    run(ex.execute(understanding, text="do you deliver to Lekki?", state=state, vendor=VENDOR,
                   customer=CUSTOMER, wa_id=WA_ID, message_id=MESSAGE_ID, reply=reply))
    assert ex.PENDING_REMINDER in reply.last_text


def test_small_talk_no_pending():
    reply = FakeReply()
    state = make_state(pending_order=None)
    understanding = U([A("small_talk")])
    result = run(ex.execute(understanding, text="thanks!", state=state, vendor=VENDOR, customer=CUSTOMER,
                            wa_id=WA_ID, message_id=MESSAGE_ID, reply=reply))
    assert result["status"] == "small_talk"
    assert "welcome" in reply.last_text.lower()
    assert ex.PENDING_REMINDER not in reply.last_text


def test_small_talk_with_pending_keeps_reminder():
    reply = FakeReply()
    state = make_state(pending_order=PENDING)
    understanding = U([A("small_talk")])
    run(ex.execute(understanding, text="good morning", state=state, vendor=VENDOR, customer=CUSTOMER,
                   wa_id=WA_ID, message_id=MESSAGE_ID, reply=reply))
    assert ex.PENDING_REMINDER in reply.last_text


class FakeReplyPlain:
    """Collects (wa_id, body) calls, standing in for main.send_whatsapp_message."""
    def __init__(self):
        self.calls = []

    async def __call__(self, wa_id, body):
        self.calls.append((wa_id, body))

    @property
    def last_text(self):
        return self.calls[-1][1]


def test_unknown_escalates_without_logging_to_history():
    reply = FakeReply()
    reply_plain = FakeReplyPlain()
    state = make_state(pending_order=None)
    understanding = U([A("unknown")], confidence=0.0, note="not sure what you mean")
    result = run(ex.execute(understanding, text="???", state=state, vendor=VENDOR, customer=CUSTOMER,
                            wa_id=WA_ID, message_id=MESSAGE_ID, reply=reply, reply_plain=reply_plain))
    assert result["status"] == "escalated_unclear"
    assert "not sure what you mean" in reply_plain.last_text
    assert reply.calls == []  # never logged to conversation history, same as the old low-confidence escalation
