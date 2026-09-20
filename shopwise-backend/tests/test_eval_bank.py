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
