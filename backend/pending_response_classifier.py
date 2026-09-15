import os
import json
from dotenv import load_dotenv
from google import genai

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

PROMPT = """A customer was just asked to confirm an order (yes/no). Classify their reply
(which may be in standard English or Nigerian Pidgin) into exactly one of:
- "confirm": they agreed, said yes, ok, sure, go ahead, or similar
- "cancel": they said no, don't want it anymore, changed their mind, or similar
- "other": anything else, including corrections, new items, or unrelated questions,
  since those need a human's attention rather than a guess

Respond ONLY with JSON: {"action": "confirm" | "cancel" | "other"}
"""


def classify_pending_response(text: str) -> str:
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=text,
        config={"system_instruction": PROMPT, "temperature": 0, "response_mime_type": "application/json"},
    )
    try:
        parsed = json.loads(response.text.strip())
        action = parsed.get("action")
        return action if action in ("confirm", "cancel", "other") else "other"
    except (json.JSONDecodeError, ValueError, TypeError):
        return "other"
