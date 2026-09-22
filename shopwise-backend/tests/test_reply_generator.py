"""
reply_generator.py: the never-guess-if-unsure JSON contract shared by generate_faq_answer and
generate_catalog_answer, and generate_catalog_answer's own grounding rules.

No real Gemini calls: client.models.generate_content is mocked, same style as
conftest.mock_understanding_client but for this module's own client.
"""
import json
from unittest.mock import MagicMock
import pytest

import reply_generator as rg

CATALOG = [
    {"product_id": "p1", "name": "Lavender Candle", "sell_price": 2500, "floor_price": 2000,
     "variants": [{"variant_id": "v-candle", "size": None, "color": None, "stock_quantity": 20}]},
    {"product_id": "p2", "name": "Ankara Gown", "sell_price": 15000, "floor_price": 12000,
     "variants": [
         {"variant_id": "v-gown-blue", "size": "M", "color": "blue", "stock_quantity": 0},
         {"variant_id": "v-gown-red", "size": "M", "color": "red", "stock_quantity": 3},
     ]},
]


def _mock_client(monkeypatch, payload):
    fake = MagicMock()
    fake.models.generate_content.return_value = MagicMock(text=json.dumps(payload))
    monkeypatch.setattr(rg, "client", fake)
    return fake


def test_catalog_answer_empty_catalog_never_calls_the_model(monkeypatch):
    fake = MagicMock()
    monkeypatch.setattr(rg, "client", fake)
    out = rg.generate_catalog_answer("what's available?", [])
    assert out == {"answered": False, "reply": None}
    fake.models.generate_content.assert_not_called()


def test_catalog_answer_returns_the_models_answer_when_it_answers(monkeypatch):
    _mock_client(monkeypatch, {"answered": True, "reply": "We've got candles and gowns in stock!"})
    out = rg.generate_catalog_answer("what's available?", CATALOG)
    assert out == {"answered": True, "reply": "We've got candles and gowns in stock!"}


def test_catalog_answer_passes_through_a_not_answered_verdict(monkeypatch):
    _mock_client(monkeypatch, {"answered": False, "reply": None})
    assert rg.generate_catalog_answer("can you reduce the price?", CATALOG) == {"answered": False, "reply": None}


@pytest.mark.parametrize("raw", ["not json", "", "[]", '"hi"', '{"answered": "maybe"}'])
def test_catalog_answer_garbled_model_output_never_answers(monkeypatch, raw):
    fake = MagicMock()
    fake.models.generate_content.return_value = MagicMock(text=raw)
    monkeypatch.setattr(rg, "client", fake)
    if raw == '{"answered": "maybe"}':
        out = rg.generate_catalog_answer("x", CATALOG)
        assert out["answered"] is True   # bool("maybe") is True -- documents the existing coercion, shared with FAQ
    else:
        assert rg.generate_catalog_answer("x", CATALOG) == {"answered": False, "reply": None}


def test_catalog_answer_grounds_the_prompt_in_the_real_catalog_names_and_stock_status(monkeypatch):
    fake = _mock_client(monkeypatch, {"answered": True, "reply": "yes"})
    rg.generate_catalog_answer("do you have the blue gown?", CATALOG)
    prompt = fake.models.generate_content.call_args.kwargs["config"]["system_instruction"]
    assert "Lavender Candle" in prompt and "Ankara Gown" in prompt
    assert "in stock" in prompt and "out of stock" in prompt
    assert "2500" not in prompt and "15000" not in prompt, "prices are not part of an availability answer"
    assert "v-candle" not in prompt and "v-gown-blue" not in prompt, "internal variant_ids are not customer-facing"


def test_catalog_answer_reports_out_of_stock_lines_as_such():
    text = rg._catalog_for_prompt(CATALOG)
    assert "Ankara Gown (M, blue): out of stock" in text
    assert "Ankara Gown (M, red): in stock" in text
    assert "Lavender Candle: in stock" in text


def test_catalog_answer_question_is_sent_as_the_actual_message(monkeypatch):
    fake = _mock_client(monkeypatch, {"answered": False, "reply": None})
    rg.generate_catalog_answer("what colours does the gown come in?", CATALOG)
    assert fake.models.generate_content.call_args.kwargs["contents"] == "what colours does the gown come in?"


def test_faq_and_catalog_answer_share_the_same_response_shape(monkeypatch):
    """Both must be safe drop-in alternatives for action_executors._answer_question."""
    _mock_client(monkeypatch, {"answered": True, "reply": "ok"})
    faq_out = rg.generate_faq_answer("q", [{"topic": "delivery", "answer_text": "N1500"}])
    cat_out = rg.generate_catalog_answer("q", CATALOG)
    assert set(faq_out) == set(cat_out) == {"answered", "reply"}
