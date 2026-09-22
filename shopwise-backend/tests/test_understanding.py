"""
understand() tests: shape, safety, and the no-pending vs pending-order contract.

Deliberately NOT the 158-scenario eval bank — that stays a manual/live-trial tool per the
user's call. These are the same kind of fast, mocked, deterministic tests the old
classifier.py/order_extractor.py suites used, just against the one merged module.
"""
from conftest import make_history, make_state
from understanding import understand


def types(result):
    return [a["type"] for a in result["actions"]]


# --- No pending order: items always start a new order -------------------------------------

def test_no_pending_add_item(mock_understanding_client):
    mock_understanding_client({
        "actions": [{"type": "add_item", "variant_id": "gown-ank-m-blue", "quantity": 2}],
        "confidence": 0.9, "note": None,
    })
    result = understand("I want two blue gowns", make_state())
    assert types(result) == ["add_item"]


def test_no_pending_small_talk(mock_understanding_client):
    mock_understanding_client({"actions": [{"type": "small_talk"}], "confidence": 0.95, "note": None})
    result = understand("Hi there good morning", make_state())
    assert types(result) == ["small_talk"]


def test_no_pending_confirm_is_stripped_even_if_model_sends_it(mock_understanding_client):
    # Code decides, not the prompt alone: confirm is meaningless with nothing waiting right now.
    mock_understanding_client({"actions": [{"type": "confirm_order"}], "confidence": 0.9, "note": None})
    result = understand("yes", make_state())
    assert types(result) == ["unknown"]


def test_no_pending_cancel_is_preserved_for_the_executor_to_resolve(mock_understanding_client):
    # Unlike confirm, cancel may refer to an order outside this state's view (older than the
    # 30-minute "fresh pending" window) — the executor looks it up, not this module.
    mock_understanding_client({"actions": [{"type": "cancel_order"}], "confidence": 0.9, "note": None})
    result = understand("please cancel my order", make_state())
    assert types(result) == ["cancel_order"]


# --- Pending order: corrections, confirm/cancel, compound messages -------------------------

def test_pending_set_quantity(mock_understanding_client):
    mock_understanding_client({
        "actions": [{"type": "set_quantity", "variant_id": "cand-lav-std", "quantity": 3}],
        "confidence": 0.9, "note": None,
    })
    state = make_state(pending_order={"id": "order-1", "status": "awaiting_confirmation"},
                        lines=[{"variant_id": "cand-lav-std", "product_name": "Lavender Candle", "quantity": 2}])
    result = understand("actually make it three", state)
    assert types(result) == ["set_quantity"]
    assert result["actions"][0]["quantity"] == 3


def test_pending_confirm(mock_understanding_client):
    mock_understanding_client({"actions": [{"type": "confirm_order"}], "confidence": 0.95, "note": None})
    state = make_state(pending_order={"id": "order-1", "status": "awaiting_confirmation"})
    result = understand("yes", state)
    assert types(result) == ["confirm_order"]


def test_pending_confirm_plus_question_never_pays_the_question_wins(mock_understanding_client):
    mock_understanding_client({
        "actions": [{"type": "confirm_order"}, {"type": "ask_question"}],
        "confidence": 0.9, "note": None,
    })
    state = make_state(pending_order={"id": "order-1", "status": "awaiting_confirmation"})
    result = understand("yes, and how much is delivery?", state)
    assert types(result) == ["ask_question"]


def test_pending_compound_change_and_question(mock_understanding_client):
    mock_understanding_client({
        "actions": [
            {"type": "set_quantity", "variant_id": "cand-lav-std", "quantity": 2},
            {"type": "ask_question"},
        ],
        "confidence": 0.9, "note": None,
    })
    state = make_state(pending_order={"id": "order-1", "status": "awaiting_confirmation"},
                        lines=[{"variant_id": "cand-lav-std", "product_name": "Lavender Candle", "quantity": 1}])
    result = understand("Make it 2 and can I pick up?", state)
    assert types(result) == ["set_quantity", "ask_question"]


def test_pending_pidgin_set_quantity(mock_understanding_client):
    mock_understanding_client({
        "actions": [{"type": "set_quantity", "variant_id": "cand-lav-std", "quantity": 2}],
        "confidence": 0.85, "note": None,
    })
    state = make_state(pending_order={"id": "order-1", "status": "awaiting_confirmation"},
                        lines=[{"variant_id": "cand-lav-std", "product_name": "Lavender Candle", "quantity": 1}])
    result = understand("Abeg make am 2", state)
    assert types(result) == ["set_quantity"]


# --- Low confidence on a state-changing action always asks instead of guessing -------------

def test_low_confidence_state_change_becomes_unknown(mock_understanding_client):
    mock_understanding_client({
        "actions": [{"type": "set_quantity", "variant_id": "cand-lav-std", "quantity": 2}],
        "confidence": 0.4, "note": "not sure which item",
    })
    state = make_state(pending_order={"id": "order-1", "status": "awaiting_confirmation"},
                        lines=[{"variant_id": "cand-lav-std", "product_name": "Lavender Candle", "quantity": 1}])
    result = understand("make it 2", state)
    assert types(result) == ["unknown"]


def test_low_confidence_question_still_answered_confidence_only_gates_state_changes(mock_understanding_client):
    mock_understanding_client({"actions": [{"type": "ask_question"}], "confidence": 0.2, "note": None})
    result = understand("do you deliver to Lekki?", make_state())
    assert types(result) == ["ask_question"]


# --- Malformed model output never guesses ---------------------------------------------------

def test_unparseable_response_is_unknown(mock_understanding_client):
    fake_client = mock_understanding_client({"actions": [{"type": "add_item"}], "confidence": 0.9, "note": None})
    fake_client.models.generate_content.return_value.text = "not json at all"
    result = understand("2 candles", make_state())
    assert result == {"actions": [{"type": "unknown"}], "confidence": 0.0, "note": None}


def test_malformed_actions_shape_is_unknown(mock_understanding_client):
    mock_understanding_client({"actions": "not a list", "confidence": 0.9, "note": "hmm"})
    result = understand("2 candles", make_state())
    assert types(result) == ["unknown"]


def test_single_action_dict_instead_of_list_is_tolerated(mock_understanding_client):
    mock_understanding_client({"actions": {"type": "small_talk"}, "confidence": 0.9, "note": None})
    result = understand("thanks!", make_state())
    assert types(result) == ["small_talk"]


def test_unknown_variant_id_type_is_still_shape_checked_by_actions_module(mock_understanding_client):
    # actions.clean_actions() rejects a non-string variant_id outright — proves understanding.py
    # is actually delegating to it, not silently trusting the model's fields.
    mock_understanding_client({
        "actions": [{"type": "add_item", "variant_id": 5, "quantity": 1}],
        "confidence": 0.9, "note": None,
    })
    result = understand("2 candles", make_state())
    assert types(result) == ["unknown"]


# --- History passthrough (same contract classifier.py/order_extractor.py already had) ------

def test_history_is_passed_as_multiturn_contents(mock_understanding_client):
    fake_client = mock_understanding_client({"actions": [{"type": "small_talk"}], "confidence": 0.9, "note": None})
    history = make_history(("inbound", "hi"), ("model", "hello, what can I get you?"))
    understand("thanks", make_state(history=history))

    call_kwargs = fake_client.models.generate_content.call_args.kwargs
    contents = call_kwargs["contents"]
    assert isinstance(contents, list)
    assert contents[0] == {"role": "user", "parts": [{"text": "hi"}]}
    assert contents[1] == {"role": "model", "parts": [{"text": "hello, what can I get you?"}]}
    assert contents[-1] == {"role": "user", "parts": [{"text": "thanks"}]}


def test_no_history_falls_back_to_plain_string(mock_understanding_client):
    fake_client = mock_understanding_client({"actions": [{"type": "small_talk"}], "confidence": 0.9, "note": None})
    understand("thanks", make_state(history=None))
    call_kwargs = fake_client.models.generate_content.call_args.kwargs
    assert call_kwargs["contents"] == "thanks"
