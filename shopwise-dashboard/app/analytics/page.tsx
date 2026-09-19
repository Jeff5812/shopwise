import { supabase } from '@/lib/supabase';
import { getVendor } from '@/lib/vendor';
import { AnalyticsBoard } from '@/components/AnalyticsBoard';

async function getRangeOrders(vendorId: string, days: number) {
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, total_amount, created_at, customer_id, customers(display_name, wa_id)')
    .eq('vendor_id', vendorId)
    .gte('created_at', start.toISOString())
    .order('created_at', { ascending: true });

  const allOrders = dataOrEmpty<any[]>(orders);
  if (allOrders.length === 0) return allOrders;

  // Revenue must mean money actually received, not gross order value — an order
  // sitting at awaiting_confirmation/pending_payment/confirmed-with-no-payment
  // has no money behind it yet, and a cancelled order never will. Payment truth
  // lives on the `payments` table (same fix as the Orders page's Payment
  // column), so join it here rather than trusting orders.status alone.
  const orderIds = allOrders.map((o: any) => o.id);
  const { data: payments } = await supabase
    .from('payments')
    .select('order_id, status')
    .in('order_id', orderIds)
    .eq('status', 'paid');

  const paidOrderIds = new Set((payments ?? []).map((p: any) => p.order_id));
  return allOrders.map((order: any) => ({ ...order, is_paid: paidOrderIds.has(order.id) }));
}

function dataOrEmpty<T>(data: T | null | undefined): T {
  return (data ?? []) as T;
}

function buildSalesSeries(orders: any[], days: number) {
  const buckets: { [key: string]: number } = {};
  const labels: string[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    labels.push(key);
    buckets[key] = 0;
  }

  for (const order of orders) {
    const date = new Date(order.created_at);
    const key = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    if (buckets[key] !== undefined) {
      buckets[key] += Number(order.total_amount || 0);
    }
  }

  return labels.map((label) => ({ label, value: buckets[label] || 0 }));
}

async function getAnalytics(vendorId: string, days: number) {
  const orders = dataOrEmpty<any[]>(await getRangeOrders(vendorId, days));
  // Revenue/profit/top-products/top-customers/sales-series all reflect money
  // actually received — paid orders only. The "Orders" count below stays as
  // total order volume (including unpaid/cancelled) since that's a genuinely
  // different, still-useful metric, not a revenue figure.
  const paidOrders = orders.filter((order: any) => order.is_paid);
  const revenue = paidOrders.reduce((sum: number, order: any) => sum + Number(order.total_amount || 0), 0);
  const profit = 0;

  const productMap = new Map<string, number>();
  const customerMap = new Map<string, number>();

  for (const order of paidOrders) {
    const customerName = (order as any).customers?.display_name || (order as any).customers?.wa_id || 'Customer';
    customerMap.set(customerName, (customerMap.get(customerName) || 0) + Number((order as any).total_amount || 0));

    const { data: items } = await supabase
      .from('order_items')
      .select('quantity, unit_price, product_variants(product_id)')
      .eq('order_id', (order as any).id);

    for (const item of dataOrEmpty<any[]>(items)) {
      const productId = (item as any).product_variants?.product_id;
      if (!productId) continue;
      const { data: product } = await supabase.from('products').select('name, cost_price').eq('id', productId).single();
      if (!product) continue;
      const total = Number((item as any).quantity || 0) * Number((item as any).unit_price || 0);
      productMap.set((product as any).name, (productMap.get((product as any).name) || 0) + total);
    }
  }

  const topProducts = [...productMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, value]) => ({ name, value }));
  const topCustomers = [...customerMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, value]) => ({ name, value }));

  return {
    revenue,
    orders: orders.length,
    profit,
    aov: paidOrders.length ? revenue / paidOrders.length : 0,
    salesSeries: buildSalesSeries(paidOrders, days),
    topProducts,
    topCustomers,
  };
}

export default async function AnalyticsPage() {
  const vendor = await getVendor();
  if (!vendor) {
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-6 xl:p-8">
        <p className="text-stone-500">No vendor found yet.</p>
      </main>
    );
  }

  const analytics = await getAnalytics(vendor.id, 7);
  return <AnalyticsBoard summary={{ revenue: analytics.revenue, orders: analytics.orders, profit: analytics.profit, aov: analytics.aov }} salesSeries={analytics.salesSeries} topProducts={analytics.topProducts} topCustomers={analytics.topCustomers} />;
}
