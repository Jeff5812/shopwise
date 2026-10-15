'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { AiSparkle } from '@/components/AiSparkle';
import {
  LayoutGrid,
  ShoppingBag,
  MessageSquare,
  Package,
  AlertTriangle,
  Users,
  BarChart3,
  Settings as SettingsIcon,
  X,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: LayoutGrid },
  { href: '/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/inbox', label: 'Inbox', icon: MessageSquare },
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/replenishment', label: 'Replenishment', icon: AlertTriangle },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/ai-assistant', label: 'AI Assistant', icon: AiSparkle, accent: true },
];

export function Sidebar({
  mobileOpen,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const storeName = 'My store';

  const content = (
    <div className="on-dark flex h-full w-60 flex-col bg-ink p-4 text-cream">
      <div className="mb-8 flex items-center justify-between gap-2 px-2">
        <Logo size={22} />
        <button className="rounded-lg p-2 text-cream/70 hover:bg-white/10 hover:text-cream lg:hidden" onClick={onClose} aria-label="Close menu">
          <X size={18} />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto text-sm">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                active
                  ? 'bg-white/10 font-medium text-cream'
                  : item.accent
                    ? 'font-medium text-cream/70 transition hover:bg-white/5 hover:text-cream'
                    : 'text-cream/70 transition hover:bg-white/5 hover:text-cream'
              }`}
            >
              <span className={`h-4 w-1 shrink-0 rounded-full ${active ? 'bg-brand' : 'bg-transparent'}`} />
              <Icon size={16} strokeWidth={1.8} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 space-y-1 border-t border-white/10 pt-3">
        <Link
          href="/settings"
          onClick={onClose}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
            pathname === '/settings'
              ? 'bg-white/10 font-medium text-cream'
              : 'text-cream/70 hover:bg-white/5 hover:text-cream'
          }`}
        >
          <SettingsIcon size={16} strokeWidth={1.8} />
          Settings
        </Link>
        <form action="/logout" method="post">
          <button type="submit" className="w-full rounded-lg px-3 py-2 text-left text-sm text-cream/70 transition-colors hover:bg-white/5 hover:text-cream">
            Sign out
          </button>
        </form>
        <div className="mt-auto flex items-center gap-3 rounded-lg p-2 text-sm">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sand text-xs font-medium text-ink">
            {storeName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate font-medium text-cream">{storeName}</p>
            <p className="text-xs text-cream/70">Free plan</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden lg:flex">{content}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-ink/40" onClick={onClose} />
          <aside className="absolute inset-y-0 left-0 z-50">{content}</aside>
        </div>
      )}
    </>
  );
}
