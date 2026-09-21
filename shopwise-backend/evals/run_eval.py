"""
Grades how well the pending-order assistant understands customers, using REAL Gemini.

    cd shopwise-backend
    python -m evals.run_eval                       # whole bank (needs GEMINI_API_KEY in .env)
    python -m evals.run_eval --category pidgin     # one category
    python -m evals.run_eval --limit 20 --failures # quick look, print only the misses
    python -m evals.run_eval --out evals/baseline.json            # saved after every message
    python -m evals.run_eval --out evals/baseline.json --resume   # continue after a quota stop / Ctrl+C
    python -m evals.run_eval --rpm 0                              # no pacing (paid key)
    python -m evals.run_eval --baseline evals/baseline.json       # compare with an earlier run

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
import re
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


class _Pacer:
    """Spaces Gemini calls so a per-minute quota (free tier: 5/min on gemini-2.5-flash) is never exceeded."""

    def __init__(self, rpm: float):
        self.min_gap = 60.0 / rpm
        self.last = 0.0
        self.calls = 0

    def wait(self):
        gap = time.time() - self.last
        if self.last and gap < self.min_gap:
            time.sleep(self.min_gap - gap)
        self.last = time.time()
        self.calls += 1


def _install_pacer(rpm: float):
    """Wraps generate_content on the clients the product uses (eval-only; production untouched)."""
    pacer = _Pacer(rpm)
    seen = set()
    for holder in (prc, poh):
        models = holder.client.models
        if id(models) in seen:
            continue
        seen.add(id(models))

        def paced(*args, _orig=models.generate_content, **kwargs):
            pacer.wait()
            return _orig(*args, **kwargs)

        models.generate_content = paced
    return pacer


def _is_quota_error(err) -> bool:
    return bool(err) and ("RESOURCE_EXHAUSTED" in err or "429" in err)


def _is_daily_quota(err) -> bool:
    return bool(err) and "PerDay" in err


def _quota_wait_seconds(err) -> float:
    """Honour Google's own hint ('Please retry in 7.5s' / 'retryDelay': '7s'), with a safe floor."""
    m = re.search(r"retry in ([0-9.]+)s", err) or re.search(r"retryDelay'?\W+([0-9.]+)s", err)
    return min(90.0, max(15.0, float(m.group(1)) + 5.0)) if m else 65.0


def run(scenarios, sleep=0.0, progress=True, on_row=None, quota_retries=3):
    """Returns (rows, stop_reason). Quota errors are waited out and retried, not scored as misses.
    A DAILY quota error stops the run cleanly (stop_reason set); on_row(rows) lets the caller checkpoint."""
    rows, stop_reason = [], None
    for i, sc in enumerate(scenarios, 1):
        started = time.time()
        for attempt in range(quota_retries + 1):
            pred = predict(sc)
            err = pred.get("error") if pred["kind"] == "error" else None
            if not _is_quota_error(err) or _is_daily_quota(err) or attempt == quota_retries:
                break
            wait = _quota_wait_seconds(err)
            print(f"      quota hit, waiting {wait:.0f}s then retrying {sc.id} ({attempt + 1}/{quota_retries})", flush=True)
            time.sleep(wait)
        row = {"id": sc.id, "category": sc.category, "state": sc.state, "text": sc.text,
               "expected": list(sc.ok), "also": sc.also, "pred": pred,
               "seconds": round(time.time() - started, 2)}
        row["score"] = None if pred["kind"] == "error" else score(sc, pred)
        rows.append(row)
        if on_row:
            on_row(rows)
        if progress:
            mark = "ERR" if row["score"] is None else ("ok " if row["score"]["passed"] else "MISS")
            print(f"[{i:>3}/{len(scenarios)}] {mark} {sc.id:<18} {sc.text[:60]}", flush=True)
        if _is_daily_quota(err):
            stop_reason = ("Daily Gemini quota reached. Progress is saved; re-run the same command with "
                           "--resume tomorrow, or use a key with billing enabled.")
            break
        if sleep:
            time.sleep(sleep)
    return rows, stop_reason


def _save(path, rows):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump({"created": datetime.datetime.now().isoformat(), "rows": rows}, f, indent=2, default=str)
    os.replace(tmp, path)


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
    ap.add_argument("--rpm", type=float, default=4.0,
                    help="max Gemini calls per minute (free tier allows 5 on gemini-2.5-flash); 0 = no pacing")
    ap.add_argument("--sleep", type=float, default=0.0, help="extra seconds to pause between messages")
    ap.add_argument("--out", help="results JSON, saved after EVERY message (default: evals/results/run-<time>.json)")
    ap.add_argument("--resume", action="store_true", help="continue a previous run saved in --out (skips scored rows)")
    ap.add_argument("--baseline", help="results JSON from an earlier run to compare against")
    args = ap.parse_args(argv)

    if not os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY") == "x":
        sys.exit("GEMINI_API_KEY is not set (put it in shopwise-backend/.env).")

    scenarios = [s for s in SCENARIOS if not args.category or s.category == args.category]
    if args.limit:
        scenarios = scenarios[: args.limit]
    if not scenarios:
        sys.exit("No scenarios matched.")

    out = args.out or os.path.join("evals", "results", f"run-{datetime.datetime.now():%Y%m%d-%H%M%S}.json")
    done = {}
    if args.resume and os.path.exists(out):
        done = {r["id"]: r for r in json.load(open(out))["rows"] if r["score"]}
        print(f"Resuming: {len(done)} scenarios already scored in {out}")
    todo = [s for s in scenarios if s.id not in done]
    if not todo:
        print("Nothing left to run.")

    if args.rpm > 0 and todo:
        _install_pacer(args.rpm)
        est = int(len(todo) * 1.7 / args.rpm) + 1
        print(f"Pacing at {args.rpm:g} Gemini calls/min: about {est} minutes for {len(todo)} messages. "
              "Progress is saved after every message; Ctrl+C is safe, then re-run with --resume.")

    def checkpoint(new_rows):
        _save(out, list(done.values()) + new_rows)

    try:
        new_rows, stop_reason = run(todo, sleep=args.sleep, progress=not args.failures, on_row=checkpoint)
    except KeyboardInterrupt:
        sys.exit(f"Interrupted. Progress saved in {out}; continue with: python -m evals.run_eval --out {out} --resume")

    order = {s.id: i for i, s in enumerate(SCENARIOS)}
    rows = sorted(list(done.values()) + new_rows, key=lambda r: order[r["id"]])
    report(rows, failures_only=args.failures)
    if stop_reason:
        print("\n" + stop_reason)
    _save(out, rows)
    print(f"Full results saved to {out}")
    if args.baseline:
        compare(rows, args.baseline)


if __name__ == "__main__":
    main()
