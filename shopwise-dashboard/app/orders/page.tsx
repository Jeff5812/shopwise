import { supabase } from '@/lib/supabase';
import { getVendor } from '@/lib/vendor';
import { OrdersBoard } from '@/components/OrdersBoard';

async function getOrdersWithDetails(vendorId: string) {
  const { data: orders } = await supabase
    .from('orders')
    .select('*, customers(display_name, wa_id)')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (!orders) return [];

  // Payment truth lives in the `payments` table, not on `orders` — there is no
  // orders.payment_status/payment_method column, so reading those (as this used
  // to) always returns undefined and the Payment badge showed "Unpaid" for
  // every order regardless of what actually happened with Paystack. Fetch the
  // payment rows for these orders in one query and take the most recent per
  // order (an order can have more than one payment attempt if a link failed
  // and was regenerated).
  const orderIds = orders.map((o: any) => o.id);
  const { data: payments } = await supabase
    .from('payments')
    .select('order_id, status, created_at')
    .in('order_id', orderIds)
    .order('created_at', { ascending: false });

  const latestPaymentByOrder = new Map<string, string>();
  for (const payment of payments ?? []) {
    if (!latestPaymentByOrder.has(payment.order_id)) {
      latestPaymentByOrder.set(payment.order_id, payment.status);
    }
  }

  const withItems = await Promise.all(
    orders.map(async (order: any) => {
      const { data: items } = await supabase
        .from('order_items')
        .select('quantity, unit_price, product_variants(product_id, size, color)')
        .eq('order_id', order.id);

      const itemRows = await Promise.all(
        (items ?? []).map(async (item: any) => {
          const productId = item.product_variants?.product_id;
          let productName = 'Product';
          if (productId) {
            const { data: product } = await supabase.from('products').select('name').eq('id', productId).single();
            productName = product?.name ?? 'Product';
          }
          const variant = [item.product_variants?.size, item.product_variants?.color].filter(Boolean).join(' ') || 'Standard';
          return {
            product_name: productName,
            quantity: Number(item.quantity ?? 1),
            variant,
            unit_price: Number(item.unit_price ?? 0),
          };
        })
      );

      const itemLabels = itemRows.map((item) => `${item.quantity} x ${item.product_name}${item.variant ? ` (${item.variant})` : ''}`);

      return {
        ...order,
        items: itemRows,
        itemsSummary: itemLabels.join(', '),
        subtotal_amount: itemRows.reduce((sum, item) => sum + item.quantity * item.unit_price, 0),
        raw_message: order.notes || order.raw_message || '',
        payment_status: latestPaymentByOrder.get(order.id) ?? null,
      };
    })
  );

  return withItems;
}

export default async function OrdersPage() {
  const vendor = await getVendor();
  if (!vendor) {
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-6 xl:p-8">
        <p className="text-stone-500">No vendor found yet.</p>
      </main>
    );
  }

  const orders = await getOrdersWithDetails(vendor.id);
  return <OrdersBoard orders={orders} />;
}
