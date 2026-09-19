"""Email capture for Paystack: use the stored email; otherwise ask only when the payment link
is about to be generated; save it; and never block the order if they don't give one."""
import asyncio
import pytest

import main
from email_capture import extract_email, looks_like_cancel


# ---- pure helpers -------------------------------------------------------------------------
@pytest.mark.parametrize("text,expected", [
    ("john@mail.com", "john@mail.com"),
    ("sure it's John.Doe+shop@Gmail.com thanks!", "john.doe+shop@gmail.com"),
    ("my email: a_b@sub.domain.ng.", "a_b@sub.domain.ng"),
    ("skip", None), ("no email", None), ("", None), ("me@localhost", None),
])
def test_extract_email(text, expected):
    assert extract_email(text) == expected


def test_cancel_detection():
    assert looks_like_cancel("cancel my order")
    assert looks_like_cancel("I don't want it anymore")
    assert not looks_like_cancel("skip")
    assert not looks_like_cancel("john@mail.com")


# ---- webhook flow -------------------------------------------------------------------------
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
    st = {"replies": [], "saved_email": None, "awaiting_calls": [], "payments": [], "review": []}
    customer = {"id": "c1", "wa_id": "2348000000000", "email": None}
    st["customer"] = customer
    st["awaiting_order"] = None
    st["pending_order"] = None
    st["pending_action"] = "confirm"

    async def reply(vendor_id, customer_id, wa_id, body):
        st["replies"].append(body)

    async def pay(order_id, email):
        st["payments"].append((order_id, email))
        return "https://paystack.test/checkout"

    m = monkeypatch.setattr
    m(main, "message_already_processed", lambda i: False)
    m(main, "get_or_create_vendor", lambda p: {"id": "v1"})
    m(main, "get_or_create_customer", lambda v, w: st["customer"])
    m(main, "log_message", lambda **k: {"id": "m1"})
    m(main, "get_conversation_history", lambda *a, **k: [])
    m(main, "update_message_classification", lambda *a, **k: None)
    m(main, "get_order_awaiting_email", lambda v, c: st["awaiting_order"])
    m(main, "get_pending_order", lambda v, c: st["pending_order"])
    m(main, "classify_pending_response", lambda t: st["pending_action"])
    m(main, "mark_pending_payment", lambda oid: None)
    m(main, "set_customer_email", lambda cid, e: st.__setitem__("saved_email", e))
    m(main, "set_order_awaiting_email", lambda oid, a: st["awaiting_calls"].append((oid, a)))
    m(main, "add_to_review_queue", lambda mid, reason: st["review"].append(reason))
    m(main, "reply_and_log", reply)
    m(main, "create_payment_for_order", pay)
    m(main, "PAYSTACK_DEFAULT_EMAIL", "default@shopwise.test")
    return st


def run(text):
    return asyncio.run(main.receive_message(_Req(_body(text))))


def test_yes_with_stored_email_uses_it_and_does_not_ask(env):
    env["customer"]["email"] = "known@mail.com"
    env["pending_order"] = {"id": "o1"}
    res = run("yes confirm")
    assert res["status"] == "order_pending_payment"
    assert env["payments"] == [("o1", "known@mail.com")]
    assert env["awaiting_calls"] == []


def test_yes_without_email_asks_and_does_not_create_payment(env):
    env["pending_order"] = {"id": "o1"}
    res = run("yes confirm")
    assert res["status"] == "awaiting_customer_email"
    assert env["awaiting_calls"] == [("o1", True)]
    assert env["payments"] == [] and len(env["replies"]) == 1


def test_email_reply_is_saved_and_used_for_paystack(env):
    env["awaiting_order"] = {"id": "o1"}
    res = run("it's Ada@Mail.com")
    assert res["status"] == "order_pending_payment"
    assert env["saved_email"] == "ada@mail.com"
    assert env["payments"] == [("o1", "ada@mail.com")]
    assert ("o1", False) in env["awaiting_calls"]


def test_skip_falls_back_to_default_and_saves_nothing(env):
    env["awaiting_order"] = {"id": "o1"}
    res = run("skip")
    assert res["status"] == "order_pending_payment"
    assert env["saved_email"] is None
    assert env["payments"] == [("o1", "default@shopwise.test")]


def test_any_non_email_reply_still_never_blocks(env):
    env["awaiting_order"] = {"id": "o1"}
    run("where do I pay?")
    assert env["payments"] == [("o1", "default@shopwise.test")]


def test_stored_email_wins_over_default_when_reply_has_none(env):
    env["customer"]["email"] = "known@mail.com"
    env["awaiting_order"] = {"id": "o1"}
    run("skip")
    assert env["payments"] == [("o1", "known@mail.com")]


def test_no_email_and_no_default_reasks_instead_of_crashing(env, monkeypatch):
    monkeypatch.setattr(main, "PAYSTACK_DEFAULT_EMAIL", None)
    env["awaiting_order"] = {"id": "o1"}
    res = run("skip")
    assert res["status"] == "awaiting_customer_email"
    assert env["payments"] == []


def test_cancel_reply_is_not_swallowed_by_email_capture(env, monkeypatch):
    env["awaiting_order"] = {"id": "o1"}
    called = {}
    def boom(*a, **k):
        called["fell_through"] = True
        raise RuntimeError("stop here — reached the normal pipeline")
    monkeypatch.setattr(main, "get_pending_order", boom)
    run("cancel my order")  # the outer catch-all handles the stop; we only care where it got to
    assert called.get("fell_through")
    assert env["payments"] == []


def test_paystack_failure_after_email_keeps_order_and_replies_honestly(env, monkeypatch):
    async def fail(order_id, email): raise RuntimeError("paystack down")
    monkeypatch.setattr(main, "create_payment_for_order", fail)
    env["awaiting_order"] = {"id": "o1"}
    res = run("ada@mail.com")
    assert res["status"] == "order_pending_payment_link_failed"
    assert env["review"] == ["payment_link_generation_failed"]
    assert env["saved_email"] == "ada@mail.com"
