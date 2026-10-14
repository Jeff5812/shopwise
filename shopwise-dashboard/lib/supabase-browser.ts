import { createBrowserClient } from '@supabase/ssr';

// Browser client, used only by the login page to sign in. Data reads happen on the server.
export function getBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
