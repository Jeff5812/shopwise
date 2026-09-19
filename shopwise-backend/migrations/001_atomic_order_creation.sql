-- Applied to the live ShopWise Supabase project (verified against the real schema:
-- orders/order_items/product_variants/messages.related_order_id all exist as used below).
--
-- Replaces db.py's create_order() read-then-write stock decrement with one atomic
-- transaction. The old version had two problems:
--   1. Race condition: two concurrent orders for the same variant can both read
--      the same stock_quantity before either writes, double-selling it.
--   2. Unconditional oversell, even single-threaded: max(0, stock - qty) clamped to
--      zero and still created the order for the full quantity requested.
-- This function checks and decrements stock for every line item inside one
-- transaction and raises (rolling back everything) if ANY item lacks stock.

create or replace function create_order_with_stock(
  p_vendor_id uuid,
  p_customer_id uuid,
  p_message_id uuid,
  p_items jsonb  -- [{"variant_id": uuid, "quantity": int, "unit_price": numeric}, ...]
)
returns orders
language plpgsql
as $$
declare
  v_order orders;
  v_item jsonb;
  v_total numeric := 0;
  v_updated_rows int;
begin
  select coalesce(sum((item->>'quantity')::int * (item->>'unit_price')::numeric), 0)
    into v_total
    from jsonb_array_elements(p_items) as item;

  insert into orders (vendor_id, customer_id, status, total_amount)
  values (p_vendor_id, p_customer_id, 'awaiting_confirmation', v_total)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    update product_variants
    set stock_quantity = stock_quantity - (v_item->>'quantity')::int
    where id = (v_item->>'variant_id')::uuid
      and stock_quantity >= (v_item->>'quantity')::int;

    get diagnostics v_updated_rows = row_count;
    if v_updated_rows = 0 then
      -- Insufficient stock (or the variant doesn't exist) — raising rolls back
      -- the order insert and any earlier line items/decrements in this same call.
      raise exception 'insufficient_stock: variant % ', (v_item->>'variant_id')
        using errcode = 'P0001';
    end if;

    insert into order_items (order_id, product_variant_id, quantity, unit_price)
    values (
      v_order.id,
      (v_item->>'variant_id')::uuid,
      (v_item->>'quantity')::int,
      (v_item->>'unit_price')::numeric
    );
  end loop;

  update messages set related_order_id = v_order.id where id = p_message_id;

  return v_order;
end;
$$;

-- Backend-only: PUBLIC can execute new functions by default. Lock to service_role.
revoke execute on function create_order_with_stock(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function create_order_with_stock(uuid, uuid, uuid, jsonb) to service_role;
