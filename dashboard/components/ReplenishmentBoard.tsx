'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';

function formatMoney(value: number | null | undefined) {
  const numeric = Number(value ?? 0);
  return `₦${numeric.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

export function ReplenishmentBoard({ items }: { items: any[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!normalized) return true;
      return (item.name || '').toLowerCase().includes(normalized) || (item.sku || '').toLowerCase().includes(normalized);
    });
  }, [items, query]);

  if (!items.length) {
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-6 xl:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.05em] text-stone-900">Replenishment</h1>
          </div>
        </div>
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 border border-dashed border-stone-200 bg-white p-8 text-center">
          <div>
            <p className="text-lg font-medium text-stone-900">No replenishment items</p>
            <p className="mt-1 text-sm text-stone-500">Stock levels will appear here when the inventory feed has data to review.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6 xl:p-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-semibold tracking-[-0.05em] text-stone-900">Replenishment</h1>
        <label className="flex w-full max-w-md items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-500">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="5.5" />
            <path d="M16 16l4.5 4.5" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search inventory"
            className="w-full bg-transparent text-stone-700 placeholder:text-stone-400 focus:outline-none"
          />
        </label>
      </div>

      <div className="divide-y divide-stone-100 overflow-hidden border border-stone-200 bg-white">
        {filtered.map((item) => (
          <div key={item.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-stone-800">{item.name || 'Product'}</span>
                <span className="font-data text-[11px] text-stone-400">{item.sku || '—'}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-stone-500">
                <span>Current stock <span className="font-data text-stone-800">{item.stock_quantity ?? 0}</span></span>
                <span>Days left <span className="font-data text-stone-800">{item.days_left ?? '—'}</span></span>
                <span>Reorder qty <span className="font-data text-stone-800">{item.recommended_qty ?? '—'}</span></span>
              </div>
              <p className="mt-2 text-sm text-stone-500">
                {item.reasoning || 'No reorder recommendation available yet for this item.'}
              </p>
            </div>
            <Button variant="secondary" className="h-9 px-3 text-sm">Review</Button>
          </div>
        ))}
      </div>
    </main>
  );
}
