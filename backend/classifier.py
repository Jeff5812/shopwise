import os
import json
from dotenv import load_dotenv
from google import genai

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

SYSTEM_PROMPT = """You classify incoming WhatsApp messages sent to a small online vendor in Nigeria.
The vendor sells goods like clothing, candles, soap, skincare, or similar informal retail items.
Customers may write in standard English or Nigerian Pidgin, and may send typos or casual phrasing.

Classify the message into exactly one of these intents:
- "order": the customer is trying to buy something, specifying items and/or quantities
- "question": the customer is asking about price, availability, delivery time, returns, or similar
- "negotiation": the customer is trying to haggle or propose a different price
- "noise": greetings, small talk, or anything not related to buying

Respond ONLY with valid JSON in this exact shape, nothing else:
{"intent": "order" | "question" | "negotiation" | "noise", "confidence": 0.0 to 1.0}

confidence should reflect how certain you are. Use lower confidence (below 0.6) for ambiguous,
incomplete, or unclear messages rather than guessing high.
"""


def classify_message(text: str) -> dict:
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=text,
        config={
            "system_instruction": SYSTEM_PROMPT,
            "temperature": 0,
            "response_mime_type": "application/json",
        },
    )

    raw = response.text.strip()

    try:
        parsed = json.loads(raw)
        intent = parsed.get("intent", "unclassified")
        confidence = float(parsed.get("confidence", 0))
        if intent not in ("order", "question", "negotiation", "noise"):
            intent = "unclassified"
            confidence = 0.0
        return {"intent": intent, "confidence": confidence}
    except (json.JSONDecodeError, ValueError, TypeError):
        # model returned something unparseable — treat as unclassified, never guess
        return {"intent": "unclassified", "confidence": 0.0}