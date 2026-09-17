"""
Tests for the circuit breaker + retry + fallback logic in model_router.py.
Uses a fake client whose generate_content raises on demand, so we control
exactly how many times the primary model fails without touching real timing
beyond what's needed to exercise the retry sleep (kept short via monkeypatch).
"""
import time
import pytest
from unittest.mock import MagicMock

import model_router
from model_router import (
    generate_with_resilience,
    PRIMARY_MODEL,
    FALLBACK_MODEL,
    FAILURE_THRESHOLD,
)


def _make_client(behavior):
    """behavior: dict[model_name] -> either an exception instance to raise,
    or a MagicMock response to return."""
    client = MagicMock()

    def _generate(model, contents, config):
        outcome = behavior[model]
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    client.models.generate_content.side_effect = _generate
    return client


@pytest.fixture(autouse=True)
def _no_real_sleep(monkeypatch):
    # Retry backoff sleeps are real seconds in model_router — don't slow tests down
    monkeypatch.setattr(model_router.time, "sleep", lambda _: None)


def test_success_on_primary_first_try():
    ok_response = MagicMock()
    client = _make_client({PRIMARY_MODEL: ok_response})
    response, model_used = generate_with_resilience(client, contents="hi", config={})
    assert model_used == PRIMARY_MODEL
    assert response is ok_response


def test_falls_back_when_primary_fails_all_retries():
    ok_response = MagicMock()
    client = _make_client({
        PRIMARY_MODEL: Exception("503 UNAVAILABLE: high demand"),
        FALLBACK_MODEL: ok_response,
    })
    response, model_used = generate_with_resilience(client, contents="hi", config={})
    assert model_used == FALLBACK_MODEL
    assert response is ok_response


def test_breaker_opens_after_threshold_consecutive_failures():
    ok_response = MagicMock()
    client = _make_client({
        PRIMARY_MODEL: Exception("503 UNAVAILABLE"),
        FALLBACK_MODEL: ok_response,
    })

    for _ in range(FAILURE_THRESHOLD):
        generate_with_resilience(client, contents="hi", config={})

    assert model_router._breaker_is_open()


def test_breaker_open_skips_primary_entirely():
    # Force the breaker open first
    ok_response = MagicMock()
    failing_client = _make_client({
        PRIMARY_MODEL: Exception("503 UNAVAILABLE"),
        FALLBACK_MODEL: ok_response,
    })
    for _ in range(FAILURE_THRESHOLD):
        generate_with_resilience(failing_client, contents="hi", config={})
    assert model_router._breaker_is_open()

    # Now use a client where primary would actually succeed if tried —
    # breaker should skip it anyway and go straight to fallback
    would_succeed_client = _make_client({
        PRIMARY_MODEL: MagicMock(),  # never called if breaker works correctly
        FALLBACK_MODEL: ok_response,
    })
    response, model_used = generate_with_resilience(would_succeed_client, contents="hi", config={})
    assert model_used == FALLBACK_MODEL
    would_succeed_client.models.generate_content.assert_called_once_with(
        model=FALLBACK_MODEL, contents="hi", config={}
    )


def test_breaker_closes_on_success_after_cooldown_expires():
    ok_response = MagicMock()
    failing_client = _make_client({
        PRIMARY_MODEL: Exception("503 UNAVAILABLE"),
        FALLBACK_MODEL: ok_response,
    })
    for _ in range(FAILURE_THRESHOLD):
        generate_with_resilience(failing_client, contents="hi", config={})
    assert model_router._breaker_is_open()

    # Simulate cooldown having expired
    model_router._breaker_open_until = time.time() - 1
    assert not model_router._breaker_is_open()

    recovered_client = _make_client({PRIMARY_MODEL: ok_response})
    response, model_used = generate_with_resilience(recovered_client, contents="hi", config={})
    assert model_used == PRIMARY_MODEL
    assert model_router._consecutive_failures == 0
    assert model_router._breaker_open_until == 0.0


def test_non_transient_error_still_falls_back_without_retry_storm():
    ok_response = MagicMock()
    client = _make_client({
        PRIMARY_MODEL: ValueError("some unrelated bug"),
        FALLBACK_MODEL: ok_response,
    })
    response, model_used = generate_with_resilience(client, contents="hi", config={})
    assert model_used == FALLBACK_MODEL
    # Only 1 attempt on primary since the error wasn't transient
    primary_calls = [c for c in client.models.generate_content.call_args_list if c.kwargs["model"] == PRIMARY_MODEL]
    assert len(primary_calls) == 1


def test_raises_last_error_if_every_model_fails():
    client = _make_client({
        PRIMARY_MODEL: Exception("503 UNAVAILABLE"),
        FALLBACK_MODEL: Exception("503 UNAVAILABLE too"),
    })
    with pytest.raises(Exception, match="too"):
        generate_with_resilience(client, contents="hi", config={})
