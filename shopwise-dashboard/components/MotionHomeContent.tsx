'use client';

import Link from 'next/link';
import { ProfitTrendChart } from '@/components/ProfitTrendChart';

type Metric = {
  label: string;
  value: number | string;
  delta: number | null;
  subline: string | null;
};

type ActivityMessage = {
  id: string;
  intent: string | null;
  confidence: number | null;
  customers: { display_name: string | null; wa_id: string | null } | null;
  raw_text: string | null;
  created_at: string;
};

function formatDelta(delta: number | null | undefined) {
  if (typeof delta !== 'number' || Number.isNaN(delta)) return null;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
}

function intentBadge(intent: string | null, confidence: number | null) {
  if (!intent || intent === 'unclassified' || (confidence ?? 1) < 0.6) {
    return { label: 'Needs review', classes: 'bg-danger/10 text-ink' };
  }
  const map: Record<string, { label: string; classes: string }> = {
    order: { label: 'Order', classes: 'bg-sand text-ink' },
    question: { label: 'FAQ', classes: 'bg-sand-soft text-ink-soft' },
    negotiation: { label: 'Negotiating', classes: 'bg-warn/15 text-ink' },
    noise: { label: 'Chat', classes: 'bg-sand-soft text-ink-soft' },
  };
  return map[intent] ?? { label: intent, classes: 'bg-sand-soft text-ink-soft' };
}

export function MotionHomeContent({
  vendorName,
  metrics,
  needsAttention,
  aiObservations,
  weeklyTrend,
  feed,
}: {
  vendorName: string;
  metrics: Metric[];
  needsAttention: { label: string; href: string; color: string }[];
  aiObservations: string[];
  weeklyTrend: { label: string; profit: number }[];
  feed: ActivityMessage[];
}) {
  const chartData = weeklyTrend;

  return (
    <main className="mx-auto w-full max-w-[1152px] p-4 sm:px-6 sm:py-6 xl:px-8 xl:py-8">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-semibold text-ink sm:text-4xl">Good morning, {vendorName}</h1>
        <p className="mt-1 text-sm text-ink-soft">Here&apos;s what&apos;s happening today</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {metrics.map((metric) => {
          const deltaText = formatDelta(metric.delta);
          return (
            <div key={metric.label} className="min-w-0 rounded-2xl border border-sand bg-paper p-4 shadow-card sm:p-5">
              <p className="text-sm text-ink-soft">{metric.label}</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="min-w-0 break-words font-serif text-2xl font-semibold tabular-nums text-ink sm:text-3xl">
                  {metric.value}
                </p>
                {deltaText ? (
                  <span
                    className="shrink-0 text-xs tabular-nums text-ink-soft"
                  >
                    {deltaText}
                  </span>
                ) : null}
              </div>
              {metric.subline ? <p className="mt-2 text-xs leading-5 text-ink-soft">{metric.subline}</p> : null}
            </div>
          );
        })}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-sand bg-paper p-5 shadow-card">
          <h2 className="mb-3 font-semibold text-ink">Needs attention</h2>
          {needsAttention.length > 0 ? (
            <ul className="space-y-2">
              {needsAttention.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="flex items-center gap-3 rounded-lg py-1 text-sm text-ink-soft transition-colors hover:text-ink">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${item.color}`} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">Nothing needs attention right now.</p>
          )}
        </section>

        <section className="rounded-2xl border border-sand bg-sand p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3.5c1.8 2.2 2.8 3.4 2.8 5.4A3.7 3.7 0 0 1 11 12.6a3.7 3.7 0 0 1-3.8-3.7c0-2 1-3.2 2.8-5.4 1 .9 1.7 1.4 2 2.1.3-.7 1-1.2 2-2.1Zm-4.9 11.7c1.2-1 2.6-1.5 4.9-1.5s3.7.5 4.9 1.5C18 16.3 16.7 18 12 18s-6-1.7-4.9-2.8Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Shopwise AI
          </div>

          {aiObservations.length > 0 ? (
            <ul className="space-y-2 text-sm text-ink">
              {aiObservations.slice(0, 3).map((observation) => (
                <li key={observation} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-ink-soft" />
                  <span>{observation}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink">No AI recommendations yet. More order and sales data will unlock smarter insights.</p>
          )}

          <Link href="/analytics" className="mt-3 inline-block text-sm font-medium text-ink underline underline-offset-4">
            Review recommendations
          </Link>
        </section>
      </div>

      <section className="mb-8 overflow-hidden rounded-2xl border border-sand bg-paper shadow-card">
        <div className="flex items-center justify-between gap-3 border-b border-sand px-5 py-4">
          <h2 className="font-semibold text-ink">Profit · last 7 days</h2>
          <span className="text-xs text-ink-soft">Paid orders</span>
        </div>

        <div className="p-5">
          {chartData.some((point) => point.profit !== 0) ? (
            <ProfitTrendChart data={chartData} />
          ) : (
            <div className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-sand bg-cream px-4 py-10 text-center">
              <p className="text-sm font-medium text-ink">No paid orders yet</p>
              <p className="max-w-md text-sm text-ink-soft">Profit will appear here once a WhatsApp order is paid.</p>
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-sand bg-paper shadow-card">
        <div className="border-b border-sand px-5 py-4">
          <h2 className="font-semibold text-ink">Live activity</h2>
        </div>

        {feed.length > 0 ? (
          <ul className="divide-y divide-sand-soft">
            {feed.map((msg) => {
              const badge = intentBadge(msg.intent, msg.confidence);
              return (
                <li key={msg.id} className="flex items-start justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink">
                        {msg.customers?.display_name || msg.customers?.wa_id || 'Customer'}
                      </span>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.classes}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">{msg.raw_text || 'New activity received'}</p>
                  </div>
                  <span className="font-data shrink-0 text-[11px] tabular-nums text-ink-soft">
                    {new Date(msg.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-5">
            <p className="text-sm text-ink-soft">No activity yet. Connect WhatsApp to start seeing orders here.</p>
          </div>
        )}
      </section>
    </main>
  );
}
