"""
Regression test for the "intent: null, confidence: null forever" bug: get_pending_order()
was the one external call in the webhook handler with no try/except, so a transient
Supabase failure there crashed the whole request before classification ever ran, leaving
the logged message permanently unclassified with no reply sent.

This test exercises the exact source line rather than the full FastAPI route (the route
needs a live event loop and many more mocked dependencies to run end-to-end); it proves
the fix is present and correctly shaped so a future refactor can't silently drop it.
"""
import ast


def test_get_pending_order_call_is_guarded_by_try_except():
    with open("main.py") as f:
        tree = ast.parse(f.read())

    receive_message_fn = next(
        node for node in ast.walk(tree)
        if isinstance(node, ast.AsyncFunctionDef) and node.name == "receive_message"
    )

    # Find the try/except (KeyError, IndexError) body — the pending_order call must be
    # inside its own nested try/except, not a bare call directly in that body.
    outer_try = next(
        node for node in ast.walk(receive_message_fn)
        if isinstance(node, ast.Try)
    )

    def calls_get_pending_order(node):
        return any(
            isinstance(n, ast.Call) and getattr(n.func, "id", None) == "get_pending_order"
            for n in ast.walk(node)
        )

    # The call must appear inside a nested Try node, not as a bare statement in outer_try.body
    nested_tries_containing_call = [
        n for n in ast.walk(outer_try) if isinstance(n, ast.Try) and n is not outer_try and calls_get_pending_order(n)
    ]
    assert nested_tries_containing_call, (
        "get_pending_order() must be called inside its own try/except — an unguarded "
        "call here reproduces the 'intent: null forever' production bug."
    )
