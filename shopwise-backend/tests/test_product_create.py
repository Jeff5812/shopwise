"""POST /products: validation, duplicate protection, and rollback if variants fail."""
import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

import db
import main

client = TestClient(main.app)
VALID = {"vendor_id": "v1", "name": " Ankara Gown ", "cost_price": 8000, "sell_price": 15000,
         "variants": [{"size": "M", "color": "blue", "stock_quantity": 5}, {"size": " ", "color": "", "stock_quantity": 2}]}


def test_valid_request_defaults_floor_to_sell_price_and_cleans_input(monkeypatch):
    seen = {}

    def fake_create(vendor_id, name, cost, sell, floor, variants):
        seen.update(name=name, floor=floor, variants=variants)
        return {"id": "p1", "name": name, "variants": []}

    monkeypatch.setattr(main, "create_product", fake_create)
    r = client.post("/products", json=VALID)
    assert r.status_code == 201
    assert seen["name"] == "Ankara Gown" and seen["floor"] == 15000
    assert seen["variants"][1]["size"] is None and seen["variants"][1]["color"] is None


@pytest.mark.parametrize("patch", [
    {"name": "  "}, {"sell_price": 0}, {"cost_price": -1}, {"floor_price": 20000}, {"variants": []},
    {"variants": [{"size": "M", "color": "x", "stock_quantity": -1}]},
    {"variants": [{"size": "M", "color": "Blue", "stock_quantity": 1}, {"size": "m", "color": "blue", "stock_quantity": 2}]},
])
def test_invalid_requests_are_rejected_before_touching_the_database(monkeypatch, patch):
    monkeypatch.setattr(main, "create_product", lambda *a, **k: pytest.fail("must not reach the database"))
    assert client.post("/products", json={**VALID, **patch}).status_code == 422


def test_unknown_vendor_and_duplicate_name_map_to_404_and_409(monkeypatch):
    monkeypatch.setattr(main, "create_product", MagicMock(side_effect=LookupError()))
    assert client.post("/products", json=VALID).status_code == 404
    monkeypatch.setattr(main, "create_product", MagicMock(side_effect=db.DuplicateProductError("x")))
    assert client.post("/products", json=VALID).status_code == 409


def _fake_supabase(variant_insert_fails):
    sb = MagicMock()
    tables = {}

    def table(name):
        t = tables.setdefault(name, MagicMock())
        return t

    sb.table.side_effect = table
    table("vendors").select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [{"id": "v1"}]
    table("products").select.return_value.eq.return_value.execute.return_value.data = [{"name": "Shea Soap"}]
    table("products").insert.return_value.execute.return_value.data = [{"id": "p1", "name": "Ankara Gown"}]
    if variant_insert_fails:
        table("product_variants").insert.return_value.execute.side_effect = RuntimeError("boom")
    else:
        table("product_variants").insert.return_value.execute.return_value.data = [{"id": "var1"}]
    return sb, tables


VARS = [{"size": "M", "color": None, "stock_quantity": 1}]


def test_failed_variant_insert_deletes_only_the_product_it_created(monkeypatch):
    sb, tables = _fake_supabase(variant_insert_fails=True)
    monkeypatch.setattr(db, "supabase", sb)
    with pytest.raises(RuntimeError):
        db.create_product("v1", "Ankara Gown", 1, 2, 2, VARS)
    tables["products"].delete.return_value.eq.assert_called_once_with("id", "p1")


def test_duplicate_name_is_case_insensitive_and_inserts_nothing(monkeypatch):
    sb, tables = _fake_supabase(variant_insert_fails=False)
    monkeypatch.setattr(db, "supabase", sb)
    with pytest.raises(db.DuplicateProductError):
        db.create_product("v1", "  shea SOAP", 1, 2, 2, VARS)
    tables["products"].insert.assert_not_called()
