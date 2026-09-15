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
    <div className="flex h-full w-56 flex-col border-r border-stone-200 bg-white">
      <div className="flex h-14 items-center justify-between gap-2 border-b border-stone-200 px-4">
        <Logo size={22} />
        <button className="text-stone-400 md:hidden" onClick={onClose} aria-label="Close menu">
          <X size={18} />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 py-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-2.5 rounded-lg border-l-2 px-2.5 py-1.5 text-[13px] transition-all ${
                active
                  ? 'border-emerald-600 bg-emerald-50 font-semibold text-emerald-800 shadow-[inset_0_0_0_1px_rgba(5,150,105,0.12)]'
                  : item.accent
                    ? 'border-transparent font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                    : 'border-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <Icon size={15} strokeWidth={1.75} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-0.5 border-t border-stone-200 p-2.5">
        <Link
          href="/settings"
          onClick={onClose}
          className={`flex items-center gap-2.5 rounded-none border-l-2 px-2.5 py-1.5 text-[13px] transition-colors ${
            pathname === '/settings'
              ? 'border-stone-900 bg-stone-100 font-semibold text-stone-900'
              : 'border-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-900'
          }`}
        >
          <SettingsIcon size={15} strokeWidth={1.75} />
          Settings
        </Link>
        <div className="mt-1 flex items-center gap-2 px-2.5 py-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-200 text-[10px] font-medium text-stone-700">
            {storeName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 text-[12px] leading-tight">
            <p className="truncate font-medium text-stone-800">{storeName}</p>
            <p className="text-stone-400">Free plan</p>
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
          <div className="absolute inset-0 bg-black/30" onClick={onClose} />
          <aside className="absolute inset-y-0 left-0 z-50 w-56 bg-white">{content}</aside>
        </div>
      )}
    </>
  );
}
