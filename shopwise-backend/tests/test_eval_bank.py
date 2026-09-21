"""
Offline checks on the evaluation bank and its runner (no Gemini, no Supabase).

The evals grade the product; these tests grade the evals, so a mistake in the bank or the scoring
can't quietly make a bad understanding layer look good (or a good one look bad).
"""
import json
import os
import pytest

import db

# run_eval sets dummy DB env vars and installs a DB tripwire at import time. That is right for the
# eval CLI but must not leak into other tests, so undo both right after importing.
_saved_env = {k: os.environ.get(k) for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")}
_saved_client = db.supabase
import evals.run_eval as ev  # noqa: E402
from evals.scenarios import SCENARIOS, STATES, CATALOG, PRICES  # noqa: E402
db.supabase = _saved_client
for _k, _v in _saved_env.items():
    if _v is None:
        os.environ.pop(_k, None)
    else:
        os.environ[_k] = _v

REQUIRED_CATEGORIES = {
    "quantity", "variant", "add", "remove", "multi_change", "yes_but", "question", "fulfilment", "casual",
    "ambiguous", "pidgin", "typos", "short", "reference", "no_change", "adversarial", "confirm_cancel", "compound",
}
VARIANTS = {v["variant_id"] for p in CATALOG for v in p["variants"]}


# ---- the bank itself ---------------------------------------------------------------------------
def test_bank_is_large_and_covers_every_category():
    assert len(SCENARIOS) >= 120
    assert REQUIRED_CATEGORIES <= {s.category for s in SCENARIOS}


def test_scenario_ids_unique_and_fields_valid():
    ids = [s.id for s in SCENARIOS]
    assert len(ids) == len(set(ids))
    for s in SCENARIOS:
        assert s.state in STATES and s.text.strip() and s.ok, s.id
        for spec in s.ok:
            assert spec["kind"] in {"confirm", "cancel", "modify", "modify_empty", "question", "casual", "unclear"}, s.id
            if spec["kind"] == "modify":
                assert spec["lines"] and set(spec["lines"]) <= VARIANTS, s.id
                assert all(isinstance(q, int) and q >= 1 for q in spec["lines"].values()), s.id


def test_states_only_use_real_variants_with_prices():
    for name, lines in STATES.items():
        assert lines and all(v in VARIANTS and v in PRICES and q >= 1 for v, q in lines), name


def test_every_message_that_mixes_yes_with_a_change_expects_a_modify_not_a_confirm():
    for s in SCENARIOS:
        if s.category == "yes_but":
            assert s.ok[0]["kind"] == "modify" and all(o["kind"] != "confirm" for o in s.ok), s.id


# ---- the harness -------------------------------------------------------------------------------
@pytest.fixture
def tripwire(monkeypatch):
    """Any unpatched database call during a prediction must blow up the test."""
    monkeypatch.setattr(db, "supabase", ev._DbTripwire())
    monkeypatch.setattr(ev.time, "sleep", lambda s: None)


_ORACLE_LABEL = {"confirm": "confirm", "cancel": "cancel", "question": "question", "casual": "casual",
                 "unclear": "other", "modify": "correct", "modify_empty": "correct"}


def _install_oracle(monkeypatch, current):
    def label(text):
        return _ORACLE_LABEL[current["sc"].ok[0]["kind"]]

    def interp(text, current_lines, catalog, history=None):
        spec = current["sc"].ok[0]
        items = [{"variant_id": v, "quantity": q} for v, q in spec["lines"].items()] if spec["kind"] == "modify" else []
        return {"line_items": items, "confidence": 0.95, "ambiguous_note": None}

    monkeypatch.setattr(ev.prc, "classify_pending_response", label)
    monkeypatch.setattr(ev.poh, "interpret_correction", interp)


def _grade_all(current):
    rows = []
    for sc in SCENARIOS:
        current["sc"] = sc
        pred = ev.predict(sc)
        rows.append({"id": sc.id, "category": sc.category, "state": sc.state, "text": sc.text,
                     "expected": list(sc.ok), "also": sc.also, "pred": pred, "seconds": 0.0,
                     "score": None if pred["kind"] == "error" else ev.score(sc, pred)})
    return rows


def test_a_perfect_understanding_layer_scores_100_percent_with_no_harms(monkeypatch, tripwire):
    current = {}
    _install_oracle(monkeypatch, current)
    rows = _grade_all(current)
    assert all(r["score"] for r in rows), [r["pred"] for r in rows if not r["score"]][:3]
    assert all(r["score"]["exact"] for r in rows), [(r["id"], r["pred"]) for r in rows if not r["score"]["exact"]][:5]
    assert not any(r["score"][k] for r in rows for k in ("unsafe_confirm", "unsafe_cancel", "wrong_edit"))


def test_an_always_confirm_system_is_flagged_for_every_unsafe_confirm(monkeypatch, tripwire):
    monkeypatch.setattr(ev.prc, "classify_pending_response", lambda text: "confirm")
    rows = _grade_all({})
    expect_unsafe = sum(1 for s in SCENARIOS if all(o["kind"] != "confirm" for o in s.ok))
    assert sum(r["score"]["unsafe_confirm"] for r in rows) == expect_unsafe > 0


def test_an_always_cancel_system_is_flagged(monkeypatch, tripwire):
    monkeypatch.setattr(ev.prc, "classify_pending_response", lambda text: "cancel")
    rows = _grade_all({})
    assert sum(r["score"]["unsafe_cancel"] for r in rows) > 0


def test_a_model_that_hallucinates_variants_never_edits_anything(monkeypatch, tripwire):
    monkeypatch.setattr(ev.prc, "classify_pending_response", lambda text: "correct")
    monkeypatch.setattr(ev.poh, "interpret_correction", lambda *a, **k: {
        "line_items": [{"variant_id": "does-not-exist", "quantity": 1}], "confidence": 0.99, "ambiguous_note": None})
    rows = _grade_all({})
    assert not any(r["score"]["wrong_edit"] for r in rows)
    assert {r["pred"]["kind"] for r in rows} == {"unclear"}


def test_a_confidently_wrong_model_is_caught_as_wrong_edit(monkeypatch, tripwire):
    monkeypatch.setattr(ev.prc, "classify_pending_response", lambda text: "correct")
    monkeypatch.setattr(ev.poh, "interpret_correction", lambda *a, **k: {
        "line_items": [{"variant_id": "soap", "quantity": 9}], "confidence": 0.99, "ambiguous_note": None})
    rows = _grade_all({})
    assert sum(r["score"]["wrong_edit"] for r in rows) > 0


def test_api_failures_are_reported_as_errors_not_silently_scored_as_misses(monkeypatch, tripwire):
    def boom(text):
        raise RuntimeError("503 UNAVAILABLE")
    monkeypatch.setattr(ev.prc, "classify_pending_response", boom)
    pred = ev.predict(SCENARIOS[0])
    assert pred["kind"] == "error"

    monkeypatch.setattr(ev.prc, "classify_pending_response", lambda text: "correct")
    monkeypatch.setattr(ev.poh, "interpret_correction", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))
    assert ev.predict(SCENARIOS[0])["kind"] == "error"


def test_the_db_tripwire_raises_on_any_access():
    with pytest.raises(AssertionError):
        ev._DbTripwire().table("orders")


def test_report_and_baseline_comparison_run_cleanly(monkeypatch, tripwire, tmp_path, capsys):
    current = {}
    _install_oracle(monkeypatch, current)
    rows = _grade_all(current)
    ev.report(rows)
    out = capsys.readouterr().out
    assert "Unsafe confirm" in out and "COMPOUND MESSAGES" in out

    base = tmp_path / "base.json"
    degraded = json.loads(json.dumps(rows, default=str))
    degraded[0]["score"]["passed"] = False           # pretend the baseline missed one that now passes
    base.write_text(json.dumps({"rows": degraded}))
    ev.compare(rows, str(base))
    assert "1 improved, 0 regressed" in capsys.readouterr().out


# ---- quota handling, pacing, checkpoint/resume (added after the free-tier 5 requests/min stop) -----
QUOTA_429 = ("429 RESOURCE_EXHAUSTED. {'error': {'code': 429, 'message': 'Quota exceeded ... Please retry in "
             "7.5s.', 'details': [{'retryDelay': '7s'}]}}")
QUOTA_DAILY = "429 RESOURCE_EXHAUSTED ... GenerateRequestsPerDayPerProjectPerModel-FreeTier ... limit: 20"


def _ok_pred():
    return {"kind": "casual", "label": "casual"}


def test_pacer_spaces_calls_to_the_requested_rate(monkeypatch):
    sleeps, clock = [], {"t": 1000.0}
    monkeypatch.setattr(ev.time, "time", lambda: clock["t"])
    monkeypatch.setattr(ev.time, "sleep", lambda s: (sleeps.append(round(s, 3)), clock.__setitem__("t", clock["t"] + s)))
    p = ev._Pacer(rpm=4)                       # one call every 15s
    p.wait(); clock["t"] += 2; p.wait(); clock["t"] += 20; p.wait()
    assert sleeps == [13.0] and p.calls == 3   # 2s elapsed -> wait 13s; 20s elapsed -> no wait


def test_install_pacer_wraps_the_real_client_call_path_once(monkeypatch):
    calls = []

    class Models:
        def generate_content(self, **kw):
            calls.append(kw)
            return "resp"

    shared = type("C", (), {"models": Models()})()
    monkeypatch.setattr(ev.prc, "client", shared)
    monkeypatch.setattr(ev.poh, "client", shared)      # same client used by both modules
    waits = []
    monkeypatch.setattr(ev._Pacer, "wait", lambda self: waits.append(1))
    ev._install_pacer(4)
    assert shared.models.generate_content(model="m", contents="x") == "resp"
    assert calls == [{"model": "m", "contents": "x"}] and len(waits) == 1, "wrapped exactly once, not twice"


def test_quota_wait_uses_googles_hint_with_sane_bounds():
    assert ev._quota_wait_seconds(QUOTA_429) == 15.0               # 7.5 + 5 = 12.5 -> floor 15
    assert ev._quota_wait_seconds("retry in 40s") == 45.0
    assert ev._quota_wait_seconds("retry in 500s") == 90.0         # capped
    assert ev._quota_wait_seconds("429 no hint here") == 65.0
    assert ev._is_quota_error(QUOTA_429) and not ev._is_quota_error("503 UNAVAILABLE") and not ev._is_quota_error(None)
    assert ev._is_daily_quota(QUOTA_DAILY) and not ev._is_daily_quota(QUOTA_429)


def test_run_waits_out_a_per_minute_quota_and_retries_instead_of_scoring_an_error(monkeypatch):
    slept, seen = [], []
    monkeypatch.setattr(ev.time, "sleep", lambda s: slept.append(s))

    def flaky(sc):
        seen.append(sc.id)
        return {"kind": "error", "error": QUOTA_429} if len(seen) < 3 else _ok_pred()
    monkeypatch.setattr(ev, "predict", flaky)
    rows, stop = ev.run(SCENARIOS[:1], progress=False)
    assert len(seen) == 3 and slept == [15.0, 15.0] and rows[0]["score"] is not None and stop is None


def test_run_gives_up_after_the_retry_budget_and_reports_an_error(monkeypatch):
    monkeypatch.setattr(ev.time, "sleep", lambda s: None)
    monkeypatch.setattr(ev, "predict", lambda sc: {"kind": "error", "error": QUOTA_429})
    rows, stop = ev.run(SCENARIOS[:1], progress=False, quota_retries=2)
    assert rows[0]["score"] is None and stop is None


def test_run_stops_cleanly_on_a_daily_quota_and_keeps_progress(monkeypatch):
    monkeypatch.setattr(ev.time, "sleep", lambda s: None)
    n = {"i": 0}

    def pred(sc):
        n["i"] += 1
        return _ok_pred() if n["i"] <= 2 else {"kind": "error", "error": QUOTA_DAILY}
    monkeypatch.setattr(ev, "predict", pred)
    saved = []
    rows, stop = ev.run(SCENARIOS[:6], progress=False, on_row=lambda r: saved.append(len(r)))
    assert len(rows) == 3 and stop and "--resume" in stop, "stops at the first daily-quota error, no wasted calls"
    assert saved == [1, 2, 3], "checkpoint callback fired after every message"


def test_main_saves_after_every_message_and_resume_only_reruns_whats_missing(monkeypatch, tmp_path, capsys):
    monkeypatch.setenv("GEMINI_API_KEY", "real-looking-key")
    out = str(tmp_path / "baseline.json")
    calls = []

    def pred(sc):
        calls.append(sc.id)
        if len(calls) == 3:
            raise KeyboardInterrupt            # user hits Ctrl+C mid-run
        return _ok_pred()
    monkeypatch.setattr(ev, "predict", pred)
    with pytest.raises(SystemExit) as e:
        ev.main(["--rpm", "0", "--limit", "5", "--out", out])
    assert "--resume" in str(e.value)
    saved = json.load(open(out))["rows"]
    assert [r["id"] for r in saved] == [s.id for s in SCENARIOS[:2]], "the two finished messages were saved"

    calls.clear()
    monkeypatch.setattr(ev, "predict", lambda sc: (calls.append(sc.id), _ok_pred())[1])
    ev.main(["--rpm", "0", "--limit", "5", "--out", out, "--resume"])
    assert calls == [s.id for s in SCENARIOS[2:5]], "resume re-ran only the unfinished ones"
    final = json.load(open(out))["rows"]
    assert [r["id"] for r in final] == [s.id for s in SCENARIOS[:5]] and all(r["score"] for r in final)
    assert not os.path.exists(out + ".tmp")
