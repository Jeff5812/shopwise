'use client';

import { useMemo } from 'react';

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
  const maxSales = Math.max(...salesSeries.map((entry) => entry.value), 1);
  const maxProducts = Math.max(...topProducts.map((entry) => entry.value), 1);
  const maxCustomers = Math.max(...topCustomers.map((entry) => entry.value), 1);

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
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold text-stone-900 sm:text-4xl">Analytics</h1>
        <span className="text-sm text-stone-500">Last 7 days</span>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="surface-card p-4 sm:p-5">
            <p className="text-sm text-stone-500">{metric.label}</p>
            <p className="mt-3 font-serif text-2xl font-semibold tabular-nums tracking-tight text-stone-900 sm:text-3xl">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-900">Sales over time</h2>
            <span className="text-xs text-stone-500">Revenue</span>
          </div>
          <div className="flex h-44 items-end gap-2 pt-3">
            {salesSeries.map((entry) => (
              <div key={entry.label} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-32 w-full items-end justify-center">
                  <div
                    className="w-full max-w-10 rounded-t-lg bg-emerald-600"
                    style={{ height: `${Math.max((entry.value / maxSales) * 100, 8)}%` }}
                    title={`${entry.label}: ${formatMoney(entry.value)}`}
                  />
                </div>
                <span className="text-xs text-stone-500">{entry.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-stone-900">Top products</h2>
          <div className="space-y-4">
            {topProducts.map((item) => (
              <div key={item.name} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-stone-700">{item.name}</span>
                  <span className="font-data text-stone-900">{formatMoney(item.value)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200/60">
                  <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.max((item.value / maxProducts) * 100, 10)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-stone-900">Top customers</h2>
          <div className="space-y-3">
            {topCustomers.map((item) => (
              <div key={item.name} className="grid grid-cols-[1.2fr_0.8fr] gap-3 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5">
                  <span className="text-stone-700">{item.name}</span>
                  <span className="font-data text-stone-900">{formatMoney(item.value)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500">Share</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200/60">
                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.max((item.value / maxCustomers) * 100, 10)}%` }} />
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
