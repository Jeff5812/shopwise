"""
Plain-text messages sent when Paystack confirms a payment. Pure functions of database rows:
nothing here queries, sends, or decides anything, so the facts in these messages can only be
what the orders/customers tables already say (never AI-written).
"""


def _naira(amount) -> str:
    return f"\u20a6{float(amount):,.0f}"


def _short_id(order_id) -> str:
    return str(order_id)[:8]


def build_customer_receipt(order: dict) -> str:
    return (
        f"Payment received, thank you! Your order #{_short_id(order['id'])} "
        f"({_naira(order['total_amount'])}) is confirmed."
    )


def build_seller_alert(order: dict, customer: dict) -> str:
    who = (customer or {}).get("display_name") or (customer or {}).get("wa_id") or "A customer"
    return (
        f"New paid order #{_short_id(order['id'])}: {who} paid {_naira(order['total_amount'])}. "
        "Check the dashboard Orders page to fulfil it."
    )
