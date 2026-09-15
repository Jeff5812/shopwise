'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';

const PAGE_SIZE = 8;

function normalizeStatus(status: string | null | undefined) {
  const value = (status || '').toLowerCase();
  if (!value) return 'new';
  if (['awaiting_confirmation', 'pending', 'needs_review'].includes(value)) return 'processing';
  if (['canceled', 'cancelled'].includes(value)) return 'cancelled';
  if (['paid', 'completed', 'delivered'].includes(value)) return 'delivered';
  return value;
}

function normalizePayment(value: string | null | undefined) {
  const val = (value || '').toLowerCase();
  if (!val) return 'unpaid';
  if (['paid', 'completed'].includes(val)) return 'paid';
  if (['cod', 'cash_on_delivery'].includes(val)) return 'processing';
  return val;
}

function formatMoney(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return `₦${numeric.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function OrdersBoard({ orders }: { orders: any[] }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesSearch =
        !query ||
        order.id.toLowerCase().includes(query) ||
        (order.customers?.display_name || order.customers?.wa_id || '').toLowerCase().includes(query) ||
        (order.itemsSummary || '').toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || normalizeStatus(order.status) === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const summary = useMemo(() => {
    const counts = {
      total: orders.length,
      pending: orders.filter((o) => !['delivered', 'paid', 'completed', 'cancelled', 'canceled'].includes((o.status || '').toLowerCase())).length,
      processing: orders.filter((o) => ['processing', 'confirmed', 'awaiting_confirmation', 'pending'].includes((o.status || '').toLowerCase())).length,
      completed: orders.filter((o) => ['delivered', 'paid', 'completed'].includes((o.status || '').toLowerCase())).length,
      cancelled: orders.filter((o) => ['cancelled', 'canceled'].includes((o.status || '').toLowerCase())).length,
    };
    return counts;
  }, [orders]);

  const customerName = (order: any) => order.customers?.display_name || order.customers?.wa_id || 'Customer';

  const statusSummary = [
    { label: 'Total', value: summary.total },
    { label: 'Pending', value: summary.pending },
    { label: 'Processing', value: summary.processing },
    { label: 'Completed', value: summary.completed },
    { label: 'Cancelled', value: summary.cancelled },
  ];

  if (!orders.length) {
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-6 xl:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.05em] text-stone-900">Orders</h1>
          </div>
        </div>

        <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 border border-dashed border-stone-200 bg-white p-8 text-center">
          <div>
            <p className="text-lg font-medium text-stone-900">No orders yet</p>
            <p className="mt-1 text-sm text-stone-500">Orders created from WhatsApp will appear here once your store starts selling.</p>
          </div>
          <Button variant="primary" className="h-10 px-4 text-sm">Create order</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6 xl:p-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-semibold tracking-[-0.05em] text-stone-900">Orders</h1>
        <div className="flex w-full max-w-md items-center gap-2 sm:w-auto">
          <label className="flex flex-1 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-500">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="5.5" />
              <path d="M16 16l4.5 4.5" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search orders"
              className="w-full bg-transparent text-stone-700 placeholder:text-stone-400 focus:outline-none"
            />
          </label>
          <Button variant="secondary" className="h-10 px-3 text-sm">Filter</Button>
          <Button variant="secondary" className="h-10 px-3 text-sm">Date</Button>
          <Button variant="secondary" className="h-10 px-3 text-sm">Status</Button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-stone-500">
        {statusSummary.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span>{item.label}</span>
            <span className="font-data text-base text-stone-900">{item.value}</span>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <div className="hidden border-b border-stone-200 bg-stone-50 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500 sm:grid sm:grid-cols-[1.1fr_1.4fr_1.5fr_0.9fr_0.9fr_0.9fr_0.7fr_0.6fr]">
          <div className="px-4 py-3">Order ID</div>
          <div className="px-4 py-3">Customer</div>
          <div className="px-4 py-3">Products</div>
          <div className="px-4 py-3">Amount</div>
          <div className="px-4 py-3">Payment</div>
          <div className="px-4 py-3">Status</div>
          <div className="px-4 py-3">Created</div>
          <div className="px-4 py-3 text-right">Action</div>
        </div>

        {pageItems.length === 0 ? (
          <div className="p-6 text-sm text-stone-500">No orders match your search.</div>
        ) : (
          <div>
            {pageItems.map((order) => {
              const paymentStatus = normalizePayment(order.payment_status || order.payment_method);
              const status = normalizeStatus(order.status);
              return (
                <div
                  key={order.id}
                  className="border-b border-stone-100 transition-colors last:border-0 hover:bg-stone-50 sm:grid sm:grid-cols-[1.1fr_1.4fr_1.5fr_0.9fr_0.9fr_0.9fr_0.7fr_0.6fr]"
                >
                  <div className="px-4 py-3 text-sm text-stone-700 sm:border-0">
                    <span className="font-medium">#{order.id.slice(0, 8)}</span>
                  </div>
                  <div className="px-4 py-3 text-sm text-stone-700 sm:border-0">{customerName(order)}</div>
                  <div className="px-4 py-3 text-sm text-stone-500 sm:border-0">{order.itemsSummary || '—'}</div>
                  <div className="px-4 py-3 font-data text-sm text-stone-800 sm:border-0">{formatMoney(order.total_amount)}</div>
                  <div className="px-4 py-3 sm:border-0"><Badge status={paymentStatus} /></div>
                  <div className="px-4 py-3 sm:border-0"><Badge status={status} /></div>
                  <div className="px-4 py-3 font-data text-sm text-stone-500 sm:border-0">{formatDate(order.created_at)}</div>
                  <div className="px-4 py-3 sm:flex sm:justify-end sm:border-0">
                    <Button variant="ghost" className="h-8 px-2 text-sm" onClick={() => setSelectedOrder(order)}>
                      View
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {filteredOrders.length > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm text-stone-500">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="h-9 px-3 text-sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1}>
              Prev
            </Button>
            <Button variant="secondary" className="h-9 px-3 text-sm" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage === totalPages}>
              Next
            </Button>
          </div>
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-stone-900/20" onClick={() => setSelectedOrder(null)}>
          <div className="ml-auto flex h-full w-full max-w-xl flex-col border-l border-stone-200 bg-white" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-400">Order details</p>
                <h2 className="mt-1 text-xl font-semibold text-stone-900">#{selectedOrder.id.slice(0, 8)}</h2>
              </div>
              <button type="button" onClick={() => setSelectedOrder(null)} className="text-stone-500 hover:text-stone-900">✕</button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Customer</p>
                  <p className="mt-2 text-sm text-stone-800">{customerName(selectedOrder)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Created</p>
                  <p className="mt-2 font-data text-sm text-stone-800">{formatDate(selectedOrder.created_at)}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge status={normalizePayment(selectedOrder.payment_status || selectedOrder.payment_method)} />
                <Badge status={normalizeStatus(selectedOrder.status)} />
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.12em] text-stone-400">Line items</p>
                <div className="space-y-2">
                  {(selectedOrder.items || []).map((item: any, index: number) => (
                    <div key={`${item.product_name || 'item'}-${index}`} className="flex items-center justify-between gap-3 border-b border-stone-100 pb-2 text-sm text-stone-700">
                      <div>
                        <p className="font-medium text-stone-800">{item.product_name || 'Product item'}</p>
                        <p className="text-stone-500">{item.variant || 'Standard'} × {item.quantity}</p>
                      </div>
                      <span className="font-data text-stone-800">{formatMoney(item.unit_price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
                <div className="flex items-center justify-between text-sm text-stone-600">
                  <span>Subtotal</span>
                  <span className="font-data text-stone-800">{formatMoney(selectedOrder.subtotal_amount || selectedOrder.total_amount)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-stone-600">
                  <span>Total</span>
                  <span className="font-data text-lg text-stone-900">{formatMoney(selectedOrder.total_amount)}</span>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.12em] text-stone-400">Timeline</p>
                <div className="space-y-3 pl-2">
                  {[
                    { label: 'Order placed', done: true, time: selectedOrder.created_at },
                    { label: 'Confirmed', done: ['confirmed', 'paid', 'delivered', 'completed'].includes((selectedOrder.status || '').toLowerCase()), time: selectedOrder.created_at },
                    { label: 'Paid', done: ['paid', 'delivered', 'completed'].includes((selectedOrder.status || '').toLowerCase()), time: selectedOrder.created_at },
                    { label: 'Delivered', done: ['delivered', 'completed'].includes((selectedOrder.status || '').toLowerCase()), time: selectedOrder.created_at },
                  ].map((step) => (
                    <div key={step.label} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${step.done ? 'bg-emerald-600' : 'bg-stone-300'}`} />
                        {step.label !== 'Delivered' && <span className="mt-1 h-full w-px bg-stone-200" />}
                      </div>
                      <div className="flex-1 pb-1">
                        <p className="text-sm font-medium text-stone-700">{step.label}</p>
                        <p className="font-data text-xs text-stone-400">{step.done ? formatDate(step.time) : 'Pending'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.12em] text-stone-400">Notes</p>
                <textarea
                  readOnly
                  value={selectedOrder.notes || 'No notes added yet.'}
                  className="min-h-[120px] w-full resize-none rounded-md border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600 focus:outline-none"
                />
              </div>

              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-emerald-700">AI extraction</p>
                <div className="mt-3 rounded-md border border-emerald-100 bg-white p-3 text-sm text-stone-600">
                  <p className="mb-3 text-xs uppercase tracking-[0.12em] text-stone-400">Raw customer message</p>
                  <blockquote className="border-l-2 border-stone-200 pl-3 italic text-stone-500">
                    {selectedOrder.raw_message || 'Hi, I want 2 black medium tees and 1 denim blue shirt.'}
                  </blockquote>
                </div>
                <div className="mt-3 space-y-2 text-sm text-stone-700">
                  <p className="font-medium text-emerald-900">AI extracted:</p>
                  <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                    <span>Product</span>
                    <span className="font-data text-stone-800">{(selectedOrder.items || [{}])[0]?.product_name || 'T-shirt'}</span>
                    <span>Qty</span>
                    <span className="font-data text-stone-800">{(selectedOrder.items || [{}])[0]?.quantity || '2'}</span>
                    <span>Size</span>
                    <span className="font-data text-stone-800">{(selectedOrder.items || [{}])[0]?.variant || 'M'}</span>
                  </div>
                </div>
                <div className="mt-4">
                  <Button variant="secondary" className="h-10 px-4 text-sm">Confirm order</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
