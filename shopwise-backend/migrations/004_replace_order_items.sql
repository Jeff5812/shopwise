-- Atomic in-place correction of an order that is still awaiting the customer's yes/no.
--
-- Sibling of create_order_with_stock (001). When a customer says "actually make it 2" the
-- SAME order is edited, never a second order created. In one transaction this:
--   1. locks the order row and refuses unless status = 'awaiting_confirmation'
--      (a pending_payment / confirmed order must never be silently rewritten),
--   2. restocks the old lines,
--   3. re-checks and decrements stock for the new lines (raises insufficient_stock and
--      rolls EVERYTHING back, so a failed correction leaves the original order untouched),
--   4. replaces order_items and recalculates orders.total_amount.
-- Prices are supplied by the backend from the catalog, never by the model.

create or replace function replace_order_items_with_stock(
  p_order_id uuid,
  p_items jsonb  -- [{"variant_id": uuid, "quantity": int, "unit_price": numeric}, ...]
)
returns orders
language plpgsql
as $$
declare
  v_order orders;
  v_old record;
  v_item jsonb;
  v_total numeric := 0;
  v_updated_rows int;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if v_order.status <> 'awaiting_confirmation' then
    raise exception 'order_not_editable: %', v_order.status using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_order' using errcode = 'P0001';
  end if;

  for v_old in select product_variant_id, quantity from order_items where order_id = p_order_id
  loop
    update product_variants
    set stock_quantity = stock_quantity + v_old.quantity
    where id = v_old.product_variant_id;
  end loop;
  delete from order_items where order_id = p_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if (v_item->>'quantity')::int <= 0 then
      raise exception 'invalid_quantity' using errcode = 'P0001';
    end if;

    update product_variants
    set stock_quantity = stock_quantity - (v_item->>'quantity')::int
    where id = (v_item->>'variant_id')::uuid
      and stock_quantity >= (v_item->>'quantity')::int;

    get diagnostics v_updated_rows = row_count;
    if v_updated_rows = 0 then
      raise exception 'insufficient_stock: variant % ', (v_item->>'variant_id')
        using errcode = 'P0001';
    end if;

    insert into order_items (order_id, product_variant_id, quantity, unit_price)
    values (
      p_order_id,
      (v_item->>'variant_id')::uuid,
      (v_item->>'quantity')::int,
      (v_item->>'unit_price')::numeric
    );

    v_total := v_total + (v_item->>'quantity')::int * (v_item->>'unit_price')::numeric;
  end loop;

  update orders set total_amount = v_total where id = p_order_id returning * into v_order;
  return v_order;
end;
$$;

revoke execute on function replace_order_items_with_stock(uuid, jsonb) from public, anon, authenticated;
grant execute on function replace_order_items_with_stock(uuid, jsonb) to service_role;
