// Replenishment maths, kept apart from the page and the UI so it is easy to read and check.
// Everything is derived from database rows: current stock, and units from PAID orders (the
// payments table is the only source of "sold", same rule the analytics page uses). Nothing is
// estimated by AI, and nothing here knows about suppliers or purchase orders because Shopwise
// does not store any.

export const WINDOW_DAYS = 30;        // how far back "units sold" looks
export const COVER_TARGET_DAYS = 14;  // recommended order restores about two weeks of stock
export const AT_RISK_DAYS = 7;        // less cover than this counts as at risk
export const WEEKS_SHOWN = 6;         // demand bars in the detail panel

export type Risk = 'out' | 'at_risk' | 'low' | 'ok' | 'no_sales';

export type PaidSale = { paid_at: string; variant_id: string; quantity: number };

export type VariantInput = {
  variant_id: string;
  product_name: string;
  variant_label: string;   // e.g. "M / blue", or "" for a single item
  sku: string;
  stock: number;
  threshold: number;       // product_variants.restock_threshold, 0 when unset
  cost_price: number;
};

export type ReplenishmentItem = VariantInput & {
  sold_30d: number;
  daily_velocity: number;
  days_of_cover: number | null;   // null when nothing sold in the window
  risk: Risk;
  recommended_qty: number | null; // null when there is no sales history to base it on
  weekly_units: number[];         // oldest to newest, length WEEKS_SHOWN
  reasoning: string;
};

const DAY_MS = 86_400_000;

function classify(stock: number, cover: number | null, threshold: number): Risk {
  if (stock <= 0) return 'out';
  if (cover !== null && cover < AT_RISK_DAYS) return 'at_risk';
  if (threshold > 0 && stock <= threshold) return 'low';
  if (cover === null) return 'no_sales';
  return 'ok';
}

export function buildReplenishment(variants: VariantInput[], sales: PaidSale[], now: Date = new Date()): ReplenishmentItem[] {
  const byVariant = new Map<string, PaidSale[]>();
  for (const sale of sales) {
    const list = byVariant.get(sale.variant_id) ?? [];
    list.push(sale);
    byVariant.set(sale.variant_id, list);
  }

  const items = variants.map((variant): ReplenishmentItem => {
    const mine = byVariant.get(variant.variant_id) ?? [];
    const weekly = Array<number>(WEEKS_SHOWN).fill(0);
    let sold30 = 0;
    for (const sale of mine) {
      const ageDays = (now.getTime() - new Date(sale.paid_at).getTime()) / DAY_MS;
      if (ageDays < 0) continue;
      if (ageDays < WINDOW_DAYS) sold30 += sale.quantity;
      const week = Math.floor(ageDays / 7);
      if (week < WEEKS_SHOWN) weekly[WEEKS_SHOWN - 1 - week] += sale.quantity;
    }

    const velocity = sold30 / WINDOW_DAYS;
    const cover = velocity > 0 ? variant.stock / velocity : null;
    const risk = classify(variant.stock, cover, variant.threshold);
    const recommended = velocity > 0 ? Math.max(Math.ceil(velocity * COVER_TARGET_DAYS - variant.stock), 0) : null;

    let reasoning: string;
    if (velocity > 0) {
      reasoning = `${sold30} sold in the last ${WINDOW_DAYS} days, about ${velocity.toFixed(1)} a day. ` +
        `${variant.stock} in stock covers ${cover!.toFixed(1)} days. The suggestion restores about ${COVER_TARGET_DAYS} days of cover.`;
    } else if (variant.stock <= 0) {
      reasoning = 'Out of stock, with no paid sales in the last 30 days to size a reorder from.';
    } else {
      reasoning = 'No paid sales in the last 30 days, so there is nothing to base a reorder on yet.';
    }

    return { ...variant, sold_30d: sold30, daily_velocity: velocity, days_of_cover: cover, risk, recommended_qty: recommended, weekly_units: weekly, reasoning };
  });

  const rank: Record<Risk, number> = { out: 0, at_risk: 1, low: 2, ok: 3, no_sales: 4 };
  return items.sort((a, b) =>
    rank[a.risk] - rank[b.risk] ||
    (a.days_of_cover ?? Infinity) - (b.days_of_cover ?? Infinity) ||
    a.product_name.localeCompare(b.product_name));
}

export function summarise(items: ReplenishmentItem[]) {
  const covers = items.map((i) => i.days_of_cover).filter((c): c is number => c !== null).sort((a, b) => a - b);
  const mid = Math.floor(covers.length / 2);
  const median = covers.length === 0 ? null : covers.length % 2 ? covers[mid] : (covers[mid - 1] + covers[mid]) / 2;
  return {
    medianCover: median,
    needAttention: items.filter((i) => i.risk === 'out' || i.risk === 'at_risk' || i.risk === 'low').length,
    outOfStock: items.filter((i) => i.risk === 'out').length,
    // Estimate only: suggested units x the product's cost price. Skips items with no suggestion.
    estimatedRestockCost: items.reduce((sum, i) => sum + (i.recommended_qty ?? 0) * i.cost_price, 0),
  };
}
