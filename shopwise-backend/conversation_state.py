"""
A read-only snapshot of "what is going on with this customer right now", built from existing database
reads. It is the CONTEXT the understanding step needs to resolve "it", "that", "the last one", "okay".

build_state is pure (easy to test); load_state does the reads and degrades gracefully: a failed lookup
gives a thinner snapshot, it never blocks a plain yes/no.
"""
from dataclasses import dataclass

from db import get_vendor_catalog, get_order_items, get_conversation_history
from catalog_index import variant_index, variant_label


@dataclass(frozen=True)
class ConversationState:
    vendor_id: str
    customer_id: str
    pending_order: dict          # {"id", "status", ...} or None when nothing is waiting
    lines: list                  # the pending order, in order: [{"variant_id", "product_name", "quantity"}]
    catalog: list                # vendor catalog (names, variants, prices: the AI-facing view strips prices)
    history: list                # recent messages, oldest first
    awaiting: object = None      # what the bot is waiting on: "confirmation" or None


def build_state(vendor: dict, customer: dict, pending_order, order_items: list, catalog: list, history: list) -> ConversationState:
    index = variant_index(catalog)
    lines = [
        {"variant_id": r["product_variant_id"], "product_name": variant_label(index[r["product_variant_id"]]),
         "quantity": r["quantity"]}
        for r in order_items if r["product_variant_id"] in index
    ]
    awaiting = "confirmation" if pending_order and pending_order.get("status") == "awaiting_confirmation" else None
    return ConversationState(
        vendor_id=vendor["id"], customer_id=customer["id"], pending_order=pending_order,
        lines=lines, catalog=catalog, history=history, awaiting=awaiting,
    )


def load_state(vendor: dict, customer: dict, pending_order, exclude_message_id=None) -> ConversationState:
    catalog, items, history = [], [], []
    try:
        catalog = get_vendor_catalog(vendor["id"])
    except Exception as e:
        print("State lookup (catalog) failed, continuing without it:", e)
    try:
        if pending_order:
            items = get_order_items(pending_order["id"])
    except Exception as e:
        print("State lookup (order lines) failed, continuing without them:", e)
    try:
        history = get_conversation_history(vendor["id"], customer["id"], exclude_message_id=exclude_message_id)
    except Exception as e:
        print("State lookup (history) failed, continuing without it:", e)
    return build_state(vendor, customer, pending_order, items, catalog, history)
