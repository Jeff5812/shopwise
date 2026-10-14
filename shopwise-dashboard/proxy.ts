import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Runs before every page request (Next 16 "proxy", formerly middleware). Refreshes the Supabase
// session cookie and sends anyone who is not logged in to /login. getUser() asks Supabase to
// verify the session; getSession() would trust the cookie as-is, which is not safe for gating.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const onLoginPage = request.nextUrl.pathname === '/login';

  if (!user && !onLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (user && onLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
