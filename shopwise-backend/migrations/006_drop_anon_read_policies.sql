-- 006: RLS phase 2. DO NOT RUN until the dashboard login (feature/dashboard-auth) is deployed,
-- a vendor_users row links your login to your vendor, and you have confirmed you can sign in
-- and see your data. After this, the public anon key can read nothing; only logged-in users see
-- their own vendor's rows (policies from 005), and shopwise-backend keeps full access through
-- the service role.

drop policy "Allow anon read access to customers"        on public.customers;
drop policy "Allow anon read access to messages"         on public.messages;
drop policy "Allow anon read access to order_items"      on public.order_items;
drop policy "Allow anon read access to orders"           on public.orders;
drop policy "Allow anon read access to product_variants" on public.product_variants;
drop policy "Allow anon read access to products"         on public.products;
drop policy "Allow anon read access to vendors"          on public.vendors;
