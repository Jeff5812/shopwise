import { supabase } from '@/lib/supabase';
import { ReplenishmentBoard } from '@/components/ReplenishmentBoard';

async function getVendor() {
  const { data } = await supabase
    .from('vendors')
    .select('*')
    .eq('whatsapp_phone_number_id', '1369817666207594')
    .limit(1)
    .maybeSingle();
  return data;
}

async function getReplenishment(vendorId: string) {
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('name', { ascending: true });

  if (!products) return [];

  return await Promise.all(
    products.map(async (product: any) => {
      const { data: variants } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', product.id);

      const stockQuantity = variants?.reduce((sum: number, variant: any) => sum + Number(variant.stock_quantity || 0), 0) ?? 0;
      const typicalStock = variants?.reduce((sum: number, variant: any) => sum + Number(variant.restock_threshold || 0), 0) || 20;
      const avgSales = Number(product.avg_sales_30d ?? product.average_sales_30d ?? 0);
      const recommendedQty = stockQuantity <= 0 ? Math.max(Math.ceil(typicalStock * 0.8), 10) : Math.max(Math.ceil((typicalStock - stockQuantity) * 1.2), 0);
      const daysLeft = avgSales > 0 ? Math.max(Math.ceil(stockQuantity / avgSales), 0) : null;

      return {
        id: product.id,
        name: product.name,
        sku: product.sku || product.id?.slice(0, 8) || '—',
        stock_quantity: stockQuantity,
        days_left: daysLeft,
        recommended_qty: recommendedQty,
        reasoning:
          avgSales > 0
            ? 'Based on average sales over the last 30 days.'
            : 'No recent sales history is available yet for a calculated reorder recommendation.',
      };
    })
  );
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

  const items = await getReplenishment(vendor.id);
  return <ReplenishmentBoard items={items} />;
}
