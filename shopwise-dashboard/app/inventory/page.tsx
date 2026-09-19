import { supabase } from '@/lib/supabase';
import { getVendor } from '@/lib/vendor';
import { InventoryBoard } from '@/components/InventoryBoard';

async function getInventory(vendorId: string) {
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('name', { ascending: true });

  if (!products) return [];

  const withVariants = await Promise.all(
    products.map(async (product: any) => {
      const { data: variants } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', product.id);

      const stockQuantity = variants?.reduce((sum: number, variant: any) => sum + Number(variant.stock_quantity || 0), 0) ?? 0;
      const typicalStock = variants?.reduce((sum: number, variant: any) => sum + Number(variant.restock_threshold || 0), 0) || 20;
      const status = getStatus(stockQuantity, typicalStock);

      return {
        ...product,
        id: product.id,
        name: product.name,
        sku: product.sku || product.id?.slice(0, 8) || '—',
        stock_quantity: stockQuantity,
        cost_price: Number(product.cost_price ?? 0),
        price: Number(product.sell_price ?? 0),
        status,
        variants: (variants ?? []).map((v: any) => ({
          id: v.id,
          size: v.size,
          color: v.color,
          stock_quantity: Number(v.stock_quantity ?? 0),
          restock_threshold: v.restock_threshold,
        })),
        units_sold: product.units_sold ?? null,
        sales_velocity: product.sales_velocity ?? null,
        supplier_name: product.supplier_name || product.supplier || null,
        last_restock: product.last_restock || null,
        stock_history: product.stock_history || null,
      };
    })
  );

  return withVariants;
}

function getStatus(stock: number, typicalStock: number) {
  if (stock <= 0) return 'out_of_stock';
  if (stock <= 5 || stock <= typicalStock * 0.05) return 'critical';
  if (stock <= typicalStock * 0.2) return 'low';
  return 'healthy';
}

export default async function InventoryPage() {
  const vendor = await getVendor();
  if (!vendor) {
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-6 xl:p-8">
        <p className="text-stone-500">No vendor found yet.</p>
      </main>
    );
  }

  const inventory = await getInventory(vendor.id);
  return <InventoryBoard inventory={inventory} />;
}
