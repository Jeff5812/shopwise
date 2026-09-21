"""
The small, CLOSED vocabulary of things a customer's message can ask for, and the ONE place that
decides which combinations of them are allowed.

Pure module: no I/O, no AI, no database. The AI proposes actions; this module checks their shape and
applies the safety policy; executors (action_executors.py) carry them out against the real order.

Adding a capability later means: add its type here (with its params), add one executor, done.
Nothing else in the conversation flow needs to know about it.
"""

# Changes to the pending order. Consecutive edits from one message run as ONE atomic order edit.
EDIT_TYPES = ("set_quantity", "add_item", "remove_item", "swap_variant")
# Irreversible / money-moving decisions. Handled by main.py's existing flow, never combined with anything else.
TERMINAL_TYPES = ("confirm_order", "cancel_order")
OTHER_TYPES = ("ask_question", "small_talk", "unknown")
ACTION_TYPES = EDIT_TYPES + TERMINAL_TYPES + OTHER_TYPES

# type -> required params (anything else the model sends is dropped, so it can't smuggle in a price)
_PARAMS = {
    "set_quantity": ("variant_id", "quantity"),
    "add_item": ("variant_id", "quantity"),
    "remove_item": ("variant_id",),
    "swap_variant": ("from_variant_id", "to_variant_id"),
    "ask_question": (),
    "small_talk": (),
    "confirm_order": (),
    "cancel_order": (),
    "unknown": (),
}
MAX_ACTIONS = 8


def _unknown():
    return {"type": "unknown"}


def clean_actions(raw):
    """Shape check only (business validation happens against the real order in the executors).
    Returns a list of cleaned actions, or None if anything is malformed. All-or-nothing."""
    if not isinstance(raw, list):
        return None
    cleaned = []
    for action in raw:
        if not isinstance(action, dict) or action.get("type") not in _PARAMS:
            return None
        item = {"type": action["type"]}
        for field in _PARAMS[action["type"]]:
            value = action.get(field)
            if field == "quantity":
                if isinstance(value, bool) or not isinstance(value, int) or value < 1:
                    return None
            elif not isinstance(value, str) or not value:
                return None
            item[field] = value
        cleaned.append(item)
    return cleaned


def apply_policy(actions: list, confidence: float, threshold: float) -> list:
    """The single place that decides what a set of proposed actions is allowed to become.
    Always returns a non-empty list. When in doubt the answer is [unknown], which asks the customer.

      * nothing / too many / any 'unknown'            -> [unknown]
      * a state-changing action with low confidence   -> [unknown]   (only act when sure)
      * confirm_order + other actions                 -> the other actions (the order stays pending;
                                                          "yes, and how much is delivery?" must never pay)
      * cancel_order + only questions/small talk      -> the questions (never drop an order alongside a question)
      * cancel_order + anything else, or confirm+cancel -> [unknown]
      * small_talk alongside real actions             -> dropped
      * several ask_question                          -> merged into one
    """
    if not actions or len(actions) > MAX_ACTIONS:
        return [_unknown()]
    types = [a["type"] for a in actions]
    if "unknown" in types:
        return [_unknown()]
    state_changing = any(t in EDIT_TYPES or t in TERMINAL_TYPES for t in types)
    if state_changing and confidence < threshold:
        return [_unknown()]

    terminals = [a for a in actions if a["type"] in TERMINAL_TYPES]
    rest = [a for a in actions if a["type"] not in TERMINAL_TYPES]
    if terminals:
        if len({a["type"] for a in terminals}) > 1:
            return [_unknown()]
        if rest:
            if terminals[0]["type"] == "confirm_order":
                actions = rest
            elif all(a["type"] in ("ask_question", "small_talk") for a in rest):
                actions = rest
            else:
                return [_unknown()]
        else:
            return [terminals[0]]

    if any(a["type"] != "small_talk" for a in actions):
        actions = [a for a in actions if a["type"] != "small_talk"]
    seen_question = False
    merged = []
    for a in actions:
        if a["type"] == "ask_question":
            if seen_question:
                continue
            seen_question = True
        merged.append(a)
    return merged or [_unknown()]


def terminal_type(actions: list):
    """'confirm_order' / 'cancel_order' when that is the message's ONLY action (policy guarantees it is
    never mixed with others), else None."""
    if len(actions) == 1 and actions[0]["type"] in TERMINAL_TYPES:
        return actions[0]["type"]
    return None
