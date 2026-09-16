import hashlib, hmac, httpx, os
from dotenv import load_dotenv

load_dotenv()

PAYSTACK_SECRET = os.environ["PAYSTACK_SECRET_KEY"]
BASE_URL = "https://api.paystack.co"

class PaystackService:
    @staticmethod
    async def initialize_transaction(email: str, amount_kobo: int, reference: str, metadata: dict) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{BASE_URL}/transaction/initialize",
                headers={"Authorization": f"Bearer {PAYSTACK_SECRET}"},
                json={
                    "email": email,
                    "amount": amount_kobo,  # subunit — kobo, not naira
                    "reference": reference,
                    "currency": "NGN",
                    "metadata": metadata,
                },
            )
        resp.raise_for_status()
        data = resp.json()["data"]
        return {"authorization_url": data["authorization_url"], "reference": data["reference"]}

    @staticmethod
    def verify_signature(raw_body: bytes, signature: str) -> bool:
        computed = hmac.new(PAYSTACK_SECRET.encode(), raw_body, hashlib.sha512).hexdigest()
        return hmac.compare_digest(computed, signature)