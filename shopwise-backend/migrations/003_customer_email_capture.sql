-- Customer email capture for Paystack. Additive only.
--   customers.email          : captured over WhatsApp the first time a payment link is needed.
--   orders.awaiting_email    : true while we've asked the customer for an email and are
--                              waiting for the reply (cleared once the payment link is issued).
alter table customers add column if not exists email text;
alter table customers add constraint customers_email_format_check
  check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
alter table orders add column if not exists awaiting_email boolean not null default false;
