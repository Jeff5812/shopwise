"""
Grades how well the pending-order assistant understands customers, using REAL Gemini.

    cd shopwise-backend
    python -m evals.run_eval                       # whole bank (needs GEMINI_API_KEY in .env)
    python -m evals.run_eval --category pidgin     # one category
    python -m evals.run_eval --limit 20 --failures # quick look, print only the misses
    python -m evals.run_eval --baseline evals/baseline.json   # compare with an earlier run

It never touches Supabase or WhatsApp: the database layer is faked and db.supabase is replaced
with a tripwire that raises if anything reaches for it. The product code under test is the real
classify_pending_response + the real pending_order_handler (so validation, price lookup and reply
logic are exercised exactly as in production).

COUPLING NOTE: predict() below is the ONLY place this file depends on how the product is wired.
If the understanding layer is redesigned, adapt predict() and the bank/scoring stay untouched.
"""
import os
import sys
import json
import time
import asyncio
import argparse
import datetime
from collections import defaultdict
from unittest.mock import patch

# Force a dummy DB target BEFORE any product module loads (load_dotenv never overrides these).
os.environ["SUPABASE_URL"] = "https://eval.invalid"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.eval"

import db  # noqa: E402
import pending_response_classifier as prc  # noqa: E402
import pending_order_handler as poh  # noqa: E402
from evals.scenarios import SCENARIOS, STATES, CATALOG, PRICES  # noqa: E402


class _DbTripwire:
    def __getattr__(self, name):
        raise AssertionError("evals must never touch the database (tried db.supabase." + name + ")")


db.supabase = _DbTripwire()

# Pending-response label -> outcome kind for the labels the handler does not process itself
_LABEL_KIND = {"confirm": "confirm", "cancel": "cancel"}

# Handler status -> outcome kind
_STATUS_KIND = {
    "pending_order_correction_would_empty": "modify_empty",
    "pending_order_correction_unclear": "unclear",
    "escalated_pending_order_unclear": "unclear",
    "pending_order_question_answered": "question",
    "pending_order_question_escalated": "question",
    "pending_order_casual": "casual",
}


# ------------------------------------------------------------------------------------------
# The adapter: how one customer message is pushed through the real pipeline
# ------------------------------------------------------------------------------------------
def _names(lines):
    by_id = {v["variant_id"]: p["name"] for p in CATALOG for v in p["variants"]}
    return ", ".join(f"{q} x {by_id[v]}" for v, q in lines)


def predict(sc) -> dict:
    lines = STATES[sc.state]
    total = sum(PRICES[v] * q for v, q in lines)
    world = {"applied": None, "interp": None, "interp_error": None, "reply": None}
    history = [
        {"direction": "inbound", "raw_text": f"I want {_names(lines)}"},
        {"direction": "outbound",
         "raw_text": f"That's {_names(lines)}, coming to \u20a6{total} total. Shall I confirm this for you?"},
    ]
    real_interpret = poh.interpret_correction

    def spying_interpret(*args, **kwargs):
        try:
            world["interp"] = real_interpret(*args, **kwargs)
            return world["interp"]
        except Exception as e:  # surfaced as an ERROR, not silently scored as a miss
            world["interp_error"] = repr(e)
            raise

    def fake_replace(order_id, items):
        world["applied"] = {i["variant_id"]: i["quantity"] for i in items}
        return {"id": order_id, "total_amount": sum(i["quantity"] * i["unit_price"] for i in items)}

    async def capture_reply(vendor_id, customer_id, wa_id, body):
        world["reply"] = body

    result = {"label": None}
    # 1) the pending-response label, retried on transient API errors
    last = None
    for attempt in range(3):
        try:
            result["label"] = prc.classify_pending_response(sc.text)
            break
        except Exception as e:
            last = e
            time.sleep(2 * (attempt + 1))
    if result["label"] is None:
        return {"kind": "error", "error": repr(last), "label": None}

    label = result["label"]
    if label in _LABEL_KIND:
        return {"kind": _LABEL_KIND[label], "label": label}

    with patch.multiple(
        poh,
        get_vendor_catalog=lambda vid: json.loads(json.dumps(CATALOG)),
        get_order_items=lambda oid: [{"product_variant_id": v, "quantity": q, "unit_price": PRICES[v]} for v, q in lines],
        get_conversation_history=lambda *a, **k: history,
        get_faq_snippets=lambda vid: [],
        replace_order_items=fake_replace,
        add_to_review_queue=lambda *a, **k: None,
        update_message_classification=lambda *a, **k: None,
        generate_order_confirmation=lambda items, total: "(confirmation text)",
        interpret_correction=spying_interpret,
    ):
        status = asyncio.run(poh.handle_pending_followup(
            label, text=sc.text, pending_order={"id": "o1"}, vendor={"id": "v1"}, customer={"id": "c1"},
            wa_id="2340000000000", message_id="m1", reply=capture_reply,
        ))["status"]

    base = {"label": label, "status": status, "interp": world["interp"], "reply": world["reply"]}
    if world["interp_error"]:
        return {**base, "kind": "error", "error": world["interp_error"]}
    if status == "pending_order_corrected":
        return {**base, "kind": "modify", "lines": world["applied"]}
    if status == "pending_order_correction_no_change":
        return {**base, "kind": "modify", "lines": {v: q for v, q in lines}}
    if status in _STATUS_KIND:
        return {**base, "kind": _STATUS_KIND[status]}
    return {**base, "kind": "error", "error": f"unmapped status {status}"}


# ------------------------------------------------------------------------------------------
# Scoring
# ------------------------------------------------------------------------------------------
def _matches(pred: dict, spec: dict) -> bool:
    if pred["kind"] != spec["kind"]:
        return False
    return spec["kind"] != "modify" or pred.get("lines") == spec["lines"]


def score(sc, pred: dict) -> dict:
    kinds_ok = {s["kind"] for s in sc.ok}
    passed = any(_matches(pred, s) for s in sc.ok)
    return {
        "passed": passed,
        "exact": _matches(pred, sc.ok[0]),
        # harms, worst first
        "unsafe_confirm": pred["kind"] == "confirm" and "confirm" not in kinds_ok,
        "unsafe_cancel": pred["kind"] == "cancel" and "cancel" not in kinds_ok,
        "wrong_edit": pred["kind"] in ("modify", "modify_empty") and not passed,
    }


def run(scenarios, sleep=0.0, progress=True):
    rows = []
    for i, sc in enumerate(scenarios, 1):
        started = time.time()
        pred = predict(sc)
        row = {"id": sc.id, "category": sc.category, "state": sc.state, "text": sc.text,
               "expected": list(sc.ok), "also": sc.also, "pred": pred,
               "seconds": round(time.time() - started, 2)}
        row["score"] = None if pred["kind"] == "error" else score(sc, pred)
        rows.append(row)
        if progress:
            mark = "ERR" if row["score"] is None else ("ok " if row["score"]["passed"] else "MISS")
            print(f"[{i:>3}/{len(scenarios)}] {mark} {sc.id:<18} {sc.text[:60]}", flush=True)
        if sleep:
            time.sleep(sleep)
    return rows


# ------------------------------------------------------------------------------------------
# Reporting
# ------------------------------------------------------------------------------------------
def _fmt(spec_or_pred):
    if spec_or_pred["kind"] == "modify":
        return "modify " + ", ".join(f"{v}:{q}" for v, q in sorted(spec_or_pred["lines"].items()))
    return spec_or_pred["kind"]


def report(rows, failures_only=False):
    scored = [r for r in rows if r["score"]]
    errors = [r for r in rows if not r["score"]]
    n = len(scored)
    passed = sum(r["score"]["passed"] for r in scored)
    exact = sum(r["score"]["exact"] for r in scored)
    uc = [r for r in scored if r["score"]["unsafe_confirm"]]
    ucancel = [r for r in scored if r["score"]["unsafe_cancel"]]
    we = [r for r in scored if r["score"]["wrong_edit"]]

    print("\n" + "=" * 78)
    print(f"SCENARIOS SCORED: {n}   (API errors excluded: {len(errors)})")
    if n:
        print(f"Acceptable outcome : {passed}/{n}  ({100 * passed / n:.1f}%)")
        print(f"Ideal outcome      : {exact}/{n}  ({100 * exact / n:.1f}%)")
    print("\nHARMS (these matter most)")
    print(f"  Unsafe confirm (payment link the customer didn't ask for): {len(uc)}")
    print(f"  Unsafe cancel  (order destroyed by mistake)              : {len(ucancel)}")
    print(f"  Wrong edit     (order changed to the wrong thing)        : {len(we)}")

    by_cat = defaultdict(list)
    for r in scored:
        by_cat[r["category"]].append(r)
    print("\nBY CATEGORY                   acceptable   ideal")
    for cat, rs in sorted(by_cat.items(), key=lambda kv: sum(r["score"]["passed"] for r in kv[1]) / len(kv[1])):
        p = sum(r["score"]["passed"] for r in rs)
        e = sum(r["score"]["exact"] for r in rs)
        print(f"  {cat:<24} {p:>3}/{len(rs):<3} {100 * p / len(rs):>5.0f}%   {100 * e / len(rs):>4.0f}%")

    compound = [r for r in scored if r["also"]]
    if compound:
        both = sum(1 for r in compound if r["score"]["passed"])
        print(f"\nCOMPOUND MESSAGES (two intents in one): {both}/{len(compound)} got a safe outcome. "
              "A single-label pipeline can serve only one of the two intents by design;")
        print("  this is a measured gap for step B, not a bug in the bank.")

    misses = [r for r in scored if not r["score"]["passed"]]
    print(f"\nMISSES ({len(misses)})" + ("" if misses else ": none"))
    for r in misses:
        flags = [k for k in ("unsafe_confirm", "unsafe_cancel", "wrong_edit") if r["score"][k]]
        print(f"  {r['id']:<18} \"{r['text']}\"   [state: {r['state']}]")
        print(f"      expected: {' | '.join(_fmt(s) for s in r['expected'])}")
        print(f"      got     : {_fmt(r['pred'])}   (label={r['pred'].get('label')})"
              + (f"   !! {', '.join(flags)}" if flags else ""))
    if errors:
        print(f"\nAPI ERRORS ({len(errors)}), re-run these; they are not counted above:")
        for r in errors:
            print(f"  {r['id']:<18} {r['pred'].get('error')}")
    if not failures_only and rows:
        avg = sum(r["seconds"] for r in rows) / len(rows)
        print(f"\nAverage time per message: {avg:.2f}s")
    print("=" * 78)


def compare(rows, baseline_path):
    base = {r["id"]: r for r in json.load(open(baseline_path))["rows"]}
    regress, improved = [], []
    for r in rows:
        old = base.get(r["id"])
        if not old or not old["score"] or not r["score"]:
            continue
        if old["score"]["passed"] and not r["score"]["passed"]:
            regress.append(r)
        if not old["score"]["passed"] and r["score"]["passed"]:
            improved.append(r)
    print(f"\nVS BASELINE {baseline_path}: {len(improved)} improved, {len(regress)} regressed")
    for r in regress:
        print(f"  REGRESSED {r['id']:<18} \"{r['text']}\"")
    for r in improved:
        print(f"  improved  {r['id']:<18} \"{r['text']}\"")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--category", help="only this category (see evals/scenarios.py)")
    ap.add_argument("--limit", type=int, help="only the first N scenarios (after category filter)")
    ap.add_argument("--failures", action="store_true", help="hide the per-message progress lines")
    ap.add_argument("--sleep", type=float, default=0.0, help="seconds to pause between messages (rate limits)")
    ap.add_argument("--out", help="write full results JSON here (default: evals/results/run-<time>.json)")
    ap.add_argument("--baseline", help="results JSON from an earlier run to compare against")
    args = ap.parse_args(argv)

    if not os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY") == "x":
        sys.exit("GEMINI_API_KEY is not set (put it in shopwise-backend/.env).")

    scenarios = [s for s in SCENARIOS if not args.category or s.category == args.category]
    if args.limit:
        scenarios = scenarios[: args.limit]
    if not scenarios:
        sys.exit("No scenarios matched.")

    rows = run(scenarios, sleep=args.sleep, progress=not args.failures)
    report(rows, failures_only=args.failures)

    out = args.out or os.path.join("evals", "results", f"run-{datetime.datetime.now():%Y%m%d-%H%M%S}.json")
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with open(out, "w") as f:
        json.dump({"created": datetime.datetime.now().isoformat(), "rows": rows}, f, indent=2, default=str)
    print(f"Full results saved to {out}")
    if args.baseline:
        compare(rows, args.baseline)


if __name__ == "__main__":
    main()
