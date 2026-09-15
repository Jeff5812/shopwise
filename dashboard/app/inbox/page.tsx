import { supabase } from '@/lib/supabase';
import { InboxBoard } from '@/components/InboxBoard';

async function getVendor() {
  const { data } = await supabase
    .from('vendors')
    .select('*')
    .eq('whatsapp_phone_number_id', '1369817666207594')
    .limit(1)
    .maybeSingle();
  return data;
}

async function getMessages(vendorId: string) {
  const { data } = await supabase
    .from('messages')
    .select('*, customers(display_name, wa_id)')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (!data) return [];

  return data.map((message: any) => ({
    id: message.id,
    customer: message.customers?.display_name || message.customers?.wa_id || 'Customer',
    raw_text: message.raw_text || message.body || 'New message',
    preview: message.raw_text || message.body || 'New message',
    unread: message.direction === 'inbound',
    time: new Date(message.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    direction: message.direction,
  }));
}

export default async function InboxPage() {
  const vendor = await getVendor();
  if (!vendor) {
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-6 xl:p-8">
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 border border-dashed border-stone-200 bg-white p-8 text-center">
          <div>
            <p className="text-lg font-medium text-stone-900">Connect WhatsApp to start receiving orders here</p>
            <p className="mt-1 text-sm text-stone-500">No live inbox is connected yet.</p>
          </div>
          <button className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800">
            Connect WhatsApp
          </button>
        </div>
      </main>
    );
  }

  const conversations = await getMessages(vendor.id);
  return <InboxBoard conversations={conversations} />;
}
