import { useState } from 'react';
import {
  LayoutGrid,
  ShoppingBag,
  MessageSquare,
  Package,
  AlertTriangle,
  Users,
  BarChart3,
  Settings as SettingsIcon,
  Menu,
  X,
} from 'lucide-react';
import { Logo } from './Logo';
import { AiSparkle } from './AiSparkle';

const NAV_ITEMS = [
  { label: 'Overview', icon: LayoutGrid, href: '/' },
  { label: 'Orders', icon: ShoppingBag, href: '/orders' },
  { label: 'Inbox', icon: MessageSquare, href: '/inbox' },
  { label: 'Inventory', icon: Package, href: '/inventory' },
  { label: 'Replenishment', icon: AlertTriangle, href: '/replenishment' },
  { label: 'Customers', icon: Users, href: '/customers' },
  { label: 'Analytics', icon: BarChart3, href: '/analytics' },
  { label: 'AI Assistant', icon: AiSparkle, href: '/ai-assistant', accent: true },
];

export function Sidebar({ currentPath = '/', storeName = 'My store', LinkComponent = 'a' }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const Link = LinkComponent;

  const linkProps = (href) => (Link === 'a' ? { href } : { to: href, href });

  const NavList = () => (
    <>
      <div className="h-14 flex items-center justify-between gap-2 px-4 border-b border-stone-200">
        <Logo size={22} />
        <button className="md:hidden text-stone-400" onClick={() => setMobileOpen(false)} aria-label="Close menu">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = currentPath === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              {...linkProps(item.href)}
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] transition-colors duration-100 ${
                active
                  ? 'bg-emerald-50 text-emerald-800 font-medium'
                  : item.accent
                  ? 'text-emerald-700 hover:bg-emerald-50 font-medium'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Icon size={15} strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-2.5 border-t border-stone-200 space-y-0.5">
        <Link
          {...linkProps('/settings')}
          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] transition-colors duration-100 ${
            currentPath === '/settings' ? 'bg-emerald-50 text-emerald-800 font-medium' : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <SettingsIcon size={15} strokeWidth={1.75} />
          Settings
        </Link>
        <div className="flex items-center gap-2 px-2.5 py-2 mt-1">
          <div className="w-6 h-6 rounded-full bg-stone-200 flex items-center justify-center text-[10px] font-medium shrink-0">
            {storeName.charAt(0).toUpperCase()}
          </div>
          <div className="text-[12px] leading-tight min-w-0">
            <p className="font-medium text-stone-800 truncate">{storeName}</p>
            <p className="text-stone-400">Free plan</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden md:flex w-48 shrink-0 border-r border-stone-200 bg-white flex-col h-screen sticky top-0">
        <NavList />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-56 bg-white flex flex-col z-50">
            <NavList />
          </aside>
        </div>
      )}

      <button
        className="md:hidden fixed top-3.5 left-4 z-30 text-stone-500"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={19} />
      </button>
    </>
  );
}
