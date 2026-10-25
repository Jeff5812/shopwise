'use client';

import { useMemo, useState } from 'react';
import {
  estimateMonthlyCost,
  naira,
  PAYSTACK,
  salesFromPosition,
  SALES_MAX,
  SALES_MIN,
  TIERS,
} from '@/lib/pricing';

/* Destination: shopwise-marketing/components/pricing/PricingEstimator.tsx
   Estimates plan price + Paystack's published local fee. It does NOT include any
   Shopwise per-sale charge: no commission model has been decided. */

const planChoices = TIERS.filter((tier) => tier.monthly !== null);

export function PricingEstimator() {
  const [position, setPosition] = useState(35);
  const [averageOrder, setAverageOrder] = useState(15000);
  const [planId, setPlanId] = useState<string>('starter');

  const monthlySales = salesFromPosition(position);
  const planFee = planChoices.find((tier) => tier.id === planId)?.monthly ?? 0;

  const estimate = useMemo(
    () => estimateMonthlyCost({ monthlySales, averageOrder, planFee }),
    [monthlySales, averageOrder, planFee],
  );

  return (
    <div className="grid gap-8 rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8 md:grid-cols-2">
      <div className="space-y-8">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="estimator-sales" className="text-sm font-medium text-foreground">
              Monthly sales
            </label>
            <span className="font-serif text-2xl font-semibold tabular-nums text-foreground">
              {naira(monthlySales)}
            </span>
          </div>
          <input
            id="estimator-sales"
            type="range"
            min={0}
            max={100}
            value={position}
            onChange={(event) => setPosition(Number(event.target.value))}
            className="mt-3 w-full accent-ink"
          />
          <div className="mt-1 flex justify-between text-xs text-muted">
            <span>{naira(SALES_MIN)}</span>
            <span>{naira(SALES_MAX)}</span>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="estimator-aov" className="text-sm font-medium text-foreground">
              Average order value
            </label>
            <span className="font-serif text-2xl font-semibold tabular-nums text-foreground">
              {naira(averageOrder)}
            </span>
          </div>
          <input
            id="estimator-aov"
            type="range"
            min={1000}
            max={100000}
            step={500}
            value={averageOrder}
            onChange={(event) => setAverageOrder(Number(event.target.value))}
            className="mt-3 w-full accent-ink"
          />
          <div className="mt-1 flex justify-between text-xs text-muted">
            <span>{naira(1000)}</span>
            <span>{naira(100000)}</span>
          </div>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-foreground">Plan</legend>
          <div className="mt-3 inline-flex rounded-xl bg-sand/40 p-1">
            {planChoices.map((tier) => (
              <button
                key={tier.id}
                type="button"
                aria-pressed={planId === tier.id}
                onClick={() => setPlanId(tier.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  planId === tier.id
                    ? 'bg-card text-foreground shadow-card'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                {tier.name}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="rounded-2xl border border-border-soft bg-canvas p-6">
        <h3 className="font-serif text-lg font-semibold text-foreground">Your estimate</h3>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Shopwise plan</dt>
            <dd className="tabular-nums text-foreground">{naira(estimate.planFee)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">
              Paystack fees on about {estimate.orders.toLocaleString('en-NG')} orders
            </dt>
            <dd className="tabular-nums text-foreground">{naira(estimate.paystackTotal)}</dd>
          </div>
        </dl>
        <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-border pt-4">
          <span className="text-sm text-muted">Estimated monthly cost</span>
          <span className="font-serif text-3xl font-semibold tabular-nums text-foreground" aria-live="polite">
            {naira(estimate.total)}
          </span>
        </div>
        <p className="mt-2 text-right text-xs tabular-nums text-muted">
          About {estimate.shareOfSales.toFixed(1)}% of your monthly sales
        </p>
        <p className="mt-5 text-xs leading-5 text-muted">
          Uses Paystack&apos;s published local rate of {PAYSTACK.rate * 100}% + {naira(PAYSTACK.flat)}
          , with the {naira(PAYSTACK.flat)} waived under {naira(PAYSTACK.flatWaivedBelow)} and
          fees capped at {naira(PAYSTACK.cap)} per payment. No Shopwise per-sale fee is
          included. This is an estimate: check Paystack&apos;s current pricing and the final
          Shopwise plans.
        </p>
      </div>
    </div>
  );
}
