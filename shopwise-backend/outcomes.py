"""What an executor reports back. Kept in its own tiny module so executors and the reply layer don't
have to import each other."""
from dataclasses import dataclass
from typing import Optional


@dataclass
class Outcome:
    status: str                       # machine-readable result, used by logs and tests
    text: str = ""                    # reply fragment
    remind: bool = False              # the order is still waiting: remind them once, at the end
    asks_confirmation: bool = False   # the fragment already asks "shall I confirm?" (no reminder needed)
    intent: str = "noise"             # this outcome's vote for the message's classification
    confidence: float = 1.0
    flag: Optional[str] = None        # review_queue reason, if the seller should look at it
