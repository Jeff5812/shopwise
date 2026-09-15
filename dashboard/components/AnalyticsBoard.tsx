'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/Badge';

function formatMoney(value: number | null | undefined) {
  const numeric = Number(value ?? 0);
  return `₦${numeric.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

export function AnalyticsBoard({
  summary,
  salesSeries,
  topProducts,
  topCustomers,
}: {
  summary: {
    revenue: number;
    orders: number;
    profit: number;
    aov: number;
  };
  salesSeries: { label: string; value: number }[];
  topProducts: { name: string; value: number }[];
  topCustomers: { name: string; value: number }[];
}) {
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'custom'>('7d');

  const maxSales = Math.max(...salesSeries.map((entry) => entry.value), 1);
  const maxProducts = Math.max(...topProducts.map((entry) => entry.value), 1);
  const maxCustomers = Math.max(...topCustomers.map((entry) => entry.value), 1);

  const tabItems = ['7d', '30d', '90d', 'custom'] as const;

  const metrics = useMemo(
    () => [
      { label: 'Revenue', value: formatMoney(summary.revenue) },
      { label: 'Orders', value: summary.orders.toString() },
      { label: 'Profit', value: formatMoney(summary.profit) },
      { label: 'AOV', value: formatMoney(summary.aov) },
    ],
    [summary]
  );

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6 xl:p-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-[-0.05em] text-stone-900">Analytics</h1>
        <div className="flex items-center gap-4">
          {tabItems.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRange(item)}
              className={`border-b-2 pb-1 text-sm font-medium transition-colors ${
                range === item ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-400 hover:text-stone-600'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-px border border-stone-200 bg-stone-200 md:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-white p-3.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">{metric.label}</p>
            <p className="mt-3 font-data text-3xl tracking-tight text-stone-900">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="border border-stone-200 bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-900">Sales over time</h2>
            <span className="text-[10px] uppercase tracking-[0.12em] text-stone-400">Revenue</span>
          </div>
          <div className="flex h-40 items-end gap-2 pt-3">
            {salesSeries.map((entry) => (
              <div key={entry.label} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-28 w-full items-end justify-center">
                  <div className="w-full max-w-9 rounded-none bg-stone-800" style={{ height: `${Math.max((entry.value / maxSales) * 100, 12)}%` }} />
                </div>
                <span className="text-[10px] uppercase tracking-[0.12em] text-stone-400">{entry.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-stone-200 bg-white p-4">
          <h2 className="mb-4 text-sm font-semibold text-stone-900">Top products</h2>
          <div className="space-y-3">
            {topProducts.map((item) => (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-stone-700">{item.name}</span>
                  <span className="font-data text-stone-900">{formatMoney(item.value)}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden bg-stone-100">
                  <div className="h-full bg-stone-800" style={{ width: `${Math.max((item.value / maxProducts) * 100, 10)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-stone-200 bg-white p-4 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-stone-900">Top customers</h2>
          <div className="space-y-3">
            {topCustomers.map((item) => (
              <div key={item.name} className="grid grid-cols-[1.2fr_0.8fr] gap-3 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                  <span className="text-stone-700">{item.name}</span>
                  <span className="font-data text-stone-800">{formatMoney(item.value)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-[0.12em] text-stone-400">Share</span>
                  <div className="h-1.5 flex-1 overflow-hidden bg-stone-100">
                    <div className="h-full bg-stone-700" style={{ width: `${Math.max((item.value / maxCustomers) * 100, 10)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
