import { getSupabase } from '@/lib/supabase';

// "The current vendor" for this logged-in user. Row level security only returns vendors linked
// to this login (table vendor_users), so there is no hardcoded phone number id any more.
export async function getVendor() {
  const { data } = await (await getSupabase())
    .from('vendors')
    .select('*')
    .limit(1)
    .maybeSingle();
  return data;
}
