"""ConversationState: a read-only snapshot for resolving 'it', 'that', 'the last one'."""
import pytest
import conversation_state as cs

CATALOG = [
    {"product_id": "p1", "name": "Lavender Candle", "sell_price": 2500, "floor_price": 2000,
     "variants": [{"variant_id": "v-candle", "size": None, "color": None, "stock_quantity": 5}]},
    {"product_id": "p2", "name": "Ankara Gown", "sell_price": 15000, "floor_price": 12000,
     "variants": [{"variant_id": "v-gown", "size": "M", "color": "red", "stock_quantity": 3}]},
]
VENDOR, CUSTOMER = {"id": "v1"}, {"id": "c1"}
ORDER = {"id": "o1", "status": "awaiting_confirmation"}


def rows(*pairs):
    return [{"product_variant_id": v, "quantity": q, "unit_price": 1} for v, q in pairs]


def test_build_state_lists_lines_in_order_with_readable_labels():
    st = cs.build_state(VENDOR, CUSTOMER, ORDER, rows(("v-gown", 1), ("v-candle", 2)), CATALOG, [{"raw_text": "hi"}])
    assert st.lines == [{"variant_id": "v-gown", "product_name": "Ankara Gown (M, red)", "quantity": 1},
                        {"variant_id": "v-candle", "product_name": "Lavender Candle", "quantity": 2}]
    assert st.awaiting == "confirmation" and st.pending_order == ORDER
    assert st.vendor_id == "v1" and st.customer_id == "c1" and st.history == [{"raw_text": "hi"}]


def test_no_pending_order_means_nothing_is_awaited():
    st = cs.build_state(VENDOR, CUSTOMER, None, [], CATALOG, [])
    assert st.lines == [] and st.awaiting is None and st.pending_order is None


def test_lines_for_variants_no_longer_in_the_catalog_are_skipped_not_fatal():
    st = cs.build_state(VENDOR, CUSTOMER, ORDER, rows(("v-candle", 1), ("v-deleted", 4)), CATALOG, [])
    assert [l["variant_id"] for l in st.lines] == ["v-candle"]


def test_state_is_read_only():
    st = cs.build_state(VENDOR, CUSTOMER, ORDER, [], CATALOG, [])
    with pytest.raises(Exception):
        st.awaiting = "something"


def _patch(monkeypatch, **fns):
    base = dict(get_vendor_catalog=lambda vid: CATALOG,
                get_order_items=lambda oid: rows(("v-candle", 1)),
                get_conversation_history=lambda vid, cid, exclude_message_id=None: [{"raw_text": "earlier"}])
    base.update(fns)
    for k, v in base.items():
        monkeypatch.setattr(cs, k, v)


def test_load_state_uses_the_existing_db_reads(monkeypatch):
    seen = {}
    _patch(monkeypatch, get_conversation_history=lambda vid, cid, exclude_message_id=None:
           seen.update(vid=vid, cid=cid, ex=exclude_message_id) or [])
    st = cs.load_state(VENDOR, CUSTOMER, ORDER, exclude_message_id="m-now")
    assert seen == {"vid": "v1", "cid": "c1", "ex": "m-now"}
    assert st.lines[0]["variant_id"] == "v-candle" and st.catalog == CATALOG


def test_load_state_does_not_read_order_lines_when_nothing_is_pending(monkeypatch):
    _patch(monkeypatch, get_order_items=lambda oid: (_ for _ in ()).throw(AssertionError("must not be called")))
    assert cs.load_state(VENDOR, CUSTOMER, None).lines == []


@pytest.mark.parametrize("failing", ["get_vendor_catalog", "get_order_items", "get_conversation_history"])
def test_each_failed_read_degrades_that_part_only_and_never_raises(monkeypatch, failing):
    boom = lambda *a, **k: (_ for _ in ()).throw(RuntimeError("supabase blip"))
    _patch(monkeypatch, **{failing: boom})
    st = cs.load_state(VENDOR, CUSTOMER, ORDER)
    assert st.pending_order == ORDER and st.awaiting == "confirmation"
    assert (st.catalog == []) == (failing == "get_vendor_catalog")
    assert (st.history == []) == (failing == "get_conversation_history")
    if failing in ("get_vendor_catalog", "get_order_items"):
        assert st.lines == []                    # no catalog => no labels; no rows => no lines
