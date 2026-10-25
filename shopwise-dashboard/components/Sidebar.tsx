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

const itemBase =
  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-50';

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
    <div className="flex h-full w-60 flex-col bg-stone-900 text-stone-50">
      <div className="flex h-16 items-center justify-between gap-2 px-4">
        <Logo size={24} inverted />
        <button
          className="rounded-md p-1 text-stone-50/60 hover:text-stone-50 md:hidden"
          onClick={onClose}
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              aria-current={active ? 'page' : undefined}
              className={`${itemBase} ${
                active
                  ? 'bg-white/10 font-semibold text-stone-50'
                  : 'text-stone-50/65 hover:bg-white/5 hover:text-stone-50'
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-4 w-1 shrink-0 rounded-full ${active ? 'bg-emerald-600' : 'bg-transparent'}`}
              />
              <Icon size={15} strokeWidth={1.75} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-0.5 border-t border-white/10 p-3">
        <Link
          href="/settings"
          onClick={onClose}
          aria-current={pathname === '/settings' ? 'page' : undefined}
          className={`${itemBase} ${
            pathname === '/settings'
              ? 'bg-white/10 font-semibold text-stone-50'
              : 'text-stone-50/65 hover:bg-white/5 hover:text-stone-50'
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-4 w-1 shrink-0 rounded-full ${pathname === '/settings' ? 'bg-emerald-600' : 'bg-transparent'}`}
          />
          <SettingsIcon size={15} strokeWidth={1.75} />
          Settings
        </Link>
        <form action="/logout" method="post">
          <button
            type="submit"
            className={`${itemBase} w-full text-left text-stone-50/65 hover:bg-white/5 hover:text-stone-50`}
          >
            <span aria-hidden="true" className="h-4 w-1 shrink-0" />
            Sign out
          </button>
        </form>
        <div className="mt-1 flex items-center gap-2.5 px-2.5 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-200 text-[11px] font-semibold text-stone-900">
            {storeName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 text-[12px] leading-tight">
            <p className="truncate font-medium text-stone-50">{storeName}</p>
            <p className="text-stone-50/60">Free plan</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden md:flex">{content}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-stone-900/40" onClick={onClose} />
          <aside className="absolute inset-y-0 left-0 z-50 w-60">{content}</aside>
        </div>
      )}
    </>
  );
}
