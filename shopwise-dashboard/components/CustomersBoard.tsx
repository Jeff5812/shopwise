'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';

function formatMoney(value: number | null | undefined) {
  const numeric = Number(value ?? 0);
  return `₦${numeric.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function CustomersBoard({ customers }: { customers: any[] }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'total' | 'orders' | 'recent'>('total');
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

  const visibleCustomers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const items = customers.filter((customer) => {
      if (!normalized) return true;
      const label = `${customer.name || customer.display_name || customer.wa_id || ''} ${customer.wa_id || ''}`.toLowerCase();
      return label.includes(normalized);
    });

    return [...items].sort((a, b) => {
      if (sort === 'orders') return Number(b.order_count) - Number(a.order_count);
      if (sort === 'recent') return new Date(b.last_order || 0).getTime() - new Date(a.last_order || 0).getTime();
      return Number(b.total_spent) - Number(a.total_spent);
    });
  }, [customers, query, sort]);

  const summary = useMemo(() => {
    const totalCustomers = customers.length;
    const newCustomers = customers.filter((customer) => customer.order_count === 1).length;
    const returningCustomers = customers.filter((customer) => customer.order_count > 1).length;
    const customerValue = customers.reduce((sum, item) => sum + Number(item.total_spent || 0), 0);
    return { totalCustomers, newCustomers, returningCustomers, customerValue };
  }, [customers]);

  if (!customers.length) {
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-6 xl:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.05em] text-stone-900">Customers</h1>
          </div>
        </div>
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 border border-dashed border-stone-200 bg-white p-8 text-center">
          <div>
            <p className="text-lg font-medium text-stone-900">No customers yet</p>
            <p className="mt-1 text-sm text-stone-500">Customer data will appear here as soon as orders are received.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6 xl:p-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-semibold tracking-[-0.05em] text-stone-900">Customers</h1>
        <div className="flex w-full max-w-xl items-center gap-2 sm:w-auto">
          <label className="flex flex-1 items-center gap-2 surface-card px-3 py-2 text-sm text-stone-500">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="5.5" />
              <path d="M16 16l4.5 4.5" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search customer"
              className="w-full bg-transparent text-stone-700 placeholder:text-stone-400 focus:outline-none"
            />
          </label>
          <Button variant="secondary" className="h-10 px-3 text-sm">Filter</Button>
          <Button variant="secondary" className="h-10 px-3 text-sm" onClick={() => setSort((current) => current === 'total' ? 'orders' : current === 'orders' ? 'recent' : 'total')}>
            Sort
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-stone-500">
        <div className="flex items-center gap-2">
          <span>Total customers</span>
          <span className="font-data text-base text-stone-900">{summary.totalCustomers}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>New</span>
          <span className="font-data text-base text-stone-900">{summary.newCustomers}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Returning</span>
          <span className="font-data text-base text-stone-900">{summary.returningCustomers}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Customer value</span>
          <span className="font-data text-base text-stone-900">{formatMoney(summary.customerValue)}</span>
        </div>
      </div>

      <div className="overflow-hidden border border-stone-200 bg-white">
        <div className="hidden border-b border-stone-200 bg-stone-50 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500 sm:grid sm:grid-cols-[1.5fr_0.8fr_1fr_1fr_0.8fr]">
          <div className="px-4 py-3">Customer</div>
          <div className="px-4 py-3">Orders</div>
          <div className="px-4 py-3">Total spent</div>
          <div className="px-4 py-3">Last order</div>
          <div className="px-4 py-3">Status</div>
        </div>

        {visibleCustomers.map((customer) => (
          <button
            key={customer.id}
            type="button"
            onClick={() => setSelectedCustomer(customer)}
            className="block w-full border-b border-stone-100 text-left transition-colors last:border-0 hover:bg-stone-50 sm:grid sm:grid-cols-[1.5fr_0.8fr_1fr_1fr_0.8fr]"
          >
            <div className="px-4 py-3 text-sm text-stone-800">{customer.name || customer.display_name || customer.wa_id || 'Customer'}</div>
            <div className="px-4 py-3 font-data text-sm text-stone-600">{customer.order_count ?? 0}</div>
            <div className="px-4 py-3 font-data text-sm text-stone-800">{formatMoney(customer.total_spent)}</div>
            <div className="px-4 py-3 font-data text-sm text-stone-600">{formatDate(customer.last_order)}</div>
            <div className="px-4 py-3"><Badge status={customer.order_count > 1 ? 'paid' : 'new'} /></div>
          </button>
        ))}
      </div>

      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-stone-900/20" onClick={() => setSelectedCustomer(null)}>
          <div className="ml-auto flex h-full w-full max-w-xl flex-col border-l border-stone-200 bg-white" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-400">Customer profile</p>
                <h2 className="mt-1 text-xl font-semibold text-stone-900">{selectedCustomer.name || selectedCustomer.display_name || selectedCustomer.wa_id || 'Customer'}</h2>
              </div>
              <button type="button" onClick={() => setSelectedCustomer(null)} className="text-stone-500 hover:text-stone-900">✕</button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
              <div className="grid grid-cols-2 gap-3 rounded-md border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Contact</p>
                  <p className="mt-2 text-stone-800">{selectedCustomer.wa_id || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Orders</p>
                  <p className="mt-2 font-data text-stone-800">{selectedCustomer.order_count ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Lifetime value</p>
                  <p className="mt-2 font-data text-stone-800">{formatMoney(selectedCustomer.total_spent)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Avg order</p>
                  <p className="mt-2 font-data text-stone-800">{selectedCustomer.order_count ? formatMoney(Number(selectedCustomer.total_spent) / Number(selectedCustomer.order_count)) : '—'}</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.12em] text-stone-400">Order history</p>
                <div className="overflow-hidden rounded-md border border-stone-200">
                  <div className="grid grid-cols-[1fr_1fr_1fr] border-b border-stone-200 bg-stone-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">
                    <span>Order</span>
                    <span>Date</span>
                    <span>Total</span>
                  </div>
                  {(selectedCustomer.orders || []).length ? (
                    (selectedCustomer.orders || []).map((order: any) => (
                      <div key={order.id} className="grid grid-cols-[1fr_1fr_1fr] border-b border-stone-100 px-3 py-2 text-sm text-stone-700 last:border-0">
                        <span>#{String(order.id).slice(0, 8)}</span>
                        <span className="font-data">{formatDate(order.created_at)}</span>
                        <span className="font-data">{formatMoney(order.total_amount)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-3 text-sm text-stone-500">No order history available.</div>
                  )}
                </div>
              </div>

              {(selectedCustomer.order_count || 0) > 2 && selectedCustomer.favorite_product ? (
                <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                  <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 3.5c1.8 2.2 2.8 3.4 2.8 5.4A3.7 3.7 0 0 1 11 12.6a3.7 3.7 0 0 1-3.8-3.7c0-2 1-3.2 2.8-5.4 1 .9 1.7 1.4 2 2.1.3-.7 1-1.2 2-2.1Zm-4.9 11.7c1.2-1 2.6-1.5 4.9-1.5s3.7.5 4.9 1.5C18 16.3 16.7 18 12 18s-6-1.7-4.9-2.8Z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>
                    AI insight: this customer tends to reorder <span className="font-medium">{selectedCustomer.favorite_product}</span> most often.
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
