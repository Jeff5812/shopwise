import { supabase } from '@/lib/supabase';
import { AnalyticsBoard } from '@/components/AnalyticsBoard';

async function getVendor() {
  const { data } = await supabase
    .from('vendors')
    .select('*')
    .eq('whatsapp_phone_number_id', '1369817666207594')
    .limit(1)
    .maybeSingle();
  return data;
}

async function getRangeOrders(vendorId: string, days: number) {
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const { data: orders } = await supabase
    .from('orders')
    .select('id, total_amount, created_at, customer_id, customers(display_name, wa_id)')
    .eq('vendor_id', vendorId)
    .gte('created_at', start.toISOString())
    .order('created_at', { ascending: true });

  return dataOrEmpty(orders);
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
  const revenue = orders.reduce((sum: number, order: any) => sum + Number(order.total_amount || 0), 0);
  const profit = 0;

  const productMap = new Map<string, number>();
  const customerMap = new Map<string, number>();

  for (const order of orders) {
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
    aov: orders.length ? revenue / orders.length : 0,
    salesSeries: buildSalesSeries(orders, days),
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
