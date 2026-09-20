# Understanding evals

Measures how well Shopwise understands real customer messages while an order is pending, using
**real Gemini**. The 101+ unit tests prove the *backend* behaves safely given a classification;
this proves the *AI* produces the right classification in the first place.

## Run (from `shopwise-backend`, with `GEMINI_API_KEY` in `.env`)

    python -m evals.run_eval                          # all 158 scenarios
    python -m evals.run_eval --category pidgin        # one category
    python -m evals.run_eval --failures               # print only the report
    python -m evals.run_eval --out evals/baseline.json            # save a baseline you want to keep
    python -m evals.run_eval --baseline evals/baseline.json       # compare a later run against it

It never touches Supabase or WhatsApp (database faked, tripwire on the real client).
Runs cost about 2 Gemini calls per scenario. Use `--sleep 1` if you hit rate limits.

## Reading the report

* **Acceptable / ideal**: `ideal` is the first outcome listed for a scenario, `acceptable` also
  allows the safe alternatives (e.g. asking a clarifying question instead of guessing).
* **Harms** (read these first): unsafe confirm (a payment link nobody asked for), unsafe cancel,
  wrong edit (the order changed to something the customer didn't ask for).
* **Compound messages**: two intents in one message; a single-label pipeline can serve only one.
* **API errors** are excluded from the score. Re-run them.

## Rules for this folder

* Scenarios are an **exam, not product rules**. Never add an `if` in the product because a
  scenario exists; improve the general mechanism and re-run.
* `predict()` in `run_eval.py` is the only code coupled to how the product is wired.
* `tests/test_eval_bank.py` checks the bank and scoring offline (no Gemini needed).
