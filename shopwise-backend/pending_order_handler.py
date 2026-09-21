"""
Follow-ups to an order that is waiting on the customer's yes/no.

main.py handles "confirm" and "cancel" itself (the payment flow is untouched). Everything else a
customer might say while an order is pending lands here, and the one rule is: the pending order is
never lost, never duplicated, and never auto-confirmed because of what was said.

    correct   -> apply the customer's ops to the SAME order in place (db.replace_order_items, one
                 atomic transaction), show the updated order and ask for confirmation again
    question  -> answer from the vendor's FAQ data, keep the order, remind them it's waiting
    casual    -> friendly reply, keep the order
    other     -> ask / flag to review_queue, keep the order

Division of labour: pending_understanding.py (the AI) only reports what the customer means. This
module owns the business rules: it applies the ops to the real order, validates every id against the
real catalog, takes prices from the catalog (never from the model), and lets Supabase (via the RPC)
stay the source of truth for stock and totals.
"""
from db import (
    get_vendor_catalog,
    get_faq_snippets,
    get_order_items,
    replace_order_items,
    add_to_review_queue,
    update_message_classification,
    InsufficientStockError,
    OrderNotEditableError,
)
from catalog_index import variant_index, variant_label
from order_extractor import EXTRACTION_CONFIDENCE_THRESHOLD
from reply_generator import generate_order_confirmation, generate_faq_answer

PENDING_REMINDER = "Your order is still waiting: reply 'yes' to confirm or 'no' to cancel."


# ---------------------------------------------------------------------------------------------
# Correction: understand (AI, elsewhere) -> apply ops (code) -> validate (code) -> Postgres RPC
# ---------------------------------------------------------------------------------------------
class InvalidOps(ValueError):
    """The AI's ops don't make sense against the real order/catalog. Nothing is applied."""


def _valid_qty(q) -> bool:
    return isinstance(q, int) and not isinstance(q, bool) and q >= 1


def apply_ops(current: dict, ops: list, index: dict) -> dict:
    """Pure function: the customer's ops applied to {variant_id: quantity} (line order preserved).
    All-or-nothing: any op that doesn't fit the real order raises InvalidOps and nothing is used.
    Only lines named by an op can change, so a model slip cannot touch other lines."""
    lines = dict(current)
    try:
        for op in ops:
            kind = op.get("op")
            if kind == "set_quantity":
                if op["variant_id"] not in lines or not _valid_qty(op["quantity"]):
                    raise InvalidOps(op)
                lines[op["variant_id"]] = op["quantity"]
            elif kind == "add_item":
                if op["variant_id"] not in index or not _valid_qty(op["quantity"]):
                    raise InvalidOps(op)
                lines[op["variant_id"]] = lines.get(op["variant_id"], 0) + op["quantity"]
            elif kind == "remove_item":
                if op["variant_id"] not in lines:
                    raise InvalidOps(op)
                del lines[op["variant_id"]]
            elif kind == "swap_variant":
                src, dst = op["from_variant_id"], op["to_variant_id"]
                if src not in lines or src not in index or dst not in index or src == dst:
                    raise InvalidOps(op)
                if index[src]["product_id"] != index[dst]["product_id"]:
                    raise InvalidOps(op)          # a swap stays within one product; different product = remove + add
                swapped = {}
                for k, q in lines.items():
                    target = dst if k == src else k
                    swapped[target] = swapped.get(target, 0) + q
                lines = swapped
            else:
                raise InvalidOps(op)
    except (KeyError, TypeError, AttributeError) as e:
        raise InvalidOps(f"malformed op: {e!r}") from e
    return lines


def validate_revision(raw_items: list, index: dict):
    """Code decides, not the model. Returns line items ready for the RPC
    ([{"variant_id", "quantity", "unit_price", "product_name"}]), or None if anything is off:
    unknown variant_id, non-positive / non-integer quantity. Duplicate variants are merged and
    the price is always the catalog price."""
    merged = {}
    for item in raw_items:
        if not isinstance(item, dict):
            return None
        variant_id, qty = item.get("variant_id"), item.get("quantity")
        if variant_id not in index or isinstance(qty, bool) or not isinstance(qty, int) or qty < 1:
            return None
        merged[variant_id] = merged.get(variant_id, 0) + qty
    return [
        {
            "variant_id": vid,
            "quantity": qty,
            "unit_price": index[vid]["unit_price"],
            "product_name": variant_label(index[vid]),
        }
        for vid, qty in merged.items()
    ]


# ---------------------------------------------------------------------------------------------
# Follow-up handlers. `reply` is main.reply_and_log (send + log), injected to avoid a circular import.
# ---------------------------------------------------------------------------------------------
def _classify(message_id, intent, confidence):
    try:
        update_message_classification(message_id, intent, confidence)
    except Exception as e:
        print("Pending follow-up classification bookkeeping failed:", e)


def _flag(message_id, reason):
    try:
        add_to_review_queue(message_id, reason=reason)
    except Exception as e:
        print("Pending follow-up review_queue bookkeeping failed:", e)


def _faq_answer(text, vendor, message_id):
    """The vendor's FAQ answer for this text, or None (in which case the question is flagged for the seller)."""
    try:
        faq_result = generate_faq_answer(text, get_faq_snippets(vendor["id"]))
    except Exception as e:
        print("FAQ answering failed during pending order:", e)
        faq_result = {"answered": False, "reply": None}
    if faq_result["answered"] and faq_result["reply"]:
        return faq_result["reply"]
    _flag(message_id, reason="unparseable")
    return None


async def _handle_correction(text, pending_order, vendor, customer, wa_id, message_id, reply, understanding):
    order_id = pending_order["id"]

    async def say(body):
        await reply(vendor["id"], customer["id"], wa_id, body)

    async def ask_to_clarify(note):
        _classify(message_id, "unclassified", 0.0)
        _flag(message_id, reason="unparseable")
        lead = f"{note} " if note else "I want to get this change exactly right. What would you like to change? "
        await say(f"{lead}{PENDING_REMINDER}")
        return {"status": "pending_order_correction_unclear", "order_id": order_id}

    ops = understanding.get("ops") or []
    confidence = understanding.get("confidence", 0.0)
    if confidence < EXTRACTION_CONFIDENCE_THRESHOLD or not ops:
        return await ask_to_clarify(understanding.get("note"))

    # Fresh read of the real order and catalog right before deciding (never trust a stale view).
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
        revised_map = apply_ops(current, ops, index)
    except InvalidOps as e:
        print("Correction ops rejected:", e)
        return await ask_to_clarify(understanding.get("note"))

    # Everything removed: never auto-cancel on a guess. Keep the order and let them decide.
    if not revised_map:
        _classify(message_id, "order", confidence)
        await say("That would leave your order empty. Reply 'no' if you'd like to cancel it, "
                  "or tell me what you'd like instead.")
        return {"status": "pending_order_correction_would_empty", "order_id": order_id}

    if revised_map == current:
        _classify(message_id, "order", confidence)
        await say(f"That's already how your order is. {PENDING_REMINDER}")
        return {"status": "pending_order_correction_no_change", "order_id": order_id}

    revised = validate_revision([{"variant_id": v, "quantity": q} for v, q in revised_map.items()], index)
    if not revised:
        return await ask_to_clarify(understanding.get("note"))

    try:
        updated = replace_order_items(order_id, revised)
    except InsufficientStockError as e:
        print("Correction rejected, insufficient stock:", e)
        _flag(message_id, reason="insufficient_stock")
        await say("Sorry, I don't have enough in stock for that change, so your order stays as it was. "
                  f"{PENDING_REMINDER}")
        return {"status": "pending_order_correction_insufficient_stock", "order_id": order_id}
    except OrderNotEditableError as e:
        print("Correction rejected, order no longer editable:", e)
        _flag(message_id, reason="unhandled_error")
        await say("That order has already moved forward, so I can't change it here. "
                  "I've let the seller know so they can help.")
        return {"status": "pending_order_not_editable", "order_id": order_id}
    except Exception as e:
        # The RPC is atomic: on any failure the original order is exactly as it was.
        print("replace_order_items failed:", e)
        _flag(message_id, reason="unhandled_error")
        await say(f"I hit a snag updating that, so your order stays as it was. {PENDING_REMINDER}")
        return {"status": "pending_order_correction_failed", "order_id": order_id}

    _classify(message_id, "order", confidence)
    total = (updated[0] if isinstance(updated, list) else updated)["total_amount"]
    try:
        summary = generate_order_confirmation(revised, total)
    except Exception as e:
        print("Confirmation generation failed, using plain fallback:", e)
        items_text = ", ".join(f"{i['quantity']} x {i['product_name']}" for i in revised)
        summary = f"Updated! That's {items_text}, coming to \u20a6{total:.0f} total. Shall I confirm this for you?"

    # A second intent in the same message ("make it 2 and do you deliver to Lekki?").
    if understanding.get("also_question"):
        answer = _faq_answer(text, vendor, message_id)
        summary += f"\n\n{answer}" if answer else "\n\nI've also passed your question on to the seller."
    # Deliberately NOT confirmed: they must answer yes to the updated order.
    await say(summary)
    return {"status": "pending_order_corrected", "order_id": order_id}


async def _handle_question(text, pending_order, vendor, customer, wa_id, message_id, reply, understanding):
    answer = _faq_answer(text, vendor, message_id)
    _classify(message_id, "question", 1.0)
    if answer:
        await reply(vendor["id"], customer["id"], wa_id, f"{answer} {PENDING_REMINDER}")
        return {"status": "pending_order_question_answered", "order_id": pending_order["id"]}
    await reply(vendor["id"], customer["id"], wa_id,
                f"Good question. Let me check with the seller and get back to you. {PENDING_REMINDER}")
    return {"status": "pending_order_question_escalated", "order_id": pending_order["id"]}


def _casual_reply(text: str) -> str:
    lowered = text.lower()
    if any(w in lowered for w in ("thank", "thanks", "thx", "tnx")):
        opener = "You're welcome!"
    elif any(lowered.startswith(w) for w in ("hi", "hello", "hey", "good morning", "good afternoon", "good evening")):
        opener = "Hi there!"
    else:
        opener = "No problem!"
    return f"{opener} {PENDING_REMINDER}"


async def _handle_casual(text, pending_order, vendor, customer, wa_id, message_id, reply, understanding):
    _classify(message_id, "noise", 1.0)
    await reply(vendor["id"], customer["id"], wa_id, _casual_reply(text))
    return {"status": "pending_order_casual", "order_id": pending_order["id"]}


async def _handle_unclear(text, pending_order, vendor, customer, wa_id, message_id, reply, understanding):
    _classify(message_id, "unclassified", 0.0)
    _flag(message_id, reason="unparseable")
    await reply(
        vendor["id"], customer["id"], wa_id,
        "I want to make sure I get this right, so I've flagged your message to the seller. "
        "In the meantime, reply 'yes' to confirm your order, 'no' to cancel, or tell me what you'd like to change.",
    )
    return {"status": "escalated_pending_order_unclear", "order_id": pending_order["id"]}


_HANDLERS = {"correct": _handle_correction, "question": _handle_question, "casual": _handle_casual}


async def handle_pending_followup(action, *, text, pending_order, vendor, customer, wa_id, message_id, reply,
                                  understanding=None):
    """Entry point from main.py for any pending-order reply that is not a plain confirm/cancel.
    `understanding` is pending_understanding's parsed output. Unknown actions are treated as 'other'
    (ask/flag, never guess)."""
    handler = _HANDLERS.get(action, _handle_unclear)
    return await handler(text, pending_order, vendor, customer, wa_id, message_id, reply, understanding or {})
