-- Aligns the live CHECK constraints with the values the backend actually writes.
-- Verified against the live DB: none of these values were permitted, so every write
-- of them raised a constraint violation:
--   orders.status            'pending_payment'  -> mark_pending_payment() always failed,
--                            which left orders stuck at awaiting_confirmation (the
--                            "Ankara Gown" stuck-order bug) and blocked ALL payment links.
--   messages.intent          'cancel'           -> classification update failed for cancels.
--   review_queue.reason      recovery-path reasons -> the escalation itself failed.
-- Additive only: every value already permitted stays permitted.

alter table orders drop constraint orders_status_check;
alter table orders add constraint orders_status_check check (status = any (array[
  'awaiting_confirmation','pending_payment','confirmed','paid','dispatched',
  'out_for_delivery','delivered','canceled']));

alter table messages drop constraint messages_intent_check;
alter table messages add constraint messages_intent_check check (intent = any (array[
  'order','question','negotiation','cancel','noise','unclassified']));

alter table review_queue drop constraint review_queue_reason_check;
alter table review_queue add constraint review_queue_reason_check check (reason = any (array[
  'low_confidence','negotiation_below_floor','unparseable',
  'confirm_failed','cancel_failed','cancel_no_matching_order',
  'missing_email_for_payment','payment_link_generation_failed',
  'insufficient_stock','unhandled_error']));
