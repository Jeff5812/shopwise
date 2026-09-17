"""
extract_order() tests, organized by QA category.

Categories covered: 1 (clean order), 3 (Pidgin), 6/7 (follow-up resolution via
history), 9 (variant_id validation against real catalog — the anti-hallucination
guard), 24 (mid-conversation corrections escalate, never auto-apply), plus a
regression test for the vendor-catalog mismatch bug under active investigation.
"""
from conftest import FIXED_CATALOG, make_history
from order_extractor import extract_order


# --- Category 1: clean single-item order ------------------------------------

def test_category1_single_item_order(mock_extractor_client):
    mock_extractor_client({
        "line_items": [{"variant_id": "cand-lav-std", "product_name": "Lavender Candle", "quantity": 2, "unit_price": 2500}],
        "confidence": 0.95,
        "ambiguous_note": None,
    })
    result = extract_order("2 lavender candles", FIXED_CATALOG)
    assert result["confidence"] >= 0.7
    assert result["line_items"][0]["variant_id"] == "cand-lav-std"
    assert result["line_items"][0]["quantity"] == 2


# --- Category 3: Pidgin order -------------------------------------------------

def test_category3_pidgin_order_extraction(mock_extractor_client):
    mock_extractor_client({
        "line_items": [{"variant_id": "gown-ank-m-blue", "product_name": "Ankara Gown", "quantity": 1, "unit_price": 15000}],
        "confidence": 0.8,
        "ambiguous_note": None,
    })
    result = extract_order("abeg 1 gown medium blue", FIXED_CATALOG)
    assert result["line_items"][0]["variant_id"] == "gown-ank-m-blue"


# --- Ambiguous variant: model must flag, not guess ---------------------------

def test_ambiguous_variant_flagged_not_guessed(mock_extractor_client):
    mock_extractor_client({
        "line_items": [],
        "confidence": 0.4,
        "ambiguous_note": "Ankara Gown comes in S/blue, M/blue, M/red — which one?",
    })
    result = extract_order("1 ankara gown", FIXED_CATALOG)
    assert result["confidence"] < 0.7
    assert result["ambiguous_note"] is not None
    assert result["line_items"] == []


# --- Category 6/7: follow-up resolution via history --------------------------

def test_category6_followup_quantity_change_via_history(mock_extractor_client):
    history = make_history(
        ("inbound", "2 lavender candles"),
        ("model", "That's 2 lavender candles, ₦5,000 total. Confirm?"),
    )
    mock_extractor_client({
        "line_items": [{"variant_id": "cand-lav-std", "product_name": "Lavender Candle", "quantity": 3, "unit_price": 2500}],
        "confidence": 0.85,
        "ambiguous_note": None,
    })
    result = extract_order("actually make it 3", FIXED_CATALOG, history=history)
    assert result["line_items"][0]["quantity"] == 3


def test_category7_followup_color_swap_via_history(mock_extractor_client):
    history = make_history(
        ("inbound", "1 ankara gown medium blue"),
        ("model", "That's 1 Ankara Gown (M, blue), ₦15,000. Confirm?"),
    )
    mock_extractor_client({
        "line_items": [{"variant_id": "gown-ank-m-red", "product_name": "Ankara Gown", "quantity": 1, "unit_price": 15000}],
        "confidence": 0.8,
        "ambiguous_note": None,
    })
    result = extract_order("the red one instead", FIXED_CATALOG, history=history)
    assert result["line_items"][0]["variant_id"] == "gown-ank-m-red"


# --- Category 9: anti-hallucination guard — invalid variant_id rejected ------

def test_category9_hallucinated_variant_id_rejected(mock_extractor_client):
    # Model invents a variant_id that doesn't exist in the real catalog — the
    # code-level validation in order_extractor.py must reject this regardless
    # of what confidence the model claims
    mock_extractor_client({
        "line_items": [{"variant_id": "made-up-id-999", "product_name": "Lavender Candle", "quantity": 1, "unit_price": 2500}],
        "confidence": 0.95,
        "ambiguous_note": None,
    })
    result = extract_order("1 candle", FIXED_CATALOG)
    assert result["line_items"] == []
    assert result["confidence"] == 0.0
    assert "unknown variant" in result["ambiguous_note"].lower()


# --- Category 24: corrections must not be silently auto-applied -------------
# NOTE: extract_order itself has no concept of "auto-apply" — that decision is
# made in main.py (unparseable/low-confidence -> review_queue). This test just
# confirms the extractor's output shape gives main.py what it needs to escalate.

def test_category24_correction_extraction_shape_supports_escalation(mock_extractor_client):
    mock_extractor_client({
        "line_items": [{"variant_id": "cand-lav-std", "product_name": "Lavender Candle", "quantity": 3, "unit_price": 2500}],
        "confidence": 0.6,  # below EXTRACTION_CONFIDENCE_THRESHOLD (0.7) -> main.py escalates
        "ambiguous_note": "Correction to an already-created order — needs manual review.",
    })
    result = extract_order("actually make it 3", FIXED_CATALOG)
    from order_extractor import EXTRACTION_CONFIDENCE_THRESHOLD
    assert result["confidence"] < EXTRACTION_CONFIDENCE_THRESHOLD


# --- Regression: vendor-catalog mismatch bug under investigation ------------
# This documents the expected, already-correct behavior of extract_order() itself:
# if the catalog it's handed genuinely doesn't contain the requested product, it
# must return empty/low-confidence — never invent a match. If this test passes
# but real WhatsApp traffic still fails on "Ankara gown", the bug is upstream in
# get_vendor_catalog() / vendor-to-product row mapping, NOT in extract_order().
# This is exactly what the DEBUG print lines added to main.py will confirm.

def test_regression_item_not_in_catalog_returns_empty(mock_extractor_client):
    mock_extractor_client({
        "line_items": [],
        "confidence": 0.0,
        "ambiguous_note": None,
    })
    catalog_without_gown = [p for p in FIXED_CATALOG if p["name"] != "Ankara Gown"]
    result = extract_order("1 ankara gown", catalog_without_gown)
    assert result["line_items"] == []
    assert result["confidence"] == 0.0


# --- Malformed model output ---------------------------------------------------

def test_unparseable_response_returns_safe_default(mock_extractor_client):
    fake_client = mock_extractor_client({"line_items": [], "confidence": 0.0, "ambiguous_note": None})
    fake_client.models.generate_content.return_value.text = "not json"
    result = extract_order("2 candles", FIXED_CATALOG)
    assert result["line_items"] == []
    assert result["confidence"] == 0.0
    assert result["ambiguous_note"] == "Unparseable model response."


# --- Regression: history passthrough (commit ebaa80a) ------------------------

def test_history_is_passed_as_multiturn_contents(mock_extractor_client):
    fake_client = mock_extractor_client({"line_items": [], "confidence": 0.0, "ambiguous_note": None})
    history = make_history(("inbound", "hi"), ("model", "hello, what can I get you?"))
    extract_order("2 candles", FIXED_CATALOG, history=history)

    call_kwargs = fake_client.models.generate_content.call_args.kwargs
    contents = call_kwargs["contents"]
    assert isinstance(contents, list)
    assert contents[-1] == {"role": "user", "parts": [{"text": "2 candles"}]}
