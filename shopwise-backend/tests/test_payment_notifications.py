"""Payment-received notifications: messages come from DB rows, and fire exactly once."""
import asyncio
from unittest.mock import MagicMock

import main
import payment_service
from payment_notifications import build_customer_receipt, build_seller_alert

ORDER = {"id": "abcdef12-0000", "total_amount": 15000, "vendor_id": "v1", "customer_id": "c1"}
CUSTOMER = {"id": "c1", "wa_id": "2348000000000", "display_name": "Ada"}


def test_messages_use_only_database_facts():
    assert "#abcdef12" in build_customer_receipt(ORDER) and "\u20a615,000" in build_customer_receipt(ORDER)
    assert "Ada" in build_seller_alert(ORDER, CUSTOMER)
    assert "2348000000000" in build_seller_alert(ORDER, {"wa_id": "2348000000000"})


def _wire(monkeypatch, seller=None):
    sent, logged = [], []
    monkeypatch.setattr(main, "get_order", lambda oid: ORDER)
    monkeypatch.setattr(main, "get_customer", lambda cid: CUSTOMER)

    async def fake_reply(vendor_id, customer_id, to, body):
        logged.append((to, body))

    async def fake_send(to, body):
        sent.append((to, body))

    monkeypatch.setattr(main, "reply_and_log", fake_reply)
    monkeypatch.setattr(main, "send_whatsapp_message", fake_send)
    if seller:
        monkeypatch.setenv("SELLER_NOTIFY_WA_ID", seller)
    else:
        monkeypatch.delenv("SELLER_NOTIFY_WA_ID", raising=False)
    return sent, logged


def test_customer_always_notified_seller_only_when_configured(monkeypatch):
    sent, logged = _wire(monkeypatch)
    asyncio.run(main.notify_payment_received("o1"))
    assert [t for t, _ in logged] == ["2348000000000"] and sent == []

    sent, logged = _wire(monkeypatch, seller="2349000000000")
    asyncio.run(main.notify_payment_received("o1"))
    assert [t for t, _ in sent] == ["2349000000000"]


def test_notification_failure_never_raises(monkeypatch):
    _wire(monkeypatch)
    monkeypatch.setattr(main, "get_order", MagicMock(side_effect=RuntimeError("db down")))
    asyncio.run(main.notify_payment_received("o1"))  # must not raise


def test_handler_returns_order_id_only_on_the_first_successful_payment(monkeypatch):
    payment = {"id": "p1", "order_id": "o1", "amount": 5000, "currency": "NGN", "status": "pending"}
    monkeypatch.setattr(payment_service, "get_payment_by_reference", lambda ref: dict(payment))
    monkeypatch.setattr(payment_service, "mark_payment_paid", MagicMock())
    monkeypatch.setattr(payment_service, "confirm_order", MagicMock())
    event = {"reference": "r", "amount": 500000, "currency": "NGN"}
    assert payment_service.process_webhook_charge_success(event) == "o1"

    payment["status"] = "paid"  # Paystack retry
    assert payment_service.process_webhook_charge_success(event) is None
    payment["status"] = "pending"  # amount mismatch
    assert payment_service.process_webhook_charge_success({**event, "amount": 1}) is None
