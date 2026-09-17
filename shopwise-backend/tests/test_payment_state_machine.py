"""
Tests for the payment-flow state-machine fix:
- mark_pending_payment() sets 'pending_payment', never 'confirmed', on WhatsApp yes
- confirm_order() is only ever called from the Paystack webhook after real payment
- webhook mismatch/unknown-reference/already-paid paths log clearly instead of
  silently swallowing the event
"""
from unittest.mock import MagicMock, patch


def test_mark_pending_payment_sets_correct_status(monkeypatch):
    import db

    fake_table = MagicMock()
    fake_table.update.return_value.eq.return_value.execute.return_value.data = [{"id": "order-1", "status": "pending_payment"}]
    fake_supabase = MagicMock()
    fake_supabase.table.return_value = fake_table
    monkeypatch.setattr(db, "supabase", fake_supabase)

    result = db.mark_pending_payment("order-1")

    fake_supabase.table.assert_called_with("orders")
    fake_table.update.assert_called_with({"status": "pending_payment"})
    assert result["status"] == "pending_payment"


def test_confirm_order_still_sets_confirmed(monkeypatch):
    import db

    fake_table = MagicMock()
    fake_table.update.return_value.eq.return_value.execute.return_value.data = [{"id": "order-1", "status": "confirmed"}]
    fake_supabase = MagicMock()
    fake_supabase.table.return_value = fake_table
    monkeypatch.setattr(db, "supabase", fake_supabase)

    result = db.confirm_order("order-1")

    fake_table.update.assert_called_with({"status": "confirmed"})
    assert result["status"] == "confirmed"


def test_webhook_mismatch_does_not_mark_paid(monkeypatch, capsys):
    import payment_service

    payment = {"id": "pay-1", "order_id": "order-1", "amount": 5000, "currency": "NGN", "status": "pending"}
    monkeypatch.setattr(payment_service, "get_payment_by_reference", lambda ref: payment)
    mark_paid_called = MagicMock()
    confirm_order_called = MagicMock()
    monkeypatch.setattr(payment_service, "mark_payment_paid", mark_paid_called)
    monkeypatch.setattr(payment_service, "confirm_order", confirm_order_called)

    # amount mismatch: expected 500000 kobo (5000 NGN), sending 100000 kobo
    payment_service.process_webhook_charge_success({"reference": "ref-1", "amount": 100000, "currency": "NGN"})

    mark_paid_called.assert_not_called()
    confirm_order_called.assert_not_called()
    assert "MISMATCH" in capsys.readouterr().out


def test_webhook_unknown_reference_is_ignored_not_errored(monkeypatch):
    import payment_service

    monkeypatch.setattr(payment_service, "get_payment_by_reference", lambda ref: None)
    mark_paid_called = MagicMock()
    monkeypatch.setattr(payment_service, "mark_payment_paid", mark_paid_called)

    # Should not raise
    payment_service.process_webhook_charge_success({"reference": "unknown-ref", "amount": 100, "currency": "NGN"})
    mark_paid_called.assert_not_called()


def test_webhook_already_paid_is_idempotent_noop(monkeypatch):
    import payment_service

    payment = {"id": "pay-1", "order_id": "order-1", "amount": 5000, "currency": "NGN", "status": "paid"}
    monkeypatch.setattr(payment_service, "get_payment_by_reference", lambda ref: payment)
    mark_paid_called = MagicMock()
    monkeypatch.setattr(payment_service, "mark_payment_paid", mark_paid_called)

    payment_service.process_webhook_charge_success({"reference": "ref-1", "amount": 500000, "currency": "NGN"})
    mark_paid_called.assert_not_called()


def test_webhook_matching_amount_marks_paid_and_confirms(monkeypatch):
    import payment_service

    payment = {"id": "pay-1", "order_id": "order-1", "amount": 5000, "currency": "NGN", "status": "pending"}
    monkeypatch.setattr(payment_service, "get_payment_by_reference", lambda ref: payment)
    mark_paid_called = MagicMock()
    confirm_order_called = MagicMock()
    monkeypatch.setattr(payment_service, "mark_payment_paid", mark_paid_called)
    monkeypatch.setattr(payment_service, "confirm_order", confirm_order_called)

    payment_service.process_webhook_charge_success({"reference": "ref-1", "amount": 500000, "currency": "NGN"})

    mark_paid_called.assert_called_once_with("pay-1")
    confirm_order_called.assert_called_once_with("order-1")
