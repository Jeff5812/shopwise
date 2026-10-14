'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { getBrowserSupabase } from '@/lib/supabase-browser';

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

  const field = 'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900';
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <Logo />
      <h1 className="text-2xl font-semibold text-stone-900">Sign in</h1>
      <input className={field} type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className={field} type="password" autoComplete="current-password" placeholder="Password" value={password}
        onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && signIn()} />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <Button type="button" disabled={busy || !email || !password} onClick={signIn}>{busy ? 'Signing in…' : 'Sign in'}</Button>
    </main>
  );
}
