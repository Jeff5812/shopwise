"""Small shared helpers for reading the vendor catalog (kept separate so the AI-facing module and the
business-rules module don't have to import each other)."""


def variant_index(catalog: list) -> dict:
    """variant_id -> display info + the authoritative catalog price and owning product."""
    index = {}
    for product in catalog:
        for v in product["variants"]:
            index[v["variant_id"]] = {
                "product_id": product["product_id"],
                "product_name": product["name"],
                "size": v.get("size"),
                "color": v.get("color"),
                "unit_price": product["sell_price"],
            }
    return index


def variant_label(info: dict) -> str:
    """'Ankara Gown (M, blue)' for display; plain name when the variant has no size/color."""
    extras = [x for x in (info.get("size"), info.get("color")) if x]
    return f"{info['product_name']} ({', '.join(extras)})" if extras else info["product_name"]
