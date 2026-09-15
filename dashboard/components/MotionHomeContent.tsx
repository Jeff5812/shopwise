'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { ProfitTrendChart } from '@/components/ProfitTrendChart';

function formatDelta(delta: number | null | undefined) {
  if (typeof delta !== 'number' || Number.isNaN(delta) || delta === null) return null;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
}

function intentBadge(intent: string | null, confidence: number | null) {
  if (!intent || intent === 'unclassified' || (confidence ?? 1) < 0.6) {
    return { label: 'Needs review', classes: 'bg-red-50 text-red-800' };
  }
  const map: Record<string, { label: string; classes: string }> = {
    order: { label: 'Order', classes: 'bg-emerald-50 text-emerald-700' },
    question: { label: 'FAQ', classes: 'bg-blue-50 text-blue-800' },
    negotiation: { label: 'Negotiating', classes: 'bg-amber-50 text-amber-800' },
    noise: { label: 'Chat', classes: 'bg-gray-100 text-gray-700' },
  };
  return map[intent] ?? { label: intent, classes: 'bg-gray-100 text-gray-700' };
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
  metrics: any[];
  needsAttention: { label: string; href: string; color: string }[];
  aiObservations: string[];
  weeklyTrend: any[];
  feed: any[];
}) {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d');
  const chartData = period === '7d' ? weeklyTrend : [];

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6 xl:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-[-0.05em] text-stone-900">Good morning, {vendorName}</h1>
        <p className="mt-1 text-sm text-stone-500">Here's what's happening today</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-px border border-stone-200 bg-stone-200 md:grid-cols-4">
        {metrics.map((metric, index) => {
          const deltaText = formatDelta(metric.delta);
          return (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: index * 0.04 }}
              className="bg-white p-3.5"
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">{metric.label}</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="font-data text-3xl tracking-tight text-stone-900">{metric.value}</p>
                {deltaText ? (
                  <span
                    className={`font-data text-[11px] ${
                      Number(metric.delta) > 0 ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    {deltaText}
                  </span>
                ) : null}
              </div>
              {metric.subline ? <p className="mt-2 text-xs text-stone-400">{metric.subline}</p> : null}
            </motion.div>
          );
        })}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="border border-stone-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-stone-900">Needs attention</h2>
          {needsAttention.length > 0 ? (
            <ul className="space-y-2">
              {needsAttention.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="flex items-center gap-2 rounded-sm text-sm text-stone-700 transition-colors hover:text-stone-900">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${item.color}`} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">Nothing needs attention right now.</p>
          )}
        </section>

        <section className="border border-emerald-200 bg-emerald-50 p-3.5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3.5c1.8 2.2 2.8 3.4 2.8 5.4A3.7 3.7 0 0 1 11 12.6a3.7 3.7 0 0 1-3.8-3.7c0-2 1-3.2 2.8-5.4 1 .9 1.7 1.4 2 2.1.3-.7 1-1.2 2-2.1Zm-4.9 11.7c1.2-1 2.6-1.5 4.9-1.5s3.7.5 4.9 1.5C18 16.3 16.7 18 12 18s-6-1.7-4.9-2.8Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Shopwise AI
          </div>

          {aiObservations.length > 0 ? (
            <>
              <ul className="space-y-2 text-sm text-emerald-900">
                {aiObservations.slice(0, 3).map((observation) => (
                  <li key={observation} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    <span>{observation}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-emerald-800/80">No AI recommendations yet. More order and sales data will unlock smarter insights.</p>
          )}

          <Link href="/analytics" className="mt-3 inline-block text-sm font-medium text-emerald-700 underline underline-offset-4">
            Review recommendations
          </Link>
        </section>
      </div>

      <section className="mb-8 border border-stone-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-900">Profit</h2>
          <div className="flex items-center gap-4">
            {(['7d', '30d', '90d'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPeriod(item)}
                className={`border-b-2 pb-1 text-sm font-medium transition-colors ${
                  period === item
                    ? 'border-emerald-700 text-stone-900'
                    : 'border-transparent text-stone-400 hover:text-stone-600'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {chartData.length > 0 ? (
            <ProfitTrendChart data={chartData} />
          ) : (
            <div className="flex min-h-44 flex-col items-center justify-center gap-2 border border-dashed border-stone-200 bg-stone-50 px-4 py-10 text-center">
              <p className="text-sm font-medium text-stone-700">No sales data yet</p>
              <p className="max-w-md text-sm text-stone-500">Orders placed through WhatsApp will start filling this chart as soon as revenue appears.</p>
            </div>
          )}
        </div>
      </section>

      <section className="border border-stone-200 bg-white">
        <div className="border-b border-stone-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-900">Live activity</h2>
        </div>

        {feed.length > 0 ? (
          <ul className="divide-y divide-stone-100">
            {feed.map((msg: any) => {
              const badge = intentBadge(msg.intent, msg.confidence);
              return (
                <li key={msg.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-stone-800">
                        {msg.customers?.display_name || msg.customers?.wa_id || 'Customer'}
                      </span>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.classes}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-stone-500">{msg.raw_text || 'New activity received'}</p>
                  </div>
                  <span className="font-data shrink-0 text-[11px] text-stone-400">
                    {new Date(msg.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-start gap-3 p-4">
            <p className="text-sm text-stone-500">No activity yet. Connect WhatsApp to start seeing orders here.</p>
            <Button variant="secondary" className="h-9 px-3 text-sm">
              Connect WhatsApp
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
