import os
import json
from dotenv import load_dotenv
from google import genai

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

EXTRACTION_CONFIDENCE_THRESHOLD = 0.7  # stricter than the intent-classification threshold —
                                        # getting an order wrong costs real stock/money


def build_extraction_prompt(catalog: list) -> str:
    catalog_text = json.dumps(catalog, indent=2)
    return f"""You extract structured order line items from a customer's WhatsApp message to a small
Nigerian vendor. The customer may write in standard English or Nigerian Pidgin, with typos or
casual phrasing (e.g. "2 candle and one soap" or "abeg 1 gown medium blue").

Here is the vendor's current catalog, including exact variant_ids you must use:
{catalog_text}

Match the customer's message against this catalog. For each item they want, output the exact
variant_id from the catalog above — never invent one. If a product has multiple variants (size/
color) and the customer didn't specify which one, pick the most likely one only if there's
exactly one reasonable match; otherwise flag it as ambiguous.

Respond ONLY with valid JSON in this exact shape:
{{
  "line_items": [
    {{"variant_id": "...", "product_name": "...", "quantity": 1, "unit_price": 2500}}
  ],
  "confidence": 0.0 to 1.0,
  "ambiguous_note": "short note if something needed guessing or couldn't be matched, else null"
}}

Use confidence below 0.7 if any item is ambiguous, unmatched, or you had to guess a variant.
If nothing in the message matches the catalog at all, return an empty line_items list and
confidence 0.0.
"""


def extract_order(text: str, catalog: list) -> dict:
    prompt = build_extraction_prompt(catalog)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=text,
        config={
            "system_instruction": prompt,
            "temperature": 0,
            "response_mime_type": "application/json",
        },
    )

    raw = response.text.strip()

    try:
        parsed = json.loads(raw)
        line_items = parsed.get("line_items", [])
        confidence = float(parsed.get("confidence", 0))
        ambiguous_note = parsed.get("ambiguous_note")

        # Never trust the model's math — validate variant_ids actually exist in the real catalog
        valid_variant_ids = {v["variant_id"] for p in catalog for v in p["variants"]}
        for item in line_items:
            if item.get("variant_id") not in valid_variant_ids:
                return {"line_items": [], "confidence": 0.0, "ambiguous_note": "Model referenced an unknown variant — rejected."}

        if not line_items:
            confidence = 0.0

        return {"line_items": line_items, "confidence": confidence, "ambiguous_note": ambiguous_note}

    except (json.JSONDecodeError, ValueError, TypeError, KeyError):
        return {"line_items": [], "confidence": 0.0, "ambiguous_note": "Unparseable model response."}
