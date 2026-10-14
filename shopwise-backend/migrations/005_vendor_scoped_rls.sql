-- 005: vendor-scoped row level security (phase 1, ADDITIVE: nothing is dropped).
--
-- Adds the login -> vendor link and "you only see your own vendor's rows" SELECT policies for
-- logged-in dashboard users. The old "Allow anon read access" policies are left in place on
-- purpose so the live dashboard keeps working until it has a login; 006 removes them.
-- Dashboard writes never go through these policies: they go through shopwise-backend, which
-- uses the service role (bypasses RLS), so no INSERT/UPDATE/DELETE policies exist for users.

create table if not exists public.vendor_users (
  user_id   uuid not null references auth.users(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  primary key (user_id, vendor_id)
);
alter table public.vendor_users enable row level security;

create policy "Users can read their own vendor links" on public.vendor_users
  for select to authenticated
  using (user_id = (select auth.uid()));

-- SECURITY DEFINER so policies on other tables can look up the caller's vendors without
-- recursing through vendor_users' own RLS. Empty search_path + fully qualified names.
create or replace function public.my_vendor_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$ select vendor_id from public.vendor_users where user_id = (select auth.uid()) $$;
revoke execute on function public.my_vendor_ids() from public, anon;
grant execute on function public.my_vendor_ids() to authenticated;

-- Tables with their own vendor_id
create policy "Vendor members read vendors" on public.vendors
  for select to authenticated using (id in (select public.my_vendor_ids()));
create policy "Vendor members read customers" on public.customers
  for select to authenticated using (vendor_id in (select public.my_vendor_ids()));
create policy "Vendor members read products" on public.products
  for select to authenticated using (vendor_id in (select public.my_vendor_ids()));
create policy "Vendor members read orders" on public.orders
  for select to authenticated using (vendor_id in (select public.my_vendor_ids()));
create policy "Vendor members read messages" on public.messages
  for select to authenticated using (vendor_id in (select public.my_vendor_ids()));
create policy "Vendor members read faq_snippets" on public.faq_snippets
  for select to authenticated using (vendor_id in (select public.my_vendor_ids()));
create policy "Vendor members read fulfillment_defaults" on public.fulfillment_defaults
  for select to authenticated using (vendor_id in (select public.my_vendor_ids()));

-- Child tables: inherit the vendor through their parent row
create policy "Vendor members read product_variants" on public.product_variants
  for select to authenticated using (product_id in (select id from public.products where vendor_id in (select public.my_vendor_ids())));
create policy "Vendor members read order_items" on public.order_items
  for select to authenticated using (order_id in (select id from public.orders where vendor_id in (select public.my_vendor_ids())));
create policy "Vendor members read payments" on public.payments
  for select to authenticated using (order_id in (select id from public.orders where vendor_id in (select public.my_vendor_ids())));
create policy "Vendor members read review_queue" on public.review_queue
  for select to authenticated using (message_id in (select id from public.messages where vendor_id in (select public.my_vendor_ids())));

-- After creating a login in Supabase > Authentication > Users, link it to its vendor:
--   insert into public.vendor_users (user_id, vendor_id)
--   values ('<the user id shown in Authentication > Users>', '<the vendor id>');
