"""Pure helpers for capturing a customer's email over WhatsApp. No I/O, no dependencies
on the rest of the backend, so it can be tested and changed in isolation."""
import re

# Deliberately simple: Paystack does the real validation. This only has to reliably pull
# an address out of a chatty reply ("sure it's john@mail.com thanks").
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}")
_CANCEL_RE = re.compile(
    r"\b(cancel|don'?t want|dont want|no longer|not anymore|changed my mind)\b", re.IGNORECASE
)
_MAX_LEN = 254

EMAIL_REQUEST = (
    "Your order is confirmed! Before I send your payment link, what email address should "
    "I use for your receipt? Just reply with it, or say 'skip' and I'll send the link anyway."
)
EMAIL_REQUEST_RETRY = (
    "I couldn't find an email address in that. Please reply with your email "
    "(for example name@mail.com) so I can send your payment link."
)


def extract_email(text: str):
    """First email-looking address in the text, lowercased, or None."""
    if not text:
        return None
    match = _EMAIL_RE.search(text)
    if not match:
        return None
    email = match.group(0).lower()
    return email if len(email) <= _MAX_LEN else None


def looks_like_cancel(text: str) -> bool:
    """True if the reply is really a cancellation, so it must go to the normal pipeline
    instead of being treated as an answer to the email question."""
    return bool(text and _CANCEL_RE.search(text))
