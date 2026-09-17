'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { resolveReviewItem, ApiError } from '@/lib/api';

export function InboxBoard({ conversations }: { conversations: any[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(conversations[0]?.id || null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) || conversations[0] || null,
    [conversations, selectedId]
  );

  async function handleResolve() {
    if (!selectedConversation?.reviewItem) return;
    setResolving(true);
    setResolveError(null);
    try {
      await resolveReviewItem(selectedConversation.reviewItem.id);
      router.refresh();
    } catch (err) {
      setResolveError(err instanceof ApiError ? err.message : 'Could not resolve this item. Try again.');
    } finally {
      setResolving(false);
    }
  }

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
                    {conversation.reviewItem ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Flagged</span> : null}
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

          {selectedConversation?.reviewItem && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3">
              <div>
                <p className="text-sm font-semibold text-amber-800">Needs review</p>
                <p className="text-xs text-amber-700">Reason: {selectedConversation.reviewItem.reason.replace(/_/g, ' ')}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" className="h-9 px-3 text-sm" onClick={handleResolve} disabled={resolving}>
                  {resolving ? 'Resolving…' : 'Mark resolved'}
                </Button>
              </div>
            </div>
          )}
          {resolveError && <p className="border-b border-stone-200 px-5 py-2 text-sm text-rose-600">{resolveError}</p>}

          <div className="flex-1 space-y-5 p-5">
            <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-400">Customer message</p>
              <p className="mt-2 text-sm leading-6 text-stone-600">{selectedConversation?.raw_text || 'Hi, I would like 2 black medium shirts and can pay via transfer.'}</p>
            </div>

            <div className="surface-card p-4">
              <p className="text-sm font-semibold text-stone-900">Status</p>
              <div className="mt-3 space-y-2 divide-y divide-stone-100">
                <div className="flex items-center justify-between gap-3 py-2 text-sm text-stone-700">
                  <span>Escalated to review</span>
                  <span className="font-data text-stone-800">{selectedConversation?.reviewItem ? 'Yes' : 'No'}</span>
                </div>
                {selectedConversation?.reviewItem && (
                  <div className="flex items-center justify-between gap-3 py-2 text-sm text-stone-700">
                    <span>Reason</span>
                    <span className="font-data text-stone-800">{selectedConversation.reviewItem.reason.replace(/_/g, ' ')}</span>
                  </div>
                )}
              </div>
              <p className="mt-4 text-xs text-stone-400">
                A structured breakdown (product, quantity, price) isn't shown here yet — the AI's
                extraction result isn't currently saved anywhere the dashboard can read it. Resolve
                or reply to this conversation directly for now.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
