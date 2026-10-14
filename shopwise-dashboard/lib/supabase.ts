import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server-side Supabase client bound to the logged-in user's session cookie. It uses the public
// anon key, but every request carries the user's login, so row level security decides what comes
// back: only rows belonging to the vendors this login is linked to (table vendor_users).
// Called per request, never cached at module level, because the session differs per visitor.
export async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          // Server components cannot set cookies; proxy.ts refreshes the session instead.
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    },
  );
}
