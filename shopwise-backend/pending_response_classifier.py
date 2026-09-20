import os
import json
from dotenv import load_dotenv
from google import genai

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

PROMPT = """A customer was just asked to confirm an order (yes/no). Classify their reply
(which may be in standard English or Nigerian Pidgin) into exactly one of:
- "confirm": they agreed and want to go ahead: yes, ok, okay, sure, go ahead, confirm, or similar.
  Only when the message is purely agreement, with no change attached.
- "cancel": they said no, cancel it, forget it, don't want it anymore, changed their mind, or similar
- "correct": they want to CHANGE the pending order: a different quantity ("make it 2"), a different
  size/color/variant ("blue instead", "change the size to 42"), adding or removing an item
  ("remove the candle", "add one soap"). If a message both agrees AND changes something
  ("yes but make it 2"), it is "correct", never "confirm".
- "question": they are asking something (delivery cost or areas, pickup, payment options, price,
  availability, returns) without changing the order
- "casual": greeting, thanks, or small talk that neither answers the confirmation nor asks anything
  ("thanks", "hello", "lol")
- "other": anything unclear, mixed, risky, or needing a human: haggling over price, complaints,
  messages that could be read two ways, or anything you are not sure about. When unsure, use "other".

Respond ONLY with JSON: {"action": "confirm" | "cancel" | "correct" | "question" | "casual" | "other"}
"""

VALID_ACTIONS = ("confirm", "cancel", "correct", "question", "casual", "other")


def classify_pending_response(text: str) -> str:
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=text,
        config={"system_instruction": PROMPT, "temperature": 0, "response_mime_type": "application/json"},
    )
    try:
        parsed = json.loads(response.text.strip())
        action = parsed.get("action")
        return action if action in VALID_ACTIONS else "other"
    except (json.JSONDecodeError, ValueError, TypeError):
        return "other"
