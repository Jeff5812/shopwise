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
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-200 bg-white p-8 text-center">
          <div>
            <p className="text-lg font-medium text-stone-900">Connect WhatsApp to start receiving orders here</p>
            <p className="mt-1 text-sm text-stone-500">No live inbox is connected yet.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6 xl:p-8">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-semibold text-stone-900 sm:text-4xl">Inbox</h1>
      </div>

      <div className="grid min-h-[640px] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-card lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="border-b border-stone-200 lg:border-b-0 lg:border-r">
          <div className="border-b border-stone-200 px-4 py-3.5">
            <p className="text-sm font-semibold text-stone-900">Conversations</p>
          </div>
          <div className="divide-y divide-stone-100">
            {conversations.map((conversation) => {
              const selected = selectedConversation?.id === conversation.id;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedId(conversation.id)}
                  aria-current={selected ? 'true' : undefined}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-stone-200/25 ${
                    selected ? 'bg-stone-200/40' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {conversation.unread ? <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full bg-emerald-600" /> : null}
                      <span className={`truncate text-sm ${conversation.unread ? 'font-semibold text-stone-900' : 'font-medium text-stone-600'}`}>
                        {conversation.customer || 'Customer'}
                      </span>
                      {conversation.reviewItem ? (
                        <span className="shrink-0 rounded-full bg-warn/15 px-2 py-0.5 text-[10.5px] font-semibold text-stone-900">Flagged</span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-stone-500">{conversation.preview || 'New message'}</p>
                  </div>
                  <span className="font-data shrink-0 text-[11px] text-stone-500">{conversation.time || 'Now'}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">
          <div className="border-b border-stone-200 px-5 py-4">
            <h2 className="truncate font-serif text-lg font-semibold text-stone-900">{selectedConversation?.customer || 'Customer conversation'}</h2>
          </div>

          {selectedConversation?.reviewItem && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-warn/10 px-5 py-3">
              <div>
                <p className="text-sm font-semibold text-stone-900">Needs review</p>
                <p className="text-xs text-stone-600">Reason: {selectedConversation.reviewItem.reason.replace(/_/g, ' ')}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" className="h-10 px-4 text-sm" onClick={handleResolve} disabled={resolving}>
                  {resolving ? 'Resolving…' : 'Mark resolved'}
                </Button>
              </div>
            </div>
          )}
          {resolveError && <p className="border-b border-stone-200 px-5 py-2 text-sm text-danger">{resolveError}</p>}

          <div className="flex-1 space-y-5 p-5">
            <div className="flex gap-3">
              <div className="max-w-[85%] rounded-2xl bg-stone-200/50 px-4 py-3">
                <p className="text-xs font-medium text-stone-500">Customer message</p>
                <p className="mt-1.5 text-sm leading-6 text-stone-900">{selectedConversation?.raw_text || 'No message text available.'}</p>
              </div>
            </div>

            <div className="surface-card p-5">
              <p className="text-sm font-semibold text-stone-900">Status</p>
              <div className="mt-3 divide-y divide-stone-100">
                <div className="flex items-center justify-between gap-3 py-2.5 text-sm text-stone-700">
                  <span>Escalated to review</span>
                  <span className="font-data font-medium text-stone-900">{selectedConversation?.reviewItem ? 'Yes' : 'No'}</span>
                </div>
                {selectedConversation?.reviewItem && (
                  <div className="flex items-center justify-between gap-3 py-2.5 text-sm text-stone-700">
                    <span>Reason</span>
                    <span className="font-data font-medium text-stone-900">{selectedConversation.reviewItem.reason.replace(/_/g, ' ')}</span>
                  </div>
                )}
              </div>
              <p className="mt-4 text-xs leading-5 text-stone-500">
                A structured breakdown (product, quantity, price) isn&apos;t shown here yet — the AI&apos;s
                extraction result isn&apos;t currently saved anywhere the dashboard can read it. Resolve
                or reply to this conversation directly for now.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
