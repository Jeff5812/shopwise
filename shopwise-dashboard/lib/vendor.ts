import { supabase } from '@/lib/supabase';

// Single-tenant MVP: every dashboard page needs "the current vendor" and, until
// real auth exists, that's resolved by a fixed WhatsApp phone_number_id rather
// than a logged-in session. This used to be copy-pasted into 7 separate page.tsx
// files verbatim — when auth eventually replaces this lookup, there was no
// single place to change it. Now there's exactly one.
//
// NEXT_PUBLIC_VENDOR_WHATSAPP_PHONE_NUMBER_ID lets this be overridden per
// environment without a code change; falls back to the value every page was
// already hardcoding so this is a drop-in replacement, not a behavior change.
const VENDOR_WHATSAPP_PHONE_NUMBER_ID =
  process.env.NEXT_PUBLIC_VENDOR_WHATSAPP_PHONE_NUMBER_ID || '1369817666207594';

export async function getVendor() {
  const { data } = await supabase
    .from('vendors')
    .select('*')
    .eq('whatsapp_phone_number_id', VENDOR_WHATSAPP_PHONE_NUMBER_ID)
    .limit(1)
    .maybeSingle();
  return data;
}
