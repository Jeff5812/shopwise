"""Guards against code writing values the live DB CHECK constraints reject.

History: 'pending_payment', the 'cancel' intent, and several review_queue reasons were
written by the backend but never permitted by the DB constraints, so those writes
raised on every call (stuck orders, no payment links). The constraint lists live in
migrations/002_align_check_constraints.sql; this test keeps code and migration in sync.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIG = (ROOT / "migrations" / "002_align_check_constraints.sql").read_text()


def _allowed(constraint: str) -> set:
    block = re.search(rf"add constraint {constraint} check \((.*?)\]\)\);", MIG, re.S).group(1)
    return set(re.findall(r"'([a-z_]+)'", block))


def test_review_queue_reasons_are_allowed():
    used = set(re.findall(r'reason="([a-z_]+)"', (ROOT / "main.py").read_text()))
    assert used, "no review reasons found — regex out of date?"
    assert used <= _allowed("review_queue_reason_check"), used - _allowed("review_queue_reason_check")


def test_classifier_intents_are_allowed():
    src = (ROOT / "classifier.py").read_text()
    m = re.search(r'if intent not in \(([^)]*)\)', src)
    used = set(re.findall(r'"([a-z_]+)"', m.group(1)))
    assert used <= _allowed("messages_intent_check"), used - _allowed("messages_intent_check")


def test_order_statuses_written_are_allowed():
    src = (ROOT / "db.py").read_text()
    used = set(re.findall(r'update\(\{"status": "([a-z_]+)"\}\)', src))
    used |= {"awaiting_confirmation", "canceled"}
    assert "pending_payment" in used
    assert used <= _allowed("orders_status_check"), used - _allowed("orders_status_check")
