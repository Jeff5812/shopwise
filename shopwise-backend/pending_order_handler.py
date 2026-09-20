"""
Follow-ups to an order that is waiting on the customer's yes/no.

main.py handles "confirm" and "cancel" itself (the payment flow is untouched). Everything else a
customer might say while an order is pending lands here, and the one rule is: the pending order is
never lost, never duplicated, and never auto-confirmed because of what was said.

    correct   -> edit the SAME order in place (db.replace_order_items, one atomic transaction),
                 then show the updated order and ask for confirmation again
    question  -> answer from the vendor's FAQ data, keep the order, remind them it's waiting
    casual    -> friendly reply, keep the order
    other     -> ask / flag to review_queue, keep the order

Division of labour: the AI only reads the customer's message (which variants, which quantities).
This module validates that against the real catalog and decides; prices always come from the
catalog, never from the model; Supabase (via the RPC) stays the source of truth for stock/totals.
"""
import os
import json
from dotenv import load_dotenv
from google import genai

from db import (
    get_vendor_catalog,
    get_faq_snippets,
    get_order_items,
    replace_order_items,
    get_conversation_history,
    add_to_review_queue,
    update_message_classification,
    InsufficientStockError,
    OrderNotEditableError,
)
from model_router import generate_with_resilience
from order_extractor import EXTRACTION_CONFIDENCE_THRESHOLD, _build_contents
from reply_generator import generate_order_confirmation, generate_faq_answer

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

PENDING_REMINDER = "Your order is still waiting: reply 'yes' to confirm or 'no' to cancel."


# ---------------------------------------------------------------------------------------------
# Correction: interpret (AI) -> validate (code) -> apply (Postgres RPC)
# ---------------------------------------------------------------------------------------------
def _variant_index(catalog: list) -> dict:
    """variant_id -> display info + the authoritative catalog price."""
    index = {}
    for product in catalog:
        for v in product["variants"]:
            index[v["variant_id"]] = {
                "product_name": product["name"],
                "size": v.get("size"),
                "color": v.get("color"),
                "unit_price": product["sell_price"],
            }
    return index


def _label(info: dict) -> str:
    """'Ankara Gown (M, blue)' for display; plain name when the variant has no size/color."""
    extras = [x for x in (info.get("size"), info.get("color")) if x]
    return f"{info['product_name']} ({', '.join(extras)})" if extras else info["product_name"]


def _build_correction_prompt(catalog: list, current_lines: list) -> str:
    return f"""A customer has an order waiting for their yes/no confirmation at a small Nigerian
vendor, and their latest WhatsApp message changes it. They may write standard English or
Nigerian Pidgin.

Vendor catalog (use these exact variant_ids only, never invent one):
{json.dumps(catalog, indent=2)}

Their CURRENT pending order:
{json.dumps(current_lines, indent=2)}

Apply the change in the customer's LATEST message to the current order and return the COMPLETE
revised order: keep every line they did not mention, change or drop the ones they did. Examples:
"make it 2" changes the quantity, "blue instead" swaps to the blue variant of the same product,
"remove the candle" drops that line, "add a soap" adds a line. Use earlier turns of the
conversation only to resolve references.

Respond ONLY with JSON in this exact shape (no prices, they are looked up separately):
{{
  "line_items": [{{"variant_id": "...", "quantity": 1}}],
  "confidence": 0.0 to 1.0,
  "ambiguous_note": "short plain-English question if the change was unclear, else null"
}}

If the change is ambiguous (e.g. "make it 2" but the order has several items, or the requested
size/color does not exist), use confidence below 0.7 and put a short clarifying question in
ambiguous_note. If they removed every item, return an empty line_items list with high confidence.
"""


def interpret_correction(text: str, current_lines: list, catalog: list, history: list = None) -> dict:
    """AI step only: returns {"line_items": [{"variant_id", "quantity"}], "confidence", "ambiguous_note"}.
    Never trusted on its own, see validate_revision."""
    response, model_used = generate_with_resilience(
        client,
        contents=_build_contents(text, history),
        config={
            "system_instruction": _build_correction_prompt(catalog, current_lines),
            "temperature": 0,
            "response_mime_type": "application/json",
        },
    )
    print(f"interpret_correction served by {model_used}")
    try:
        parsed = json.loads(response.text.strip())
        return {
            "line_items": parsed.get("line_items") or [],
            "confidence": float(parsed.get("confidence", 0)),
            "ambiguous_note": parsed.get("ambiguous_note"),
        }
    except (json.JSONDecodeError, ValueError, TypeError):
        return {"line_items": [], "confidence": 0.0, "ambiguous_note": "Unparseable model response."}


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
            "product_name": _label(index[vid]),
        }
        for vid, qty in merged.items()
    ]


def _same_order(revised: list, current_rows: list) -> bool:
    return {i["variant_id"]: i["quantity"] for i in revised} == {
        r["product_variant_id"]: r["quantity"] for r in current_rows
    }


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


async def _handle_correction(text, pending_order, vendor, customer, wa_id, message_id, reply):
    order_id = pending_order["id"]

    async def say(body):
        await reply(vendor["id"], customer["id"], wa_id, body)

    try:
        catalog = get_vendor_catalog(vendor["id"])
        index = _variant_index(catalog)
        current_rows = get_order_items(order_id)
        current_lines = [
            {"variant_id": r["product_variant_id"], "product_name": _label(index[r["product_variant_id"]]),
             "quantity": r["quantity"]}
            for r in current_rows if r["product_variant_id"] in index
        ]
        try:
            history = get_conversation_history(vendor["id"], customer["id"], exclude_message_id=message_id)
        except Exception as e:
            print("History lookup failed for correction, continuing without it:", e)
            history = []
        interpretation = interpret_correction(text, current_lines, catalog, history)
    except Exception as e:
        print("Correction interpretation failed:", e)
        _classify(message_id, "unclassified", 0.0)
        _flag(message_id, reason="unparseable")
        await say(f"I couldn't work out that change just yet. Could you say exactly what you'd like? {PENDING_REMINDER}")
        return {"status": "pending_order_correction_unclear", "order_id": order_id}

    # Everything removed: never auto-cancel on a guess. Keep the order and let them decide.
    if interpretation["confidence"] >= EXTRACTION_CONFIDENCE_THRESHOLD and interpretation["line_items"] == []:
        _classify(message_id, "order", interpretation["confidence"])
        await say("That would leave your order empty. Reply 'no' if you'd like to cancel it, "
                  "or tell me what you'd like instead.")
        return {"status": "pending_order_correction_would_empty", "order_id": order_id}

    revised = None
    if interpretation["confidence"] >= EXTRACTION_CONFIDENCE_THRESHOLD and interpretation["line_items"]:
        revised = validate_revision(interpretation["line_items"], index)

    if not revised:
        _classify(message_id, "unclassified", 0.0)
        _flag(message_id, reason="unparseable")
        note = interpretation.get("ambiguous_note")
        lead = f"{note} " if note else "I want to get this change exactly right. What would you like to change? "
        await say(f"{lead}{PENDING_REMINDER}")
        return {"status": "pending_order_correction_unclear", "order_id": order_id}

    if _same_order(revised, current_rows):
        _classify(message_id, "order", interpretation["confidence"])
        await say(f"That's already how your order is. {PENDING_REMINDER}")
        return {"status": "pending_order_correction_no_change", "order_id": order_id}

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

    _classify(message_id, "order", interpretation["confidence"])
    total = (updated[0] if isinstance(updated, list) else updated)["total_amount"]
    try:
        summary = generate_order_confirmation(revised, total)
    except Exception as e:
        print("Confirmation generation failed, using plain fallback:", e)
        items_text = ", ".join(f"{i['quantity']} x {i['product_name']}" for i in revised)
        summary = f"Updated! That's {items_text}, coming to \u20a6{total:.0f} total. Shall I confirm this for you?"
    # Deliberately NOT confirmed: they must answer yes to the updated order.
    await say(summary)
    return {"status": "pending_order_corrected", "order_id": order_id}


async def _handle_question(text, pending_order, vendor, customer, wa_id, message_id, reply):
    try:
        faq_result = generate_faq_answer(text, get_faq_snippets(vendor["id"]))
    except Exception as e:
        print("FAQ answering failed during pending order:", e)
        faq_result = {"answered": False, "reply": None}

    _classify(message_id, "question", 1.0)
    if faq_result["answered"] and faq_result["reply"]:
        await reply(vendor["id"], customer["id"], wa_id, f"{faq_result['reply']} {PENDING_REMINDER}")
        return {"status": "pending_order_question_answered", "order_id": pending_order["id"]}

    _flag(message_id, reason="unparseable")
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


async def _handle_casual(text, pending_order, vendor, customer, wa_id, message_id, reply):
    _classify(message_id, "noise", 1.0)
    await reply(vendor["id"], customer["id"], wa_id, _casual_reply(text))
    return {"status": "pending_order_casual", "order_id": pending_order["id"]}


async def _handle_unclear(text, pending_order, vendor, customer, wa_id, message_id, reply):
    _classify(message_id, "unclassified", 0.0)
    _flag(message_id, reason="unparseable")
    await reply(
        vendor["id"], customer["id"], wa_id,
        "I want to make sure I get this right, so I've flagged your message to the seller. "
        "In the meantime, reply 'yes' to confirm your order, 'no' to cancel, or tell me what you'd like to change.",
    )
    return {"status": "escalated_pending_order_unclear", "order_id": pending_order["id"]}


_HANDLERS = {"correct": _handle_correction, "question": _handle_question, "casual": _handle_casual}


async def handle_pending_followup(action, *, text, pending_order, vendor, customer, wa_id, message_id, reply):
    """Entry point from main.py for any pending-order reply that is not a plain confirm/cancel.
    Unknown actions are treated as 'other' (ask/flag, never guess)."""
    handler = _HANDLERS.get(action, _handle_unclear)
    return await handler(text, pending_order, vendor, customer, wa_id, message_id, reply)
