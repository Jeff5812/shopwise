"""
Shared fixtures for the classifier/extractor test suite.

Design: classify_message() and extract_order() are pure functions of
(text, catalog, history) -> dict once you hand them a genai client. We never
call the real Gemini API in tests — mock_genai_client patches classifier.client
and order_extractor.client directly, so tests run in milliseconds and are
deterministic regardless of model changes upstream.
"""
import json
import pytest
from unittest.mock import MagicMock


FIXED_CATALOG = [
    {
        "name": "Lavender Candle",
        "variants": [
            {"variant_id": "cand-lav-std", "attributes": {}, "price": 2500, "stock_quantity": 20},
        ],
    },
    {
        "name": "Ankara Gown",
        "variants": [
            {"variant_id": "gown-ank-s-blue", "attributes": {"size": "S", "color": "blue"}, "price": 15000, "stock_quantity": 5},
            {"variant_id": "gown-ank-m-blue", "attributes": {"size": "M", "color": "blue"}, "price": 15000, "stock_quantity": 5},
            {"variant_id": "gown-ank-m-red", "attributes": {"size": "M", "color": "red"}, "price": 15000, "stock_quantity": 3},
        ],
    },
    {
        "name": "Shea Soap",
        "variants": [
            {"variant_id": "soap-shea-std", "attributes": {}, "price": 1200, "stock_quantity": 50},
        ],
    },
]


def make_history(*turns):
    """turns: list of (direction, text) tuples, oldest first."""
    return [{"direction": d, "raw_text": t} for d, t in turns]


def _fake_response(payload: dict):
    resp = MagicMock()
    resp.text = json.dumps(payload)
    return resp


@pytest.fixture(autouse=True)
def _reset_circuit_breaker():
    """Circuit breaker state lives at module level in model_router.py and would
    otherwise leak between tests — reset it before every test runs."""
    from model_router import reset_breaker_for_testing
    reset_breaker_for_testing()
    yield
    reset_breaker_for_testing()


@pytest.fixture
def mock_classifier_client(monkeypatch):
    """Patch classifier.client.models.generate_content to return a canned payload.
    Usage: mock_classifier_client({"intent": "order", "confidence": 0.9})
    """
    import classifier

    def _install(payload):
        fake_client = MagicMock()
        fake_client.models.generate_content.return_value = _fake_response(payload)
        monkeypatch.setattr(classifier, "client", fake_client)
        return fake_client

    return _install


@pytest.fixture
def mock_extractor_client(monkeypatch):
    """Patch order_extractor.client.models.generate_content to return a canned payload."""
    import order_extractor

    def _install(payload):
        fake_client = MagicMock()
        fake_client.models.generate_content.return_value = _fake_response(payload)
        monkeypatch.setattr(order_extractor, "client", fake_client)
        return fake_client

    return _install
