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
        return  # unknown reference — log and ignore, don't error the webhook

    if payment["status"] == "paid":
        return  # idempotent no-op on retry

    expected_kobo = int(payment["amount"] * 100)
    if amount_kobo != expected_kobo or currency != payment["currency"]:
        # mismatch — flag for review, do not mark paid
        return

    mark_payment_paid(payment["id"])
    confirm_order(payment["order_id"])  # existing confirm_order — order status only, no payment logic inside it