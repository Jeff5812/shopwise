import uuid
from db import get_order, create_payment_record, get_payment_by_reference, mark_payment_paid, confirm_order
from paystack_service import PaystackService

async def create_payment_for_order(order_id: str, customer_email: str) -> str:
    """Returns the Paystack checkout URL. Called from confirm_order flow, not from confirm_order itself."""
    order = get_order(order_id)
    reference = f"SHOPWISE-{order_id}-{uuid.uuid4().hex[:8]}"
    amount_kobo = int(order["total_amount"] * 100)

    create_payment_record(
        order_id=order_id,
        provider="paystack",
        provider_reference=reference,
        amount=order["total_amount"],
        currency="NGN",
        status="pending",
    )

    result = await PaystackService.initialize_transaction(
        email=customer_email, amount_kobo=amount_kobo, reference=reference,
        metadata={"order_id": order_id},
    )
    return result["authorization_url"]


def process_webhook_charge_success(event_data: dict) -> None:
    """Idempotent. Called only after signature verification."""
    reference = event_data["reference"]
    amount_kobo = event_data["amount"]
    currency = event_data["currency"]

    payment = get_payment_by_reference(reference)
    if payment is None:
        print(f"PAYSTACK WEBHOOK: unknown reference '{reference}' — ignoring (no matching payment record)")
        return

    if payment["status"] == "paid":
        print(f"PAYSTACK WEBHOOK: reference '{reference}' already marked paid — idempotent no-op")
        return

    expected_kobo = int(payment["amount"] * 100)
    if amount_kobo != expected_kobo or currency != payment["currency"]:
        # Mismatch — do not mark paid. This is exactly the kind of thing that should never be
        # silently swallowed: log loudly so it surfaces in observability until a review_queue
        # path exists for payment-level issues (payments aren't tied to a message_id today).
        print(
            f"PAYSTACK WEBHOOK MISMATCH for payment {payment['id']} (order {payment['order_id']}): "
            f"expected {expected_kobo} {payment['currency']}, got {amount_kobo} {currency} — NOT marking paid"
        )
        return

    mark_payment_paid(payment["id"])
    confirm_order(payment["order_id"])  # existing confirm_order — order status only, no payment logic inside it