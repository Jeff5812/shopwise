import os
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")  # service role, not the anon key — backend needs full write access

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_or_create_vendor(whatsapp_phone_number_id: str, business_name: str = "Shopwise Vendor"):
    result = supabase.table("vendors").select("*").eq("whatsapp_phone_number_id", whatsapp_phone_number_id).execute()
    if result.data:
        return result.data[0]

    insert_result = supabase.table("vendors").insert({
        "whatsapp_phone_number_id": whatsapp_phone_number_id,
        "business_name": business_name,
    }).execute()
    return insert_result.data[0]


def get_or_create_customer(vendor_id: str, wa_id: str, display_name: str = None):
    result = supabase.table("customers").select("*").eq("vendor_id", vendor_id).eq("wa_id", wa_id).execute()
    if result.data:
        return result.data[0]

    insert_result = supabase.table("customers").insert({
        "vendor_id": vendor_id,
        "wa_id": wa_id,
        "display_name": display_name,
    }).execute()
    return insert_result.data[0]


def message_already_processed(wa_message_id: str) -> bool:
    """Idempotency check — True if we've already logged this exact WhatsApp message ID."""
    result = supabase.table("messages").select("id").eq("wa_message_id", wa_message_id).execute()
    return len(result.data) > 0


def log_message(vendor_id: str, customer_id: str, wa_message_id: str, direction: str,
                 raw_text: str, intent: str = None, confidence: float = None):
    return supabase.table("messages").insert({
        "vendor_id": vendor_id,
        "customer_id": customer_id,
        "wa_message_id": wa_message_id,
        "direction": direction,
        "raw_text": raw_text,
        "intent": intent,
        "confidence": confidence,
    }).execute().data[0]


def update_message_classification(message_id: str, intent: str, confidence: float):
    return supabase.table("messages").update({
        "intent": intent,
        "confidence": confidence,
    }).eq("id", message_id).execute()


def add_to_review_queue(message_id: str, reason: str):
    return supabase.table("review_queue").insert({
        "message_id": message_id,
        "reason": reason,
    }).execute()


def get_pending_order(vendor_id: str, customer_id: str, max_age_minutes: int = 30):
    """Most recent order still waiting on this customer's yes/no reply, if it's still recent enough
    to plausibly be what they're replying to. Older unconfirmed orders are treated as abandoned,
    not as context for a brand new message."""
    from datetime import datetime, timedelta, timezone
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=max_age_minutes)).isoformat()

    result = (
        supabase.table("orders")
        .select("*")
        .eq("vendor_id", vendor_id)
        .eq("customer_id", customer_id)
        .eq("status", "awaiting_confirmation")
        .gte("created_at", cutoff)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def confirm_order(order_id: str):
    return supabase.table("orders").update({"status": "confirmed"}).eq("id", order_id).execute().data[0]


def mark_pending_payment(order_id: str):
    """Order has been agreed to (customer said yes) but payment hasn't happened yet.
    Only the Paystack webhook (process_webhook_charge_success -> confirm_order) should
    move an order from here to 'confirmed'."""
    return supabase.table("orders").update({"status": "pending_payment"}).eq("id", order_id).execute().data[0]


def get_order(order_id: str):
    result = supabase.table("orders").select("*").eq("id", order_id).limit(1).execute()
    return result.data[0] if result.data else None


def get_customer(customer_id: str):
    result = supabase.table("customers").select("*").eq("id", customer_id).limit(1).execute()
    return result.data[0] if result.data else None


def create_payment_record(order_id, provider, provider_reference, amount, currency, status):
    return supabase.table("payments").insert({
        "order_id": order_id,
        "provider": provider,
        "provider_reference": provider_reference,
        "amount": amount,
        "currency": currency,
        "status": status,
    }).execute()


def get_payment_by_reference(reference: str):
    result = supabase.table("payments").select("*").eq("provider_reference", reference).execute()
    return result.data[0] if result.data else None


def mark_payment_paid(payment_id: str):
    return supabase.table("payments").update({
        "status": "paid",
        "paid_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", payment_id).execute()


def cancel_order(order_id: str):
    """Cancels the order and restocks every variant it had reserved."""
    items = supabase.table("order_items").select("*").eq("order_id", order_id).execute().data
    for item in items:
        variant = supabase.table("product_variants").select("stock_quantity").eq("id", item["product_variant_id"]).execute().data[0]
        restored_stock = variant["stock_quantity"] + item["quantity"]
        supabase.table("product_variants").update({"stock_quantity": restored_stock}).eq("id", item["product_variant_id"]).execute()

    return supabase.table("orders").update({"status": "canceled"}).eq("id", order_id).execute().data[0]


def get_order_items_with_names(order_id: str):
    """Order items joined with product name, for building a confirmation summary."""
    items = supabase.table("order_items").select("*, product_variants(product_id)").eq("order_id", order_id).execute().data
    result = []
    for item in items:
        product_id = item["product_variants"]["product_id"]
        product = supabase.table("products").select("name").eq("id", product_id).execute().data[0]
        result.append({"product_name": product["name"], "quantity": item["quantity"], "unit_price": item["unit_price"]})
    return result


def get_review_queue(vendor_id: str, resolved: bool = False):
    """Review queue items for this vendor, joined through messages for vendor scoping.
    Requires a `resolved` boolean column on review_queue — add it if it isn't there yet."""
    result = (
        supabase.table("review_queue")
        .select("*, messages!inner(vendor_id, customer_id, raw_text, intent, related_order_id)")
        .eq("messages.vendor_id", vendor_id)
        .eq("resolved", resolved)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


def resolve_review_queue(item_id: str):
    return supabase.table("review_queue").update({"resolved": True}).eq("id", item_id).execute().data[0]


def adjust_stock(variant_id: str, new_quantity: int):
    """Sets stock to an exact value (dashboard-driven correction), not a delta."""
    return supabase.table("product_variants").update({"stock_quantity": new_quantity}).eq("id", variant_id).execute().data[0]


def log_outbound_message(vendor_id: str, customer_id: str, raw_text: str):
    """Logs the bot's own reply so future conversation-history lookups include both sides of
    the exchange, not just the customer's messages. wa_message_id is null for our own sends."""
    return supabase.table("messages").insert({
        "vendor_id": vendor_id,
        "customer_id": customer_id,
        "wa_message_id": None,
        "direction": "outbound",
        "raw_text": raw_text,
    }).execute()


def get_conversation_history(vendor_id: str, customer_id: str, exclude_message_id: str = None, limit: int = 10):
    """Last `limit` messages (both directions) for this customer, oldest first, ready to feed
    to Gemini as multi-turn context. Excludes the message currently being processed, since that's
    passed separately as the live turn."""
    query = (
        supabase.table("messages")
        .select("id, direction, raw_text, created_at")
        .eq("vendor_id", vendor_id)
        .eq("customer_id", customer_id)
        .order("created_at", desc=True)
        .limit(limit + 1)  # +1 headroom in case the current message is already committed when this runs
    )
    result = query.execute().data or []

    if exclude_message_id:
        result = [m for m in result if m.get("id") != exclude_message_id]

    return list(reversed(result[:limit]))


def get_faq_snippets(vendor_id: str):
    """Returns the vendor's own FAQ/policy answers — the only source FAQ replies are allowed to draw from."""
    return supabase.table("faq_snippets").select("*").eq("vendor_id", vendor_id).execute().data


def get_vendor_catalog(vendor_id: str):
    """Returns every product with its variants, shaped for the extraction prompt."""
    products = supabase.table("products").select("*").eq("vendor_id", vendor_id).execute().data
    catalog = []
    for product in products:
        variants = supabase.table("product_variants").select("*").eq("product_id", product["id"]).execute().data
        catalog.append({
            "product_id": product["id"],
            "name": product["name"],
            "sell_price": product["sell_price"],
            "floor_price": product["floor_price"],
            "variants": [
                {
                    "variant_id": v["id"],
                    "size": v["size"],
                    "color": v["color"],
                    "stock_quantity": v["stock_quantity"],
                }
                for v in variants
            ],
        })
    return catalog


def create_order(vendor_id: str, customer_id: str, line_items: list, message_id: str):
    """
    line_items: list of {"variant_id": ..., "quantity": ..., "unit_price": ...}
    Creates the order, its line items, and decrements stock for each variant.
    """
    total = sum(item["quantity"] * item["unit_price"] for item in line_items)

    order = supabase.table("orders").insert({
        "vendor_id": vendor_id,
        "customer_id": customer_id,
        "status": "awaiting_confirmation",
        "total_amount": total,
    }).execute().data[0]

    for item in line_items:
        supabase.table("order_items").insert({
            "order_id": order["id"],
            "product_variant_id": item["variant_id"],
            "quantity": item["quantity"],
            "unit_price": item["unit_price"],
        }).execute()

        # Decrement stock — read-then-write, fine at this traffic volume for MVP
        variant = supabase.table("product_variants").select("stock_quantity").eq("id", item["variant_id"]).execute().data[0]
        new_stock = max(0, variant["stock_quantity"] - item["quantity"])
        supabase.table("product_variants").update({"stock_quantity": new_stock}).eq("id", item["variant_id"]).execute()

    supabase.table("messages").update({"related_order_id": order["id"]}).eq("id", message_id).execute()

    return order