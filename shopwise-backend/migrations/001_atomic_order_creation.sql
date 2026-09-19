-- Run this once in the Supabase SQL editor. Not applied automatically — this
-- sandbox has no live Supabase credentials, so this has been written carefully
-- but NOT executed against the real database. Test on a copy first if possible.
--
-- Replaces db.py's create_order() read-then-write stock decrement (three
-- separate round trips per line item: insert order_items, SELECT stock_quantity,
-- UPDATE stock_quantity) with one atomic transaction. The old version had two
-- problems, not just the race condition the client flagged:
--   1. Race condition: two concurrent orders for the same variant can both read
--      the same stock_quantity before either writes, double-selling it.
--   2. Unconditional oversell, even single-threaded: `max(0, stock - qty)`
--      silently clamps to zero and still creates the order for the full
--      quantity requested, even when stock is 0 or less than qty. One customer,
--      one request, no race needed — an order for more than what's in stock
--      was always accepted.
--
-- This function checks and decrements stock for every line item inside one
-- transaction, and raises (rolling back the whole order, including anything
-- already inserted) if ANY item doesn't have enough stock. All-or-nothing.

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
