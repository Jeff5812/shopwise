import { getSupabase } from '@/lib/supabase';
import { getVendor } from '@/lib/vendor';
import { ReplenishmentBoard } from '@/components/ReplenishmentBoard';
import { buildReplenishment, summarise, WINDOW_DAYS, WEEKS_SHOWN, type PaidSale, type VariantInput } from '@/lib/replenishment';

// Two queries: the catalog with its variants, and paid sales for the longest window we draw
// (the weekly demand bars). Row level security already limits both to this login's vendor.
async function getReplenishment(vendorId: string) {
  const supabase = await getSupabase();
  const since = new Date(Date.now() - Math.max(WINDOW_DAYS, WEEKS_SHOWN * 7) * 86_400_000).toISOString();

  const [{ data: products }, { data: paid }] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, cost_price, product_variants(id, size, color, stock_quantity, restock_threshold)')
      .eq('vendor_id', vendorId),
    supabase
      .from('payments')
      .select('paid_at, orders!inner(vendor_id, order_items(product_variant_id, quantity))')
      .eq('status', 'paid')
      .eq('orders.vendor_id', vendorId)
      .gte('paid_at', since),
  ]);

  const variants: VariantInput[] = (products ?? []).flatMap((product: any) =>
    (product.product_variants ?? []).map((v: any) => ({
      variant_id: v.id,
      product_name: product.name,
      variant_label: [v.size, v.color].filter(Boolean).join(' / '),
      sku: String(v.id).slice(0, 8),
      stock: Number(v.stock_quantity ?? 0),
      threshold: Number(v.restock_threshold ?? 0),
      cost_price: Number(product.cost_price ?? 0),
    })),
  );

  const sales: PaidSale[] = (paid ?? []).flatMap((payment: any) => {
    const order = Array.isArray(payment.orders) ? payment.orders[0] : payment.orders;
    return (order?.order_items ?? []).map((item: any) => ({
      paid_at: payment.paid_at,
      variant_id: item.product_variant_id,
      quantity: Number(item.quantity ?? 0),
    }));
  });

  const items = buildReplenishment(variants, sales);
  return { items, summary: summarise(items) };
}

export default async function ReplenishmentPage() {
  const vendor = await getVendor();
  if (!vendor) {
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-6 xl:p-8">
        <p className="text-stone-500">No vendor found yet.</p>
      </main>
    );
  }

  const { items, summary } = await getReplenishment(vendor.id);
  return <ReplenishmentBoard items={items} summary={summary} />;
}
