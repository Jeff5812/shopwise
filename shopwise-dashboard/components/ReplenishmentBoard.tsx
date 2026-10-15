'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { COVER_TARGET_DAYS, WINDOW_DAYS, type ReplenishmentItem, type Risk } from '@/lib/replenishment';

// Layout follows the "Inventory replenishment cockpit" prompt from vibeprompts.dev (metric row,
// priority table, detail panel with demand bars). Only metrics Shopwise really has are shown:
// there are no suppliers, purchase orders, lead times or inbound stock in the database, so the
// prompt's supplier reliability, open PO value, inbound, lead time and "Create purchase order"
// parts are deliberately left out rather than faked.

type Summary = { medianCover: number | null; needAttention: number; outOfStock: number; estimatedRestockCost: number };

const money = (value: number) => `₦${value.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;

function formatCover(days: number | null) {
  if (days === null) return '—';
  if (days >= 100) return '99+ d';
  return `${days < 10 ? days.toFixed(1) : Math.round(days)} d`;
}

const RISK_STYLE: Record<Risk, { label: string; chip: string; row: string }> = {
  out: { label: 'Out of stock', chip: 'bg-red-100 text-red-700', row: 'bg-red-50/60' },
  at_risk: { label: 'At risk', chip: 'bg-red-100 text-red-700', row: 'bg-red-50/60' },
  low: { label: 'Low', chip: 'bg-amber-100 text-amber-700', row: 'bg-amber-50/60' },
  ok: { label: 'Healthy', chip: 'bg-emerald-100 text-emerald-700', row: '' },
  no_sales: { label: 'No sales yet', chip: 'bg-stone-100 text-stone-500', row: '' },
};

const itemName = (item: ReplenishmentItem) => (item.variant_label ? `${item.product_name} (${item.variant_label})` : item.product_name);

export function ReplenishmentBoard({ items, summary }: { items: ReplenishmentItem[]; summary: Summary }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => !q || itemName(item).toLowerCase().includes(q) || item.sku.toLowerCase().includes(q));
  }, [items, query]);

  const selected = items.find((item) => item.variant_id === selectedId) ?? filtered[0] ?? null;
  const maxWeek = selected ? Math.max(...selected.weekly_units, 1) : 1;

  async function copyRestockList() {
    const lines = items.filter((i) => (i.recommended_qty ?? 0) > 0).map((i) => `${i.recommended_qty} x ${itemName(i)}`);
    if (!lines.length) return;
    try {
      await navigator.clipboard.writeText(`Restock list\n${lines.join('\n')}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked by the browser; nothing else to do.
    }
  }

  if (!items.length) {
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-6 xl:p-8">
        <h1 className="mb-6 text-3xl font-semibold tracking-[-0.05em] text-stone-900">Replenishment</h1>
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-2 border border-dashed border-stone-200 bg-white p-8 text-center">
          <p className="text-lg font-medium text-stone-900">No products yet</p>
          <p className="text-sm text-stone-500">Add a product on the Inventory page and its stock cover will show up here.</p>
        </div>
      </main>
    );
  }

  const metrics = [
    { label: 'Median cover', value: summary.medianCover === null ? '—' : formatCover(summary.medianCover), tone: '' },
    { label: 'Need attention', value: String(summary.needAttention), tone: summary.needAttention ? 'text-red-600' : '' },
    { label: 'Out of stock', value: String(summary.outOfStock), tone: summary.outOfStock ? 'text-red-600' : '' },
    { label: 'Est. restock cost', value: money(summary.estimatedRestockCost), tone: '' },
  ];

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6 xl:p-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.05em] text-stone-900">Replenishment</h1>
          <p className="mt-1 text-xs text-stone-400">Based on paid sales in the last {WINDOW_DAYS} days</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products"
            className="h-10 w-48 border border-stone-200 bg-white px-3 text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900"
          />
          <Button className="h-10 px-3 text-sm" onClick={copyRestockList}>{copied ? 'Copied ✓' : 'Copy restock list'}</Button>
        </div>
      </div>

      <section className="border border-stone-200 bg-white">
        <div className="grid grid-cols-2 divide-x divide-y divide-stone-100 lg:grid-cols-4 lg:divide-y-0">
          {metrics.map((metric) => (
            <div key={metric.label} className="p-4">
              <p className="text-xs text-stone-400">{metric.label}</p>
              <b className={`mt-1 block text-xl font-semibold ${metric.tone}`}>{metric.value}</b>
            </div>
          ))}
        </div>

        <div className="grid border-t border-stone-200 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="overflow-x-auto border-b border-stone-200 lg:border-b-0 lg:border-r">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 text-stone-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-3 py-3 font-medium">Stock</th>
                  <th className="px-3 py-3 font-medium">Cover</th>
                  <th className="px-3 py-3 font-medium">Sold {WINDOW_DAYS}d</th>
                  <th className="px-3 py-3 font-medium">Suggested</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.variant_id}
                    onClick={() => setSelectedId(item.variant_id)}
                    className={`cursor-pointer border-t border-stone-100 hover:bg-stone-50 ${selected?.variant_id === item.variant_id ? 'bg-stone-100' : RISK_STYLE[item.risk].row}`}
                  >
                    <td className="px-4 py-3">
                      <b className="text-stone-800">{itemName(item)}</b>
                      <span className="block font-data text-stone-400">{item.sku}</span>
                    </td>
                    <td className="px-3 font-data">{item.stock}</td>
                    <td className="px-3 font-data">{formatCover(item.days_of_cover)}</td>
                    <td className="px-3 font-data">{item.sold_30d}</td>
                    <td className="px-3 font-data font-semibold">{item.recommended_qty === null ? '—' : item.recommended_qty}</td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400">No products match your search.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <aside className="p-5">
            {selected ? (
              <>
                <p className="text-xs uppercase tracking-wider text-stone-400">Recommendation</p>
                <h2 className="mt-2 font-semibold text-stone-900">{itemName(selected)}</h2>
                <span className={`mt-2 inline-block px-2 py-0.5 text-[11px] font-medium ${RISK_STYLE[selected.risk].chip}`}>{RISK_STYLE[selected.risk].label}</span>
                <p className="mt-3 text-sm text-stone-500">{selected.reasoning}</p>

                <p className="mt-6 text-xs text-stone-400">Units sold per week (oldest to newest)</p>
                <div className="mt-2 flex h-24 items-end gap-2">
                  {selected.weekly_units.map((units, index) => (
                    <span
                      key={index}
                      title={`${units} sold`}
                      className="flex-1 bg-stone-300"
                      style={{ height: `${Math.max((units / maxWeek) * 100, units > 0 ? 6 : 2)}%` }}
                    />
                  ))}
                </div>

                <div className="mt-5 flex justify-between text-sm">
                  <span className="text-stone-500">Suggested quantity</span>
                  <b className="font-data">{selected.recommended_qty === null ? '—' : selected.recommended_qty}</b>
                </div>
                <p className="mt-1 text-xs text-stone-400">Restores about {COVER_TARGET_DAYS} days of cover at the recent selling pace.</p>
              </>
            ) : (
              <p className="text-sm text-stone-400">Select an item to see its details.</p>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}
