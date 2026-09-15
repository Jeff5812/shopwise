import os
import json
from dotenv import load_dotenv
from google import genai

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

STYLE_RULES = """
Tone rules, always:
- Warm, genuine, and human, like a friendly shop owner texting back, never like a scripted bot
- Plain standard English only, no Nigerian Pidgin, no slang
- Keep it short: one to two sentences, WhatsApp-length, not an essay
- Never invent facts, prices, promises, or details that weren't given to you
- Never use the exact same stock phrase every time, vary your wording naturally
- Never use em dashes anywhere in your reply. Use a period, comma, or a new sentence instead.
"""


def generate_order_confirmation(line_items: list, total_amount: float) -> str:
    items_text = ", ".join(f"{item['quantity']} x {item['product_name']}" for item in line_items)

    prompt = f"""{STYLE_RULES}

Write a short WhatsApp reply confirming this exact order back to the customer and asking them
to confirm before it's finalized. State only these exact items and this exact total — nothing else:

Items: {items_text}
Total: \u20a6{total_amount:.0f}
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="Write the confirmation message now.",
        config={"system_instruction": prompt, "temperature": 0.7},
    )
    return response.text.strip()


def generate_faq_answer(question: str, faq_snippets: list) -> dict:
    """
    Returns {"answered": True, "reply": "..."} if the vendor's own FAQ data covers the question,
    or {"answered": False, "reply": None} if it doesn't — caller should escalate in that case,
    never let this guess.
    """
    if not faq_snippets:
        return {"answered": False, "reply": None}

    snippets_text = "\n".join(f"- {s['topic']}: {s['answer_text']}" for s in faq_snippets)

    prompt = f"""{STYLE_RULES}

You are answering a customer's question using ONLY the vendor's own info below. Never answer
from general knowledge, never guess, never make up delivery times, prices, or policies that
aren't explicitly listed here.

Vendor's info:
{snippets_text}

If this info genuinely answers the customer's question, respond with:
{{"answered": true, "reply": "your short warm reply here"}}

If it does NOT clearly answer the question, respond with:
{{"answered": false, "reply": null}}

Respond with ONLY that JSON, nothing else.
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=question,
        config={"system_instruction": prompt, "temperature": 0.3, "response_mime_type": "application/json"},
    )

    try:
        parsed = json.loads(response.text.strip())
        return {"answered": bool(parsed.get("answered")), "reply": parsed.get("reply")}
    except (json.JSONDecodeError, ValueError, TypeError):
        return {"answered": False, "reply": None}