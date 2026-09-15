'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';

function extractAiFields(raw: string) {
  const lower = raw.toLowerCase();
  const productMatch = raw.match(/([a-z0-9\s-]+?)(?:\s+for\s+|\s+please|\s+with|$)/i);
  const qtyMatch = raw.match(/(\d+)\s*(?:pcs|pieces|qty|x)/i);
  const sizeMatch = raw.match(/(xs|s|m|l|xl|xxl|medium|large|small|size\s*[:=]?\s*[a-z]+)/i);
  const paymentMatch = raw.match(/(card|transfer|cash|bank|paystack|flutterwave|pos)/i);

  return {
    product: productMatch?.[1]?.trim() || 'Product',
    qty: qtyMatch?.[1] || '1',
    size: sizeMatch?.[1]?.trim() || 'M',
    payment: paymentMatch?.[1]?.trim() || 'Cash on delivery',
  };
}

export function InboxBoard({ conversations }: { conversations: any[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(conversations[0]?.id || null);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) || conversations[0] || null,
    [conversations, selectedId]
  );

  if (!conversations.length) {
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-6 xl:p-8">
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 border border-dashed border-stone-200 bg-white p-8 text-center">
          <div>
            <p className="text-lg font-medium text-stone-900">Connect WhatsApp to start receiving orders here</p>
            <p className="mt-1 text-sm text-stone-500">No live inbox is connected yet.</p>
          </div>
          <Button variant="primary" className="h-10 px-4 text-sm">Connect WhatsApp</Button>
        </div>
      </main>
    );
  }

  const aiFields = extractAiFields(selectedConversation?.raw_text || 'Hi, please send 2 black M shirts and pay by transfer.');

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6 xl:p-8">
      <div className="mb-5">
        <h1 className="text-3xl font-semibold tracking-[-0.05em] text-stone-900">Inbox</h1>
      </div>

      <div className="grid min-h-[640px] overflow-hidden border border-stone-200 bg-white lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-b border-stone-200 bg-stone-50 lg:border-b-0 lg:border-r">
          <div className="border-b border-stone-200 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">Conversations</p>
          </div>
          <div className="divide-y divide-stone-100">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setSelectedId(conversation.id)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white ${
                  selectedConversation?.id === conversation.id ? 'bg-white' : ''
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${conversation.unread ? 'text-stone-900' : 'text-stone-600'}`}>
                      {conversation.customer || 'Customer'}
                    </span>
                    {conversation.unread ? <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> : null}
                  </div>
                  <p className="truncate text-sm text-stone-500">{conversation.preview || 'New message'}</p>
                </div>
                <span className="font-data shrink-0 text-[11px] text-stone-400">{conversation.time || 'Now'}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex flex-col">
          <div className="border-b border-stone-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-stone-900">{selectedConversation?.customer || 'Customer conversation'}</h2>
          </div>

          <div className="flex-1 space-y-5 p-5">
            <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-400">Customer message</p>
              <p className="mt-2 text-sm leading-6 text-stone-600">{selectedConversation?.raw_text || 'Hi, I would like 2 black medium shirts and can pay via transfer.'}</p>
            </div>

            <div className="rounded-md border border-stone-200 bg-white p-4">
              <p className="text-sm font-semibold text-stone-900">AI understanding</p>
              <div className="mt-3 space-y-2 divide-y divide-stone-100">
                <div className="flex items-center justify-between gap-3 py-2 text-sm text-stone-700">
                  <span>Product</span>
                  <span className="font-data text-stone-800">{aiFields.product}</span>
                </div>
                <div className="flex items-center justify-between gap-3 py-2 text-sm text-stone-700">
                  <span>Qty</span>
                  <span className="font-data text-stone-800">{aiFields.qty}</span>
                </div>
                <div className="flex items-center justify-between gap-3 py-2 text-sm text-stone-700">
                  <span>Size</span>
                  <span className="font-data text-stone-800">{aiFields.size}</span>
                </div>
                <div className="flex items-center justify-between gap-3 py-2 text-sm text-stone-700">
                  <span>Payment</span>
                  <span className="font-data text-stone-800">{aiFields.payment}</span>
                </div>
              </div>
              <div className="mt-4">
                <Button variant="secondary" className="h-10 px-4 text-sm">Create order</Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
