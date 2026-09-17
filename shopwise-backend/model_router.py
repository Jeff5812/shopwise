"""
Shared Gemini call wrapper: retry + model fallback + circuit breaker.
Used by both classifier.py and order_extractor.py so the breaker state
is shared — a 3.8-flash outage detected by the classifier should also
make the extractor skip straight to fallback, not rediscover the outage
independently on its own next call.
"""
import time
import threading

PRIMARY_MODEL = "gemini-3.8-flash"
FALLBACK_MODEL = "gemini-2.5-flash"

FAILURE_THRESHOLD = 3          # consecutive primary failures before opening the breaker
COOLDOWN_SECONDS = 120         # how long to skip the primary model once open
RETRY_ATTEMPTS = 2             # attempts per model within a single call
RETRY_BACKOFF_BASE = 1.5       # seconds; attempt N waits RETRY_BACKOFF_BASE * (N + 1)

_lock = threading.Lock()
_consecutive_failures = 0
_breaker_open_until = 0.0  # epoch seconds; 0 means closed


def _is_transient(error: Exception) -> bool:
    text = str(error)
    return "503" in text or "UNAVAILABLE" in text or "RESOURCE_EXHAUSTED" in text


def _breaker_is_open() -> bool:
    return time.time() < _breaker_open_until


def _record_failure():
    global _consecutive_failures, _breaker_open_until
    with _lock:
        _consecutive_failures += 1
        if _consecutive_failures >= FAILURE_THRESHOLD:
            _breaker_open_until = time.time() + COOLDOWN_SECONDS
            print(f"Circuit breaker OPEN for {PRIMARY_MODEL}: {_consecutive_failures} "
                  f"consecutive failures. Skipping it for {COOLDOWN_SECONDS}s.")


def _record_success():
    global _consecutive_failures, _breaker_open_until
    with _lock:
        if _consecutive_failures > 0 or _breaker_open_until > 0:
            print(f"Circuit breaker CLOSED for {PRIMARY_MODEL}: call succeeded.")
        _consecutive_failures = 0
        _breaker_open_until = 0.0


def reset_breaker_for_testing():
    """Test-only helper — resets module-level breaker state between test cases."""
    global _consecutive_failures, _breaker_open_until
    with _lock:
        _consecutive_failures = 0
        _breaker_open_until = 0.0


def generate_with_resilience(client, contents, config) -> tuple:
    """Calls client.models.generate_content with retry, fallback, and circuit-breaker
    protection. Returns (response, model_used). Raises the last error only if every
    model and every attempt fails.
    """
    last_error = None
    models_to_try = [FALLBACK_MODEL] if _breaker_is_open() else [PRIMARY_MODEL, FALLBACK_MODEL]

    for model in models_to_try:
        for attempt in range(RETRY_ATTEMPTS):
            try:
                response = client.models.generate_content(model=model, contents=contents, config=config)
                if model == PRIMARY_MODEL:
                    _record_success()
                return response, model
            except Exception as e:
                last_error = e
                if model == PRIMARY_MODEL:
                    _record_failure()
                if _is_transient(e) and attempt < RETRY_ATTEMPTS - 1:
                    time.sleep(RETRY_BACKOFF_BASE * (attempt + 1))
                    continue
                break  # non-transient, or retries exhausted on this model -> try next model

    raise last_error
