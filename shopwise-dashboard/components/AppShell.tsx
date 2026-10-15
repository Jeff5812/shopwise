'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { PageTransition } from '@/components/PageTransition';
import { AskShopwiseAI } from '@/components/AskShopwiseAI';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  if (pathname === '/login') return <>{children}</>; // no sidebar or search before sign-in

  return (
    <div className="min-h-screen bg-cream text-ink antialiased">
      <div className="flex min-h-screen">
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-sand bg-cream">
            <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
              <button
                type="button"
                aria-label="Open navigation"
                onClick={() => setMobileOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-sand bg-paper text-ink-soft transition-colors hover:bg-sand-soft lg:hidden"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
                </svg>
              </button>

              <label className="flex flex-1 items-center gap-2 rounded-lg border border-sand bg-paper px-3 py-2 text-ink-soft focus-within:border-ink focus-within:ring-2 focus-within:ring-ink/10">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="11" cy="11" r="5.25" />
                  <path d="M16 16l5 5" strokeLinecap="round" />
                </svg>
                <input
                  aria-label="Search"
                  placeholder="Search"
                  className="w-full bg-transparent text-sm text-ink placeholder:text-ink-soft focus:outline-none"
                />
              </label>

              <AskShopwiseAI onClick={() => router.push('/ai-assistant')} />

              <button
                type="button"
                aria-label="Notifications"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-sand bg-paper text-ink-soft transition-colors hover:bg-sand-soft"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M8 17h8l-1.1-1.2A2.4 2.4 0 0 1 14.2 15V11a2.2 2.2 0 1 0-4.4 0v4a2.4 2.4 0 0 1-.7 1.8L8 17Z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10 18.5a2 2 0 0 0 4 0" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </header>

          <main className="flex-1">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
      </div>
    </div>
  );
}
