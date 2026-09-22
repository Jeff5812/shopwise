"""
Executors for the closed action vocabulary in actions.py.

understanding.py only reports what the customer means; this module is where that becomes a
real effect. Division of labour, same as the old pending_order_handler.py had:

    understanding.py (AI)      -> proposes actions, referencing catalog variant_ids only
    actions.py        (pure)   -> shape-checks + decides which combination is allowed to run
    action_executors.py (this) -> re-validates against the REAL order/catalog and does the work
    db.py             (I/O)    -> the actual Supabase reads/writes, RPCs, stock/price truth

Only main.py calls this module, and only for a NON-terminal action list. A lone confirm_order
or cancel_order (actions.terminal_type() returns non-None) is handled by main.py itself, using
the existing payment flow — that flow is untouched by this refactor. By the time execute() runs,
actions.apply_policy() has already guaranteed confirm_order/cancel_order cannot appear mixed
with anything else, so this module never has to think about payment.

    edits present, no order pending  -> start a new order (create_order)
    edits present, order pending     -> revise the SAME order in place (replace_order_items)
    ask_question                     -> answer from FAQ data, then the real catalog (availability),
                                         mention the pending order if any
    small_talk                       -> friendly reply, mention the pending order if any
    anything else / unknown          -> ask / flag to review_queue, never guess

A second action alongside edits (a question) is answered in the same reply as the order
summary — this is the "also_question" behaviour the old pending_understanding.py had, now
available whether or not an order was already pending.
"""
from db import (
    get_vendor_catalog,
    get_faq_snippets,
    get_order_items,
    replace_order_items,
    create_order,
    add_to_review_queue,
    update_message_classification,
    InsufficientStockError,
    OrderNotEditableError,
)
from catalog_index import variant_index, variant_label
from reply_generator import generate_order_confirmation, generate_faq_answer, generate_catalog_answer
from actions import EDIT_TYPES

PENDING_REMINDER = "Your order is still waiting: reply 'yes' to confirm or 'no' to cancel."


class InvalidActions(ValueError):
    """The proposed edit actions don't make sense against the real order/catalog. Nothing applied."""


def _valid_qty(q) -> bool:
    return isinstance(q, int) and not isinstance(q, bool) and q >= 1


def apply_edits(current: dict, edits: list, index: dict) -> dict:
    """Pure function: the customer's edit actions applied to {variant_id: quantity} (insertion
    order preserved). All-or-nothing: any action that doesn't fit the real order/catalog raises
    InvalidActions and nothing is used. Only lines named by an action can change."""
    lines = dict(current)
    try:
        for action in edits:
            kind = action["type"]
            if kind == "set_quantity":
                if action["variant_id"] not in lines or not _valid_qty(action["quantity"]):
                    raise InvalidActions(action)
                lines[action["variant_id"]] = action["quantity"]
            elif kind == "add_item":
                if action["variant_id"] not in index or not _valid_qty(action["quantity"]):
                    raise InvalidActions(action)
                lines[action["variant_id"]] = lines.get(action["variant_id"], 0) + action["quantity"]
            elif kind == "remove_item":
                if action["variant_id"] not in lines:
                    raise InvalidActions(action)
                del lines[action["variant_id"]]
            elif kind == "swap_variant":
                src, dst = action["from_variant_id"], action["to_variant_id"]
                if src not in lines or src not in index or dst not in index or src == dst:
                    raise InvalidActions(action)
                if index[src]["product_id"] != index[dst]["product_id"]:
                    raise InvalidActions(action)  # a swap stays within one product
                swapped = {}
                for k, q in lines.items():
                    target = dst if k == src else k
                    swapped[target] = swapped.get(target, 0) + q
                lines = swapped
            else:
                raise InvalidActions(action)
    except (KeyError, TypeError, AttributeError) as e:
        raise InvalidActions(f"malformed action: {e!r}") from e
    return lines


def validate_lines(raw_map: dict, index: dict):
    """{variant_id: quantity} -> RPC-ready line items, price always taken from the catalog,
    never the model. Returns None if anything is off (shouldn't happen post apply_edits, since
    it only ever touches ids already checked against index — never trust silently anyway)."""
    items = []
    for variant_id, qty in raw_map.items():
        if variant_id not in index or not _valid_qty(qty):
            return None
        items.append({
            "variant_id": variant_id,
            "quantity": qty,
            "unit_price": index[variant_id]["unit_price"],
            "product_name": variant_label(index[variant_id]),
        })
    return items


def _classify(message_id, intent, confidence):
    try:
        update_message_classification(message_id, intent, confidence)
    except Exception as e:
        print("Executor classification bookkeeping failed:", e)


def _flag(message_id, reason):
    try:
        add_to_review_queue(message_id, reason=reason)
    except Exception as e:
        print("Executor review_queue bookkeeping failed:", e)


def _answer_question(text, vendor_id, catalog, message_id):
    """Answers from the vendor's own grounded data, trying FAQ/policy first (delivery, returns,
    payment) then the real product catalog (availability/stock) -- these are two different
    questions with two different data sources, not one "ask_question" answered from a single
    place. Returns None (and flags for the seller) only when NEITHER source can answer, so we
    still never guess."""
    try:
        faq_result = generate_faq_answer(text, get_faq_snippets(vendor_id))
    except Exception as e:
        print("FAQ answering failed:", e)
        faq_result = {"answered": False, "reply": None}
    if faq_result["answered"] and faq_result["reply"]:
        return faq_result["reply"]

    try:
        catalog_result = generate_catalog_answer(text, catalog)
    except Exception as e:
        print("Catalog answering failed:", e)
        catalog_result = {"answered": False, "reply": None}
    if catalog_result["answered"] and catalog_result["reply"]:
        return catalog_result["reply"]

    _flag(message_id, reason="unparseable")
    return None


def _confirmation_text(line_items, total, prefix=""):
    try:
        return generate_order_confirmation(line_items, total)
    except Exception as e:
        print("Confirmation generation failed, using plain fallback:", e)
        items_text = ", ".join(f"{i['quantity']} x {i['product_name']}" for i in line_items)
        return f"{prefix}That's {items_text}, coming to \u20a6{total:.0f} total. Shall I confirm this for you?"


# ---------------------------------------------------------------------------------------------
# Edits: no order pending -> start one. Order pending -> revise it in place.
# ---------------------------------------------------------------------------------------------
async def _execute_new_order(edits, *, text, confidence, catalog, vendor, customer, wa_id, message_id, reply, also_question):
    if any(a["type"] != "add_item" for a in edits):
        # Nothing to set_quantity/remove/swap when there's no order yet — the model got
        # confused about state; ask instead of guessing what it meant.
        _classify(message_id, "unclassified", 0.0)
        _flag(message_id, reason="unparseable")
        await reply(vendor["id"], customer["id"], wa_id,
                    "I want to get your order exactly right. What would you like, and how many? "
                    "(something like '2 lavender candles' works perfectly)")
        return {"status": "new_order_unclear"}

    try:
        index = variant_index(get_vendor_catalog(vendor["id"]))
    except Exception as e:
        print("Catalog lookup failed for new order:", e)
        _flag(message_id, reason="unhandled_error")
        await reply(vendor["id"], customer["id"], wa_id,
                    "I hit a snag looking that up. Give me a moment and try again.")
        return {"status": "new_order_lookup_failed"}

    merged = {}
    for a in edits:
        if a["variant_id"] not in index:
            _classify(message_id, "unclassified", 0.0)
            _flag(message_id, reason="unparseable")
            await reply(vendor["id"], customer["id"], wa_id,
                        "I couldn't match that to something in stock. Could you tell me exactly "
                        "what you'd like?")
            return {"status": "new_order_unknown_variant"}
        merged[a["variant_id"]] = merged.get(a["variant_id"], 0) + a["quantity"]

    line_items = validate_lines(merged, index)
    if not line_items:
        _classify(message_id, "unclassified", 0.0)
        _flag(message_id, reason="unparseable")
        await reply(vendor["id"], customer["id"], wa_id,
                    "I want to get your order exactly right. What would you like, and how many?")
        return {"status": "new_order_unclear"}

    try:
        order = create_order(vendor["id"], customer["id"], line_items, message_id)
    except InsufficientStockError as e:
        print("Order rejected, insufficient stock:", e)
        _flag(message_id, reason="insufficient_stock")
        await reply(vendor["id"], customer["id"], wa_id,
                    "Sorry, I don't have enough of that in stock right now. I've let the seller "
                    "know in case more is coming, but I can't confirm that order yet.")
        return {"status": "insufficient_stock"}
    except Exception as e:
        print("create_order failed:", e)
        _flag(message_id, reason="unhandled_error")
        await reply(vendor["id"], customer["id"], wa_id,
                    "I hit a snag placing that order. I've flagged it for the seller.")
        return {"status": "new_order_failed"}

    _classify(message_id, "order", confidence)
    summary = _confirmation_text(line_items, order["total_amount"])
    if also_question:
        answer = _answer_question(text, vendor["id"], catalog, message_id)
        summary += f"\n\n{answer}" if answer else "\n\nI've also passed your question on to the seller."

    await reply(vendor["id"], customer["id"], wa_id, summary)
    return {"status": "new_order_created", "order_id": order["id"]}


async def _execute_correction(edits, *, text, pending_order, confidence, note, catalog, vendor, customer,
                              wa_id, message_id, reply, also_question):
    order_id = pending_order["id"]

    async def ask_to_clarify(hint):
        _classify(message_id, "unclassified", 0.0)
        _flag(message_id, reason="unparseable")
        lead = f"{hint} " if hint else "I want to get this change exactly right. What would you like to change? "
        await reply(vendor["id"], customer["id"], wa_id, f"{lead}{PENDING_REMINDER}")
        return {"status": "pending_order_correction_unclear", "order_id": order_id}

    try:
        index = variant_index(get_vendor_catalog(vendor["id"]))
        current_rows = get_order_items(order_id)
    except Exception as e:
        print("Correction lookup failed:", e)
        return await ask_to_clarify(None)

    current = {}
    for r in current_rows:
        current[r["product_variant_id"]] = current.get(r["product_variant_id"], 0) + r["quantity"]

    try:
        revised_map = apply_edits(current, edits, index)
    except InvalidActions as e:
        print("Correction actions rejected:", e)
        return await ask_to_clarify(note)

    if not revised_map:
        # Never auto-cancel on a guess. Keep the order and let them decide.
        _classify(message_id, "order", confidence)
        await reply(vendor["id"], customer["id"], wa_id,
                    "That would leave your order empty. Reply 'no' if you'd like to cancel it, "
                    "or tell me what you'd like instead.")
        return {"status": "pending_order_correction_would_empty", "order_id": order_id}

    if revised_map == current:
        _classify(message_id, "order", confidence)
        await reply(vendor["id"], customer["id"], wa_id, f"That's already how your order is. {PENDING_REMINDER}")
        return {"status": "pending_order_correction_no_change", "order_id": order_id}

    revised = validate_lines(revised_map, index)
    if not revised:
        return await ask_to_clarify(note)

    try:
        updated = replace_order_items(order_id, revised)
    except InsufficientStockError as e:
        print("Correction rejected, insufficient stock:", e)
        _flag(message_id, reason="insufficient_stock")
        await reply(vendor["id"], customer["id"], wa_id,
                    "Sorry, I don't have enough in stock for that change, so your order stays as "
                    f"it was. {PENDING_REMINDER}")
        return {"status": "pending_order_correction_insufficient_stock", "order_id": order_id}
    except OrderNotEditableError as e:
        print("Correction rejected, order no longer editable:", e)
        _flag(message_id, reason="unhandled_error")
        await reply(vendor["id"], customer["id"], wa_id,
                    "That order has already moved forward, so I can't change it here. I've let "
                    "the seller know so they can help.")
        return {"status": "pending_order_not_editable", "order_id": order_id}
    except Exception as e:
        # The RPC is atomic: on any failure the original order is exactly as it was.
        print("replace_order_items failed:", e)
        _flag(message_id, reason="unhandled_error")
        await reply(vendor["id"], customer["id"], wa_id,
                    f"I hit a snag updating that, so your order stays as it was. {PENDING_REMINDER}")
        return {"status": "pending_order_correction_failed", "order_id": order_id}

    _classify(message_id, "order", confidence)
    total = (updated[0] if isinstance(updated, list) else updated)["total_amount"]
    summary = _confirmation_text(revised, total, prefix="Updated! ")
    if also_question:
        answer = _answer_question(text, vendor["id"], catalog, message_id)
        summary += f"\n\n{answer}" if answer else "\n\nI've also passed your question on to the seller."

    # Deliberately NOT confirmed: they must answer yes to the updated order.
    await reply(vendor["id"], customer["id"], wa_id, summary)
    return {"status": "pending_order_corrected", "order_id": order_id}


# ---------------------------------------------------------------------------------------------
# Non-edit actions. Same behaviour with or without a pending order, just with/without the reminder.
# ---------------------------------------------------------------------------------------------
async def _execute_question(*, text, vendor, customer, wa_id, message_id, reply, pending_order, catalog):
    answer = _answer_question(text, vendor["id"], catalog, message_id)
    _classify(message_id, "question", 1.0)
    tail = f" {PENDING_REMINDER}" if pending_order else ""
    if answer:
        await reply(vendor["id"], customer["id"], wa_id, f"{answer}{tail}")
        return {"status": "question_answered"}
    await reply(vendor["id"], customer["id"], wa_id,
                f"Good question. Let me check with the seller and get back to you.{tail}")
    return {"status": "question_escalated"}


def _small_talk_reply(text: str, pending_order) -> str:
    lowered = text.lower()
    if any(w in lowered for w in ("thank", "thanks", "thx", "tnx")):
        opener = "You're welcome!"
    elif any(lowered.startswith(w) for w in ("hi", "hello", "hey", "good morning", "good afternoon", "good evening")):
        opener = "Hi there!" if pending_order else "Hi there! What can I help you find today?"
    else:
        opener = "No problem!" if pending_order else "Hey! What can I help you find today?"
    return f"{opener} {PENDING_REMINDER}" if pending_order else opener


async def _execute_small_talk(*, text, vendor, customer, wa_id, message_id, reply, pending_order):
    _classify(message_id, "noise", 1.0)
    await reply(vendor["id"], customer["id"], wa_id, _small_talk_reply(text, pending_order))
    return {"status": "small_talk"}


async def _execute_unknown(*, note, vendor, customer, wa_id, message_id, reply_plain, pending_order):
    """Deliberately sent WITHOUT logging to conversation history (reply_plain, not reply): a
    temperature-0 understanding call that sees its own prior hedging as recent context was
    previously found to bias later turns toward repeating "unknown" even on unambiguous
    messages. Same reasoning the old low-confidence classifier escalation used."""
    _classify(message_id, "unclassified", 0.0)
    _flag(message_id, reason="unparseable")
    tail = (" In the meantime, reply 'yes' to confirm your order, 'no' to cancel, or tell me "
            "what you'd like to change.") if pending_order else ""
    lead = note or "I want to make sure I get this right, so I've flagged your message to the seller."
    await reply_plain(wa_id, f"{lead}{tail}")
    return {"status": "escalated_unclear"}


# ---------------------------------------------------------------------------------------------
# Single entry point from main.py
# ---------------------------------------------------------------------------------------------
async def execute(understanding: dict, *, text, state, vendor, customer, wa_id, message_id, reply, reply_plain=None):
    """Carries out a NON-terminal action list from understanding.understand().

    `state` is the ConversationState that understanding was produced from (tells us whether an
    order is pending). `reply` is main.reply_and_log (send + log). `reply_plain` is
    main.send_whatsapp_message (send only, no history log) and is only used for the "unknown"
    escalation reply — defaults to `reply` if not given, purely so tests can pass one callback.

    main.py must check actions.terminal_type() BEFORE calling this — a lone confirm_order or
    cancel_order never reaches here; apply_policy() guarantees they never arrive mixed with
    anything else either, so this function never has to reason about payment state.
    """
    reply_plain = reply_plain or (lambda wa_id, body: reply(vendor["id"], customer["id"], wa_id, body))
    actions = understanding["actions"]
    confidence = understanding.get("confidence", 0.0)
    note = understanding.get("note")
    pending_order = state.pending_order

    types_ = [a["type"] for a in actions]
    edits = [a for a in actions if a["type"] in EDIT_TYPES]
    also_question = "ask_question" in types_ and bool(edits)

    if edits:
        if pending_order:
            return await _execute_correction(
                edits, text=text, pending_order=pending_order, confidence=confidence, note=note,
                catalog=state.catalog, vendor=vendor, customer=customer, wa_id=wa_id,
                message_id=message_id, reply=reply, also_question=also_question,
            )
        return await _execute_new_order(
            edits, text=text, confidence=confidence, catalog=state.catalog, vendor=vendor,
            customer=customer, wa_id=wa_id, message_id=message_id, reply=reply,
            also_question=also_question,
        )

    if "ask_question" in types_:
        return await _execute_question(
            text=text, vendor=vendor, customer=customer, wa_id=wa_id, message_id=message_id,
            reply=reply, pending_order=pending_order, catalog=state.catalog,
        )

    if "small_talk" in types_:
        return await _execute_small_talk(
            text=text, vendor=vendor, customer=customer, wa_id=wa_id, message_id=message_id,
            reply=reply, pending_order=pending_order,
        )

    return await _execute_unknown(
        note=note, vendor=vendor, customer=customer, wa_id=wa_id, message_id=message_id,
        reply_plain=reply_plain, pending_order=pending_order,
    )
