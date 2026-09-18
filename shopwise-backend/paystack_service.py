import hashlib, hmac, httpx, os, asyncio
from dotenv import load_dotenv

load_dotenv()

PAYSTACK_SECRET = os.environ["PAYSTACK_SECRET_KEY"]
BASE_URL = "https://api.paystack.co"

class PaystackService:
    @staticmethod
    async def initialize_transaction(email: str, amount_kobo: int, reference: str, metadata: dict) -> dict:
        # Seen live: httpx.ConnectError (WinError 10054, connection reset by remote host) on an
        # otherwise-healthy request — a transient network blip, not a bad request. One retry with
        # a short backoff clears it without masking a genuinely broken request (bad auth, bad
        # payload still raise immediately via raise_for_status on the final attempt).
        last_error = None
        for attempt in range(2):
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
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
            except httpx.TransportError as e:
                last_error = e
                if attempt == 0:
                    print(f"Paystack transport error (attempt 1), retrying once: {e}")
                    await asyncio.sleep(1.5)
        raise last_error

    @staticmethod
    def verify_signature(raw_body: bytes, signature: str) -> bool:
        computed = hmac.new(PAYSTACK_SECRET.encode(), raw_body, hashlib.sha512).hexdigest()
        return hmac.compare_digest(computed, signature)