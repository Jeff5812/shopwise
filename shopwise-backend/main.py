import os
import httpx
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from db import (
    get_or_create_vendor,
    get_or_create_customer,
    message_already_processed,
    log_message,
    log_outbound_message,
    get_conversation_history,
    update_message_classification,
    add_to_review_queue,
    get_vendor_catalog,
    get_faq_snippets,
    create_order,
    get_pending_order,
    confirm_order,
    mark_pending_payment,
    cancel_order,
    get_order_items_with_names,
    get_review_queue,
    resolve_review_queue,
    adjust_stock,
)
from classifier import classify_message
from order_extractor import extract_order, EXTRACTION_CONFIDENCE_THRESHOLD
from reply_generator import generate_order_confirmation, generate_faq_answer
from pending_response_classifier import classify_pending_response
from paystack_service import PaystackService
from payment_service import create_payment_for_order, process_webhook_charge_success

load_dotenv()

app = FastAPI()

# Dashboard writes go through this API rather than straight to Supabase, so the stock/order
# rules already in db.py (restock on cancel, decrement on create) stay the single source of truth.
DASHBOARD_ORIGIN = os.getenv("DASHBOARD_ORIGIN", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[DASHBOARD_ORIGIN],
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["*"],
)

VERIFY_TOKEN = os.getenv("WEBHOOK_VERIFY_TOKEN")
PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
ACCESS_TOKEN = os.getenv("WHATSAPP_SYSTEM_USER_TOKEN")
GRAPH_VERSION = os.getenv("GRAPH_API_VERSION", "v25.0")
PAYSTACK_DEFAULT_EMAIL = os.getenv("PAYSTACK_DEFAULT_EMAIL")

CONFIDENCE_THRESHOLD = 0.6  # below this, escalate to review queue regardless of intent

FALLBACK_REPLY = "Sorry, I'm having a little trouble right now. The seller will get back to you shortly."


async def send_whatsapp_message(to: str, body: str):
    url = f"https://graph.facebook.com/{GRAPH_VERSION}/{PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": body},
    }
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code >= 400:
                print(f"WHATSAPP SEND FAILED ({response.status_code}) to {to}: {response.text}")
            else:
                print("Send response:", response.status_code, response.text)
            return response
    except httpx.HTTPError as e:
        print("WhatsApp send failed (network/HTTP error):", e)
        return None


async def reply_and_log(vendor_id: str, customer_id: str, to: str, body: str):
    """Sends the WhatsApp reply and logs it as an outbound message, so the next turn's
    conversation-history lookup sees what the bot actually said, not just the customer's side."""
    result = await send_whatsapp_message(to, body)
    try:
        log_outbound_message(vendor_id, customer_id, body)
    except Exception as e:
        # Never let a logging failure block the reply that already went out
        print("Failed to log outbound message:", e)
    return result


@app.get("/webhook")
async def verify_webhook(request: Request):
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if mode == "subscribe" and token == VERIFY_TOKEN:
        return PlainTextResponse(content=challenge, status_code=200)
    return PlainTextResponse(content="Forbidden", status_code=403)


@app.post("/webhook")
async def receive_message(request: Request):
    body = await request.json()
    print(body)

    try:
        entry = body["entry"][0]
        change = entry["changes"][0]["value"]

        if "messages" not in change:
            # status update (delivered/read/failed) — not handled yet, ignore for now
            return {"status": "ignored_non_message_event"}

        message = change["messages"][0]
        wa_message_id = message["id"]

        # Idempotency guard — Meta retries webhook deliveries, never process the same message twice
        if message_already_processed(wa_message_id):
            return {"status": "duplicate_ignored"}

        sender_wa_id = message["from"]
        text = message.get("text", {}).get("body", "")
        receiving_phone_number_id = change["metadata"]["phone_number_id"]

        vendor = get_or_create_vendor(receiving_phone_number_id)
        customer = get_or_create_customer(vendor["id"], sender_wa_id)

        # Log the message immediately, BEFORE calling any external AI service.
        # This is what makes the idempotency check actually work: if Gemini or WhatsApp
        # has a transient failure below, Meta's retry will find this row already exists
        # and skip reprocessing, instead of resending the same message from scratch.
        logged_message = log_message(
            vendor_id=vendor["id"],
            customer_id=customer["id"],
            wa_message_id=wa_message_id,
            direction="inbound",
            raw_text=text,
            intent=None,
            confidence=None,
        )

        # Pending confirmation check comes BEFORE the general intent classifier.
        # If this customer has an order sitting at awaiting_confirmation, their reply is
        # almost certainly answering that, not starting something new, so it gets checked first.
        # Guarded like every other external call in this handler — a transient Supabase error
        # here must not crash the whole webhook and strand the message at intent=null forever.
        try:
            pending_order = get_pending_order(vendor["id"], customer["id"])
        except Exception as e:
            print("get_pending_order failed, treating as no pending order:", e)
            pending_order = None
        if pending_order:
            try:
                action = classify_pending_response(text)
            except Exception as e:
                print("Pending-response classification failed:", e)
                action = "other"

            if action == "confirm":
                mark_pending_payment(pending_order["id"])
                update_message_classification(logged_message["id"], "order", 1.0)
                customer_email = customer.get("email") or PAYSTACK_DEFAULT_EMAIL
                if not customer_email:
                    # Order stays correctly at pending_payment — don't crash the webhook with
                    # a raw 500 (that leaves WhatsApp with no reply at all). Ask for what we
                    # need and let the seller see it, same as any other unresolvable case.
                    add_to_review_queue(logged_message["id"], reason="missing_email_for_payment")
                    await reply_and_log(
                        vendor["id"], customer["id"], sender_wa_id,
                        "Your order is confirmed! I just need an email address to send your payment link — could you share one?"
                    )
                    return {"status": "order_pending_payment_missing_email", "order_id": pending_order["id"]}
                checkout_url = await create_payment_for_order(pending_order["id"], customer_email)
                await reply_and_log(
                    vendor["id"], customer["id"], sender_wa_id,
                    f"Perfect, your order is confirmed. Please complete payment here: {checkout_url}"
                )
                return {"status": "order_pending_payment", "order_id": pending_order["id"]}

            elif action == "cancel":
                cancel_order(pending_order["id"])
                update_message_classification(logged_message["id"], "order", 1.0)
                await reply_and_log(vendor["id"], customer["id"], sender_wa_id, "No problem at all, that order has been canceled.")
                return {"status": "order_canceled", "order_id": pending_order["id"]}

            else:
                # Deliberate scope decision: corrections ("actually make it 3") are not auto-handled
                # yet, since that means editing an already-created order and its stock reservation.
                # Escalate rather than guess or silently create a second, conflicting order.
                update_message_classification(logged_message["id"], "unclassified", 0.0)
                add_to_review_queue(logged_message["id"], reason="unparseable")
                await reply_and_log(
                    vendor["id"], customer["id"], sender_wa_id,
                    "I still have your order waiting on a yes or no to confirm it. Let me know and I'll also "
                    "flag your message to the seller in case you'd like to change something."
                )
                return {"status": "escalated_pending_order_unclear", "order_id": pending_order["id"]}

        # Fetch recent conversation history once here — both the intent classifier and the order
        # extractor need it, since neither call was seeing anything beyond the current message before.
        history = get_conversation_history(vendor["id"], customer["id"], exclude_message_id=logged_message["id"])

        # Classification can fail transiently (model overloaded, network blip) — never crash the webhook for it
        try:
            classification = classify_message(text, history)
            intent = classification["intent"]
            confidence = classification["confidence"]
        except Exception as e:
            print("Classification failed, treating as unclassified:", e)
            intent = "unclassified"
            confidence = 0.0

        update_message_classification(logged_message["id"], intent, confidence)

        # Low confidence always escalates, regardless of what intent it guessed
        if confidence < CONFIDENCE_THRESHOLD or intent == "unclassified":
            add_to_review_queue(logged_message["id"], reason="low_confidence")
            # Pure boilerplate — sent via plain send_whatsapp_message, NOT reply_and_log. Logging this
            # to history was causing a real regression: at temperature 0, showing the model its own
            # prior hedging as recent context biased later classification toward repeating it, even
            # on unambiguous messages. Real, informative replies still go through reply_and_log below.
            await send_whatsapp_message(sender_wa_id, "Thanks for reaching out. Let me just check on this and I'll come right back to you.")
            return {"status": "escalated_low_confidence"}

        # Branch by intent — negotiation logic is still a stub for now
        if intent == "order":
            try:
                catalog = get_vendor_catalog(vendor["id"])
                print(f"DEBUG catalog for vendor {vendor['id']}: {[p.get('name') for p in catalog]}")
                extraction = extract_order(text, catalog, history)
                print(f"DEBUG extraction result: {extraction}")
                line_items = extraction["line_items"]
                extraction_confidence = extraction["confidence"]
            except Exception as e:
                print("Order extraction failed:", e)
                line_items, extraction_confidence = [], 0.0

            if not line_items or extraction_confidence < EXTRACTION_CONFIDENCE_THRESHOLD:
                add_to_review_queue(logged_message["id"], reason="unparseable")
                # If the model told us WHY it couldn't extract (e.g. multiple variants, nothing
                # to disambiguate size/color), surface that instead of a generic reply — otherwise
                # the customer has no idea what's actually being asked of them.
                ambiguous_note = extraction.get("ambiguous_note") if "extraction" in locals() else None
                if ambiguous_note:
                    clarify_reply = f"{ambiguous_note} Could you clarify so I can get this exactly right?"
                else:
                    clarify_reply = (
                        "I want to make sure I get your order exactly right. Could you let me know which "
                        "item(s) and how many? (something like '2 lavender candles' works perfectly)"
                    )
                await reply_and_log(vendor["id"], customer["id"], sender_wa_id, clarify_reply)
            else:
                order = create_order(vendor["id"], customer["id"], line_items, logged_message["id"])
                try:
                    reply_text = generate_order_confirmation(line_items, order["total_amount"])
                except Exception as e:
                    print("Confirmation generation failed, using plain fallback:", e)
                    items_text = ", ".join(f"{i['quantity']} x {i['product_name']}" for i in line_items)
                    reply_text = f"That's {items_text}, coming to \u20a6{order['total_amount']:.0f} total. Shall I confirm this for you?"
                await reply_and_log(vendor["id"], customer["id"], sender_wa_id, reply_text)
        elif intent == "question":
            try:
                faq_snippets = get_faq_snippets(vendor["id"])
                faq_result = generate_faq_answer(text, faq_snippets)
            except Exception as e:
                print("FAQ answering failed:", e)
                faq_result = {"answered": False, "reply": None}

            if faq_result["answered"] and faq_result["reply"]:
                await reply_and_log(vendor["id"], customer["id"], sender_wa_id, faq_result["reply"])
            else:
                add_to_review_queue(logged_message["id"], reason="unparseable")
                # Same reasoning as the classifier escalation above — pure boilerplate, don't let it
                # bias future turns toward more hedging.
                await send_whatsapp_message(sender_wa_id, "Good question. Let me check with the seller and get right back to you.")
        elif intent == "negotiation":
            add_to_review_queue(logged_message["id"], reason="negotiation_below_floor")
            await reply_and_log(vendor["id"], customer["id"], sender_wa_id, "I hear you. Let me see what I can work out on that and I'll get back to you shortly.")
        elif intent == "noise":
            await reply_and_log(vendor["id"], customer["id"], sender_wa_id, "Hi there! Lovely to hear from you, what can I help you find today?")

        return {"status": "processed", "intent": intent, "confidence": confidence}

    except (KeyError, IndexError) as e:
        print("Webhook parse error (likely a non-message event):", e)
        return {"status": "ignored_unparseable_event"}


@app.post("/webhooks/paystack")
async def paystack_webhook(request: Request):
    raw_body = await request.body()
    signature = request.headers.get("x-paystack-signature", "")

    if not PaystackService.verify_signature(raw_body, signature):
        raise HTTPException(status_code=401, detail="invalid signature")

    payload = await request.json()
    if payload.get("event") == "charge.success":
        process_webhook_charge_success(payload["data"])

    return {"status": "ok"}


# --- Dashboard-facing API ---
# Reads still go straight from the dashboard to Supabase (fast, simple, no business logic involved).
# Writes come through here instead, so they reuse the same order/stock rules the WhatsApp flow uses.

class StockUpdate(BaseModel):
    stock_quantity: int


@app.post("/orders/{order_id}/confirm")
async def confirm_order_endpoint(order_id: str):
    try:
        order = confirm_order(order_id)
        return {"status": "confirmed", "order": order}
    except IndexError:
        raise HTTPException(status_code=404, detail="Order not found")


@app.post("/orders/{order_id}/cancel")
async def cancel_order_endpoint(order_id: str):
    try:
        order = cancel_order(order_id)
        return {"status": "canceled", "order": order}
    except IndexError:
        raise HTTPException(status_code=404, detail="Order not found")


@app.patch("/inventory/{variant_id}")
async def update_inventory_endpoint(variant_id: str, body: StockUpdate):
    try:
        variant = adjust_stock(variant_id, body.stock_quantity)
        return {"status": "updated", "variant": variant}
    except IndexError:
        raise HTTPException(status_code=404, detail="Variant not found")


@app.get("/review-queue")
async def review_queue_endpoint(vendor_id: str):
    return {"items": get_review_queue(vendor_id)}


@app.post("/review-queue/{item_id}/resolve")
async def resolve_review_queue_endpoint(item_id: str):
    try:
        item = resolve_review_queue(item_id)
        return {"status": "resolved", "item": item}
    except IndexError:
        raise HTTPException(status_code=404, detail="Review queue item not found")