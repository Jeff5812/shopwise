/*
  Single source of truth for Shopwise pricing UI.
  Destination: shopwise-marketing/lib/pricing.ts

  STATUS: planned pricing. Prices for Starter and Growth come from the owner.
  Everything marked TODO(confirm) is not yet decided. Edit it here only; the
  tiers, comparison table and estimator all read from this file.
*/

export const naira = (value: number) =>
  `₦${Math.round(value).toLocaleString('en-NG')}`;

export type TierId = 'starter' | 'growth' | 'enterprise';

export type Tier = {
  id: TierId;
  name: string;
  /** Monthly price in naira, or null when pricing is custom. */
  monthly: number | null;
  tagline: string;
  features: string[];
  featured?: boolean;
};

export const TIERS: Tier[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthly: 0,
    tagline: 'For vendors getting started with WhatsApp orders.',
    features: [
      'WhatsApp order capture in English and Nigerian Pidgin',
      'Product and variant stock tracking',
      'Paystack payment links for your customers',
      'Order dashboard with confirm and cancel',
      'Review list for messages Shopwise cannot safely handle',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    monthly: 15000,
    tagline: 'For vendors with a steady flow of orders.',
    featured: true,
    features: [
      'Everything in Starter',
      // TODO(confirm): list the real Growth-only features here before launch.
      'Growth-only features will be listed before launch',
    ],
  },
  {
    id: 'enterprise',
    name: 'Alaba Scale',
    monthly: null,
    tagline: 'For large sellers and multi-branch operations.',
    features: [
      'Everything in Growth',
      // TODO(confirm): list the real Enterprise features and pricing before launch.
      'Custom pricing and features will be confirmed before launch',
    ],
  },
];

/* ---------- Comparison table ----------
   true = included, false = not included, 'tbc' = not decided yet. */
export type Cell = boolean | 'tbc';

export type ComparisonGroup = {
  title: string;
  rows: { label: string; values: Record<TierId, Cell> }[];
};

const all = (v: Cell): Record<TierId, Cell> => ({ starter: v, growth: v, enterprise: v });

export const COMPARISON: ComparisonGroup[] = [
  {
    title: 'Selling on WhatsApp',
    rows: [
      { label: 'Order capture from WhatsApp messages', values: all(true) },
      { label: 'English and Nigerian Pidgin understanding', values: all(true) },
      { label: 'Review list for unclear messages', values: all(true) },
    ],
  },
  {
    title: 'Running the shop',
    rows: [
      { label: 'Product and variant stock tracking', values: all(true) },
      { label: 'Order dashboard (confirm and cancel)', values: all(true) },
      { label: 'Paystack payment links', values: all(true) },
    ],
  },
  {
    // TODO(confirm): replace 'tbc' with real limits once the plans are decided.
    title: 'Scale and support',
    rows: [
      { label: 'Monthly order volume', values: all('tbc') },
      { label: 'Team access', values: all('tbc') },
      { label: 'Support', values: all('tbc') },
    ],
  },
];

/* ---------- Paystack fee (published local rate) ----------
   Source: Paystack support, "Transactions pricing", Nigeria local transactions:
   1.5% + NGN 100, the NGN 100 waived under NGN 2,500, total fee capped at NGN 2,000.
   Re-check before launch: https://support.paystack.com/hc/en-us/articles/360009881920 */
export const PAYSTACK = {
  rate: 0.015,
  flat: 100,
  flatWaivedBelow: 2500,
  cap: 2000,
};

export function paystackLocalFee(orderAmount: number) {
  const flat = orderAmount < PAYSTACK.flatWaivedBelow ? 0 : PAYSTACK.flat;
  return Math.min(orderAmount * PAYSTACK.rate + flat, PAYSTACK.cap);
}

/* ---------- Estimator ---------- */
export const SALES_MIN = 100_000;
export const SALES_MAX = 10_000_000;

/** Slider position 0..100 to monthly sales. Squared so small shops get fine control. */
export function salesFromPosition(position: number) {
  const t = Math.min(Math.max(position, 0), 100) / 100;
  const raw = SALES_MIN + t * t * (SALES_MAX - SALES_MIN);
  return Math.round(raw / 10_000) * 10_000;
}

export function estimateMonthlyCost(input: {
  monthlySales: number;
  averageOrder: number;
  planFee: number;
}) {
  const orders = Math.max(1, Math.round(input.monthlySales / input.averageOrder));
  const paystackTotal = orders * paystackLocalFee(input.averageOrder);
  const total = input.planFee + paystackTotal;
  return {
    orders,
    paystackTotal,
    planFee: input.planFee,
    total,
    shareOfSales: input.monthlySales > 0 ? (total / input.monthlySales) * 100 : 0,
  };
}
