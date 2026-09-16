import { supabase } from '@/lib/supabase';
import { CustomersBoard } from '@/components/CustomersBoard';

async function getVendor() {
  const { data } = await supabase
    .from('vendors')
    .select('*')
    .eq('whatsapp_phone_number_id', '1369817666207594')
    .limit(1)
    .maybeSingle();
  return data;
}

async function getCustomers(vendorId: string) {
  const { data: orders } = await supabase
    .from('orders')
    .select('id, total_amount, created_at, customer_id, customers(id, display_name, wa_id)')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false });

  if (!orders) return [];

  const byCustomer = new Map<string, any>();

  for (const order of orders as any[]) {
    const customerId = order.customer_id || order.customers?.id || order.customers?.wa_id || `customer-${order.id}`;
    const customer = byCustomer.get(customerId) || {
      id: customerId,
      name: order.customers?.display_name || order.customers?.wa_id || 'Customer',
      wa_id: order.customers?.wa_id || null,
      display_name: order.customers?.display_name || null,
      order_count: 0,
      total_spent: 0,
      last_order: null,
      orders: [],
      favorite_product: null,
    };

    customer.order_count += 1;
    customer.total_spent += Number(order.total_amount || 0);
    customer.last_order = customer.last_order && new Date(customer.last_order) > new Date(order.created_at) ? customer.last_order : order.created_at;
    customer.orders.push({ id: order.id, total_amount: Number(order.total_amount || 0), created_at: order.created_at });
    byCustomer.set(customerId, customer);
  }

  const customerRows = await Promise.all(
    [...byCustomer.values()].map(async (customer: any) => {
      const { data: items } = await supabase
        .from('order_items')
        .select('quantity, product_variants(product_id), order_id')
        .in('order_id', customer.orders.map((order: any) => order.id));

      if (!items || !items.length) {
        return { ...customer, favorite_product: null };
      }

      const productCounts = new Map<string, number>();
      for (const item of items as any[]) {
        const productId = item.product_variants?.product_id;
        if (!productId) continue;
        const { data: product } = await supabase.from('products').select('name').eq('id', productId).single();
        const name = product?.name || 'Product';
        productCounts.set(name, (productCounts.get(name) || 0) + Number(item.quantity || 0));
      }

      const favorite = [...productCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      return { ...customer, favorite_product: favorite ? favorite[0] : null };
    })
  );

  return customerRows;
}

export default async function CustomersPage() {
  const vendor = await getVendor();
  if (!vendor) {
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-6 xl:p-8">
        <p className="text-stone-500">No vendor found yet.</p>
      </main>
    );
  }

  const customers = await getCustomers(vendor.id);
  return <CustomersBoard customers={customers} />;
}
