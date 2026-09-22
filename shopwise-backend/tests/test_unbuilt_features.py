"""
QA categories 4, 11 (beyond stub), and 15 map to features that do not exist in
the codebase yet — no amount of prompt tuning fixes these. These tests are
xfail (not skip) so the suite keeps a visible, permanent reminder of the gap:
they'll fail loudly the day someone marks them as passing without the feature
actually being built, and flip to "unexpectedly passing" the day it is.
"""
import pytest


@pytest.mark.xfail(reason="Category 4: no audio transcription path exists in the codebase", strict=False)
def test_category4_voice_note_order():
    from main import handle_incoming_voice_note  # does not exist yet
    raise AssertionError("voice note handling not implemented")


@pytest.mark.xfail(reason="Category 15: no query exists for 'what did I buy last time'", strict=False)
def test_category15_customer_order_history_query():
    from db import get_customer_order_history  # does not exist yet
    raise AssertionError("customer order history query not implemented")


@pytest.mark.xfail(reason="Category 11: negotiation is escalate-only, no counter-offer action type exists", strict=False)
def test_category11_negotiation_counter_offer():
    from actions import generate_counter_offer  # does not exist yet
    raise AssertionError("counter-offer negotiation logic not implemented")
