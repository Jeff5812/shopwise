'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { getBrowserSupabase } from '@/lib/supabase-browser';

const marketingUrl =
  process.env.NEXT_PUBLIC_MARKETING_URL?.trim() ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setError(null);
    const { error } = await getBrowserSupabase().auth.signInWithPassword({ email, password });
    if (error) {
      setError('That email and password did not match.');
      setBusy(false);
      return;
    }
    router.replace('/');
    router.refresh();
  }

  const field =
    'h-12 w-full rounded-sm border border-stone-300 bg-white px-3.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20';
  return (
    <main className="grid min-h-screen bg-stone-50 lg:grid-cols-2">
      <section className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <Logo />
            <h1 className="mt-8 font-serif text-3xl font-semibold tracking-tight text-stone-900">
              Welcome back
            </h1>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Sign in to manage your WhatsApp orders, stock and profit.
            </p>
          </div>

          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void signIn();
            }}
          >
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-stone-800">
                Email
              </label>
              <input
                id="email"
                className={field}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-stone-800">
                Password
              </label>
              <input
                id="password"
                className={field}
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-rose-700">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || !email || !password}
              className="h-12 w-full rounded-sm border border-emerald-800 bg-emerald-800 text-sm font-semibold text-white transition-colors hover:border-emerald-900 hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-800 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          {marketingUrl ? (
            <a
              href={marketingUrl}
              className="mt-6 inline-block text-sm font-medium text-emerald-800 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-800 focus-visible:ring-offset-2"
            >
              Back to Shopwise
            </a>
          ) : null}
        </div>
      </section>

      <aside className="hidden bg-emerald-900 px-12 py-16 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <p className="text-sm font-medium tracking-wide text-emerald-100">Built for Nigerian sellers</p>
        <div className="max-w-lg">
          <h2 className="font-serif text-5xl font-medium leading-tight tracking-tight xl:text-6xl">
            Every order in view. Every naira accounted for.
          </h2>
          <p className="mt-6 max-w-md text-base leading-7 text-emerald-50">
            Keep WhatsApp sales, stock levels and what you really earn together in one clear place.
          </p>
        </div>
        <p className="text-sm text-emerald-100">Orders, inventory and profit—made easier with Shopwise.</p>
      </aside>
    </main>
  );
}
