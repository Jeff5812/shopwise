import { supabase } from '@/lib/supabase';
import { getVendor } from '@/lib/vendor';
import { MotionHomeContent } from '@/components/MotionHomeContent';

async function getOrdersInRange(vendorId: string, start: Date, end: Date) {
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('vendor_id', vendorId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());
  return data ?? [];
}

async function getPaidOrderIds(orderIds: string[]): Promise<Set<string>> {
  // Revenue/profit must reflect orders that were actually paid for, per the
  // `payments` table — not orders.status alone. Historical rows created before
  // the payment state-machine fix can sit at status='confirmed' with no
  // payment ever made (the dashboard's old Confirm button used to do this
  // directly), so status='confirmed' is not a safe stand-in for "paid" on its
  // own; the payments join is the source of truth either way.
  if (orderIds.length === 0) return new Set();
  const { data: payments } = await supabase
    .from('payments')
    .select('order_id')
    .in('order_id', orderIds)
    .eq('status', 'paid');
  return new Set((payments ?? []).map((p: any) => p.order_id));
}

async function getTodayOrders(vendorId: string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return getOrdersInRange(vendorId, startOfToday, endOfToday);
}

async function getProfitForOrders(orderIds: string[]) {
  if (orderIds.length === 0) return 0;
  const { data: items } = await supabase
    .from('order_items')
    .select('quantity, unit_price, product_variants(product_id)')
    .in('order_id', orderIds);
  if (!items) return 0;
  let profit = 0;
  for (const item of items as any[]) {
    const productId = item.product_variants?.product_id;
    if (!productId) continue;
    const { data: product } = await supabase.from('products').select('cost_price').eq('id', productId).single();
    if (product) profit += item.quantity * (item.unit_price - product.cost_price);
  }
  return profit;
}

async function getLowStockCount(vendorId: string) {
  const { data: products } = await supabase.from('products').select('id').eq('vendor_id', vendorId);
  if (!products?.length) return 0;
  const { data: variants } = await supabase
    .from('product_variants')
    .select('stock_quantity, restock_threshold')
    .in('product_id', products.map((p) => p.id));
  return variants?.filter((v) => v.stock_quantity <= (v.restock_threshold ?? 5)).length ?? 0;
}

async function getPendingPaymentCount(vendorId: string) {
  // Was querying status='confirmed' and calling it "pending payments" — the
  // inverse of what confirmed now means since the payment state-machine fix
  // (confirmed only happens after real payment, via the Paystack webhook).
  // The actual "waiting on payment" status is pending_payment.
  const { count } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('vendor_id', vendorId)
    .eq('status', 'pending_payment');
  return count ?? 0;
}

async function getWeeklyProfitTrend(vendorId: string) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const { data: orders } = await supabase
    .from('orders')
    .select('id, created_at')
    .eq('vendor_id', vendorId)
    .gte('created_at', sevenDaysAgo.toISOString());

  const days: { label: string; profit: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ label: d.toLocaleDateString('en-GB', { weekday: 'short' }), profit: 0 });
  }

  if (orders?.length) {
    const paidIds = await getPaidOrderIds(orders.map((o) => o.id));
    for (const order of orders) {
      if (!paidIds.has(order.id)) continue;
      const { data: items } = await supabase
        .from('order_items')
        .select('quantity, unit_price, product_variants(product_id)')
        .eq('order_id', order.id);
      if (!items) continue;
      const createdAt = new Date(order.created_at);
      const differenceDays = Math.floor((Date.now() - createdAt.getTime()) / 86400000);
      const dayIndex = 6 - differenceDays;
      if (dayIndex < 0 || dayIndex > 6) continue;
      for (const item of items as any[]) {
        const productId = item.product_variants?.product_id;
        if (!productId) continue;
        const { data: product } = await supabase.from('products').select('cost_price').eq('id', productId).single();
        if (product) days[dayIndex].profit += item.quantity * (item.unit_price - product.cost_price);
      }
    }
  }
  return days;
}

async function getLiveFeed(vendorId: string) {
  const { data } = await supabase
    .from('messages')
    .select('*, customers(display_name, wa_id)')
    .eq('vendor_id', vendorId)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(10);
  return data ?? [];
}

export default async function HomePage() {
  const vendor = await getVendor();
  if (!vendor) {
    return (
      <main className="p-8">
        <p className="text-stone-500">No vendor found yet. Run the seed SQL first.</p>
      </main>
    );
  }

  const vendorName = vendor.business_name || vendor.name || vendor.display_name || 'there';
  const todayOrders = await getTodayOrders(vendor.id);
  const todayPaidIds = await getPaidOrderIds(todayOrders.map((o: any) => o.id));
  const todayPaidOrders = todayOrders.filter((o: any) => todayPaidIds.has(o.id));
  const todaySales = todayPaidOrders.reduce((sum: number, order: any) => sum + Number(order.total_amount || 0), 0);
  const todayProfit = await getProfitForOrders(todayPaidOrders.map((o: any) => o.id));
  const lowStockCount = await getLowStockCount(vendor.id);
  const pendingPaymentCount = await getPendingPaymentCount(vendor.id);
  // Real order.status values written by the backend are only: awaiting_confirmation,
  // pending_payment, confirmed, canceled — 'paid'/'delivered'/'completed' are never
  // actually set, so the old filters against those never matched anything.
  const completedOrders = todayOrders.filter((order: any) => order.status === 'confirmed').length;
  const pendingOrders = todayOrders.filter((order: any) => ['awaiting_confirmation', 'pending_payment'].includes(order.status)).length;

  const yesterdayStart = new Date();
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  yesterdayStart.setHours(0, 0, 0, 0);
  const yesterdayEnd = new Date();
  yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
  yesterdayEnd.setHours(23, 59, 59, 999);
  const yesterdayOrders = await getOrdersInRange(vendor.id, yesterdayStart, yesterdayEnd);
  const yesterdayPaidIds = await getPaidOrderIds(yesterdayOrders.map((o: any) => o.id));
  const yesterdaySales = yesterdayOrders
    .filter((o: any) => yesterdayPaidIds.has(o.id))
    .reduce((sum: number, order: any) => sum + Number(order.total_amount || 0), 0);
  const salesDelta = yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales) * 100 : null;
  const lowStockDelta = null;
  const pendingPaymentsDelta = null;

  const weeklyTrend = await getWeeklyProfitTrend(vendor.id);
  const feed = await getLiveFeed(vendor.id);

  const metrics = [
    {
      label: "Today's sales",
      value: `₦${todaySales.toFixed(0)}`,
      subline: null,
      delta: salesDelta,
    },
    {
      label: 'Orders',
      value: todayOrders.length,
      subline: `${completedOrders} completed · ${pendingOrders} pending`,
      delta: null,
    },
    {
      label: 'Inventory alerts',
      value: lowStockCount,
      subline: null,
      delta: lowStockDelta,
    },
    {
      label: 'Pending payments',
      value: pendingPaymentCount,
      subline: null,
      delta: pendingPaymentsDelta,
    },
  ];

  const needsAttention = [
    ...(lowStockCount > 0 ? [{ label: 'Low stock products need replenishment', href: '/inventory', color: 'bg-rose-500' }] : []),
    ...(pendingOrders > 0 ? [{ label: 'Orders still awaiting confirmation', href: '/orders', color: 'bg-amber-500' }] : []),
    ...(pendingPaymentCount > 0 ? [{ label: 'Payments are waiting on review', href: '/orders', color: 'bg-emerald-600' }] : []),
  ];

  const aiObservations =
    lowStockCount > 0 || todayProfit > 0 || todayOrders.length > 0
      ? [
          ...(lowStockCount > 0 ? [`${lowStockCount} items are trending below their restock threshold.`] : []),
          ...(todayOrders.length > 0 ? [`${todayOrders.length} orders came in today, with ${todayProfit.toFixed(0)} in net profit.`] : []),
          ...(pendingPaymentCount > 0 ? [`${pendingPaymentCount} payments are still pending review.`] : []),
        ]
      : [];

  return (
    <MotionHomeContent
      vendorName={vendorName}
      metrics={metrics}
      needsAttention={needsAttention}
      aiObservations={aiObservations}
      weeklyTrend={weeklyTrend}
      feed={feed}
    />
  );
}
