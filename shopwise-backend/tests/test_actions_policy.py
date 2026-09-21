"""The action vocabulary and the ONE policy that governs which combinations may run (pure, no I/O)."""
import pytest
from actions import (
    ACTION_TYPES, EDIT_TYPES, TERMINAL_TYPES, MAX_ACTIONS, clean_actions, apply_policy, terminal_type,
)

T = 0.7


def A(type_, **kw):
    return {"type": type_, **kw}


SET = A("set_quantity", variant_id="v1", quantity=2)
ADD = A("add_item", variant_id="v2", quantity=1)
REMOVE = A("remove_item", variant_id="v1")
SWAP = A("swap_variant", from_variant_id="v1", to_variant_id="v3")
ASK, TALK, YES, NO, UNK = A("ask_question"), A("small_talk"), A("confirm_order"), A("cancel_order"), A("unknown")


def types(actions):
    return [a["type"] for a in actions]


# ---- vocabulary ---------------------------------------------------------------------------------
def test_vocabulary_is_small_and_closed():
    assert set(ACTION_TYPES) == {"set_quantity", "add_item", "remove_item", "swap_variant", "ask_question",
                                 "small_talk", "confirm_order", "cancel_order", "unknown"}
    assert len(ACTION_TYPES) == len(set(ACTION_TYPES)) <= 12


# ---- clean_actions: shape only ------------------------------------------------------------------
def test_clean_actions_accepts_every_action_type_and_keeps_only_known_params():
    raw = [SET, ADD, REMOVE, SWAP, ASK, TALK, YES, NO, UNK]
    assert clean_actions(raw) == raw


def test_extra_fields_are_dropped_so_a_price_cannot_be_smuggled_in():
    out = clean_actions([{"type": "set_quantity", "variant_id": "v1", "quantity": 2, "unit_price": 1, "total": 0}])
    assert out == [SET]


@pytest.mark.parametrize("raw", [
    None, "x", {}, [None], ["set_quantity"], [{"type": "delete_everything"}], [{"type": None}],
    [A("set_quantity", variant_id="v1")], [A("set_quantity", variant_id="v1", quantity=0)],
    [A("set_quantity", variant_id="v1", quantity=-1)], [A("set_quantity", variant_id="v1", quantity=1.5)],
    [A("set_quantity", variant_id="v1", quantity="2")], [A("set_quantity", variant_id="v1", quantity=True)],
    [A("set_quantity", variant_id="", quantity=1)], [A("set_quantity", variant_id=5, quantity=1)],
    [A("swap_variant", from_variant_id="a")], [A("remove_item")],
    [SET, {"type": "nope"}],                                   # all-or-nothing
])
def test_clean_actions_rejects_anything_malformed(raw):
    assert clean_actions(raw) is None


def test_clean_actions_accepts_an_empty_list():
    assert clean_actions([]) == []


# ---- apply_policy ------------------------------------------------------------------------------
@pytest.mark.parametrize("actions", [[], [UNK], [SET, UNK], [YES, UNK], [ASK, UNK], [SET] * (MAX_ACTIONS + 1)])
def test_nothing_unknown_or_too_many_becomes_ask(actions):
    assert apply_policy(actions, 0.99, T) == [UNK]


def test_state_changing_actions_need_confidence_but_questions_and_small_talk_do_not():
    for changing in ([SET], [YES], [NO], [SET, ASK], [REMOVE, ADD]):
        assert apply_policy(changing, 0.5, T) == [UNK], changing
        assert apply_policy(changing, 0.7, T) != [UNK], changing
    assert apply_policy([ASK], 0.1, T) == [ASK]
    assert apply_policy([TALK], 0.1, T) == [TALK]


def test_plain_confirm_or_cancel_passes_when_sure():
    assert apply_policy([YES], 0.95, T) == [YES]
    assert apply_policy([NO], 0.95, T) == [NO]


def test_yes_plus_other_actions_never_pays_the_rest_stands():
    assert apply_policy([YES, ASK], 0.95, T) == [ASK]                # "yes, and how much is delivery?"
    assert apply_policy([YES, SET], 0.95, T) == [SET]                # "yes but make it 2"
    assert types(apply_policy([YES, SET, ASK], 0.95, T)) == ["set_quantity", "ask_question"]
    assert apply_policy([YES, TALK], 0.95, T) == [TALK]


def test_cancel_plus_a_question_keeps_the_order_but_cancel_plus_anything_else_asks():
    assert apply_policy([NO, ASK], 0.95, T) == [ASK]
    assert apply_policy([NO, TALK], 0.95, T) == [TALK]
    assert apply_policy([NO, ADD], 0.95, T) == [UNK]                 # "cancel the candle and add a soap" is unclear
    assert apply_policy([NO, SET], 0.95, T) == [UNK]


def test_confirm_and_cancel_together_ask():
    assert apply_policy([YES, NO], 0.99, T) == [UNK]


def test_small_talk_is_dropped_when_real_actions_are_present_but_kept_alone():
    assert apply_policy([TALK, ASK], 0.95, T) == [ASK]
    assert apply_policy([TALK, SET], 0.95, T) == [SET]
    assert apply_policy([TALK], 0.95, T) == [TALK]


def test_multiple_questions_merge_into_one():
    assert apply_policy([ASK, ASK, ASK], 0.95, T) == [ASK]


def test_edits_pass_through_in_order_and_together_with_a_question():
    assert apply_policy([SET, ADD, REMOVE, SWAP], 0.95, T) == [SET, ADD, REMOVE, SWAP]
    assert apply_policy([SET, ASK], 0.95, T) == [SET, ASK]           # multi-intent, no special case


def test_policy_never_returns_an_empty_list_and_does_not_mutate_its_input():
    original = [SET, ASK, TALK]
    snapshot = [dict(a) for a in original]
    out = apply_policy(original, 0.95, T)
    assert out and original == snapshot


def test_every_action_type_survives_the_policy_on_its_own_or_asks():
    for t in ACTION_TYPES:
        a = {"type": t, "variant_id": "v1", "quantity": 1, "from_variant_id": "v1", "to_variant_id": "v3"}
        assert apply_policy([a], 0.95, T)   # non-empty for the whole vocabulary


# ---- terminal_type ---------------------------------------------------------------------------------
def test_terminal_type_only_for_a_lone_confirm_or_cancel():
    assert terminal_type([YES]) == "confirm_order"
    assert terminal_type([NO]) == "cancel_order"
    for other in ([SET], [ASK], [UNK], [TALK], [SET, ASK], [YES, ASK], []):
        assert terminal_type(other) is None
    assert set(TERMINAL_TYPES).isdisjoint(EDIT_TYPES)
