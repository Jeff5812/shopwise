'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { confirmOrder, cancelOrder, ApiError } from '@/lib/api';

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
  if (!val || val === 'pending') return 'unpaid';
  if (['paid', 'completed'].includes(val)) return 'paid';
  if (['cod', 'cash_on_delivery'].includes(val)) return 'processing';
  return val; // failed / cancelled / refunded shown as-is
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

function getCustomerName(order: {
  customers?: { display_name?: string | null; wa_id?: string | null } | null;
}) {
  return order.customers?.display_name || order.customers?.wa_id || 'Customer';
}

const selectClass =
  'h-11 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900';

export function OrdersBoard({ orders }: { orders: any[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sort, setSort] = useState<{
    key: 'customer' | 'amount' | 'created';
    direction: 'asc' | 'desc';
  }>({ key: 'created', direction: 'desc' });
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; show: boolean } | null>(null);

  function showToast(text: string) {
    setToast({ text, show: false });
    requestAnimationFrame(() => requestAnimationFrame(() => setToast({ text, show: true })));
    setTimeout(() => setToast((current) => (current ? { ...current, show: false } : current)), 2400);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleConfirm(order: any) {
    setActionPending(true);
    setActionError(null);
    try {
      await confirmOrder(order.id);
      setSelectedOrder(null);
      showToast('Order confirmed');
      router.refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not confirm this order. Try again.');
    } finally {
      setActionPending(false);
    }
  }

  async function handleCancel(order: any) {
    setActionPending(true);
    setActionError(null);
    try {
      await cancelOrder(order.id);
      setSelectedOrder(null);
      showToast('Order cancelled');
      router.refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not cancel this order. Try again.');
    } finally {
      setActionPending(false);
    }
  }

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = new Date();
    return orders.filter((order) => {
      const matchesSearch =
        !query ||
        order.id.toLowerCase().includes(query) ||
        (order.customers?.display_name || order.customers?.wa_id || '').toLowerCase().includes(query) ||
        (order.itemsSummary || '').toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || normalizeStatus(order.status) === statusFilter;
      const createdAt = order.created_at ? new Date(order.created_at) : null;
      const matchesDate =
        dateFilter === 'all' ||
        (createdAt !== null &&
          !Number.isNaN(createdAt.getTime()) &&
          (dateFilter === 'today'
            ? createdAt.toDateString() === now.toDateString()
            : createdAt.getTime() >=
              now.getTime() - (dateFilter === '7d' ? 7 : 30) * 86400000));
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [orders, search, statusFilter, dateFilter]);

  const sortedOrders = useMemo(() => {
    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...filteredOrders].sort((left, right) => {
      let comparison = 0;
      if (sort.key === 'customer') {
        comparison = getCustomerName(left).localeCompare(getCustomerName(right));
      } else if (sort.key === 'amount') {
        comparison = Number(left.total_amount ?? 0) - Number(right.total_amount ?? 0);
      } else {
        comparison =
          new Date(left.created_at || 0).getTime() -
          new Date(right.created_at || 0).getTime();
      }
      return comparison * direction;
    });
  }, [filteredOrders, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = sortedOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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

  const customerName = getCustomerName;

  function toggleSort(key: 'customer' | 'amount' | 'created') {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
    setPage(1);
  }

  function sortLabel(label: string, key: 'customer' | 'amount' | 'created') {
    const active = sort.key === key;
    return (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        aria-label={`Sort by ${label}${active ? `, ${sort.direction === 'asc' ? 'ascending' : 'descending'}` : ''}`}
        className="inline-flex min-h-8 items-center gap-1 text-left hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
      >
        {label}
        <span aria-hidden="true" className="text-stone-400">
          {active ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    );
  }

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
            <h1 className="font-serif text-3xl font-semibold text-stone-900 sm:text-4xl">Orders</h1>
          </div>
        </div>

        <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-stone-200 bg-white p-8 text-center">
          <div>
            <p className="text-lg font-medium text-stone-900">No orders yet</p>
            <p className="mt-1 text-sm text-stone-500">Orders created from WhatsApp will appear here once your store starts selling.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6 xl:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-serif text-3xl font-semibold text-stone-900 sm:text-4xl">Orders</h1>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <label className="flex flex-1 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-500 focus-within:border-stone-900 focus-within:ring-4 focus-within:ring-stone-900/10">
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
              aria-label="Search orders"
              placeholder="Search orders"
              className="w-full bg-transparent text-stone-900 placeholder:text-stone-400 focus:outline-none"
            />
          </label>
          <label className="sr-only" htmlFor="order-status-filter">Filter orders by status</label>
          <select
            id="order-status-filter"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className={selectClass}
          >
            <option value="all">All statuses</option>
            <option value="processing">Processing</option>
            <option value="pending_payment">Pending payment</option>
            <option value="confirmed">Confirmed</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <label className="sr-only" htmlFor="order-date-filter">Filter orders by date</label>
          <select
            id="order-date-filter"
            value={dateFilter}
            onChange={(event) => {
              setDateFilter(event.target.value);
              setPage(1);
            }}
            className={selectClass}
          >
            <option value="all">Any date</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {statusSummary.map((item) => (
          <div key={item.label} className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3.5 py-1.5 text-sm text-stone-500">
            <span>{item.label}</span>
            <span className="font-data text-sm font-medium text-stone-900">{item.value}</span>
          </div>
        ))}
      </div>

      <div className="overflow-hidden surface-card">
        <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-stone-900">All orders</h2>
          <span className="text-xs text-stone-500">
            {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'}
          </span>
        </div>
        <div className="hidden border-b border-stone-200 bg-stone-200/30 text-xs font-medium text-stone-500 sm:grid sm:grid-cols-[1.1fr_1.4fr_1.5fr_0.9fr_0.9fr_0.9fr_0.7fr_0.6fr]">
          <div className="px-4 py-3">Order ID</div>
          <div className="px-4 py-3">{sortLabel('Customer', 'customer')}</div>
          <div className="px-4 py-3">Products</div>
          <div className="px-4 py-3">{sortLabel('Amount', 'amount')}</div>
          <div className="px-4 py-3">Payment</div>
          <div className="px-4 py-3">Status</div>
          <div className="px-4 py-3">{sortLabel('Created', 'created')}</div>
          <div className="px-4 py-3 text-right">Action</div>
        </div>

        {pageItems.length === 0 ? (
          <div className="p-6 text-sm text-stone-500">No orders match your search.</div>
        ) : (
          <div>
            {pageItems.map((order) => {
              const paymentStatus = normalizePayment(order.payment_status);
              const status = normalizeStatus(order.status);
              return (
                <div
                  key={order.id}
                  className="items-center border-b border-stone-100 transition-colors last:border-0 hover:bg-stone-200/25 sm:grid sm:grid-cols-[1.1fr_1.4fr_1.5fr_0.9fr_0.9fr_0.9fr_0.7fr_0.6fr]"
                >
                  <div className="px-4 py-3 text-sm text-stone-700 sm:border-0">
                    <span className="font-medium">#{order.id.slice(0, 8)}</span>
                  </div>
                  <div className="px-4 py-3 text-sm font-medium text-stone-900 sm:border-0">{customerName(order)}</div>
                  <div className="px-4 py-3 text-sm text-stone-500 sm:border-0">{order.itemsSummary || '—'}</div>
                  <div className="px-4 py-3 font-data text-sm text-stone-900 sm:border-0">{formatMoney(order.total_amount)}</div>
                  <div className="px-4 py-3 sm:border-0"><Badge status={paymentStatus} /></div>
                  <div className="px-4 py-3 sm:border-0"><Badge status={status} /></div>
                  <div className="px-4 py-3 font-data text-sm text-stone-500 sm:border-0">{formatDate(order.created_at)}</div>
                  <div className="px-4 py-3 sm:flex sm:justify-end sm:border-0">
                    <Button variant="ghost" className="h-9 px-3 text-sm" onClick={() => setSelectedOrder(order)}>
                      View
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {sortedOrders.length > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm text-stone-500">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="h-10 px-4 text-sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1}>
              Prev
            </Button>
            <Button variant="secondary" className="h-10 px-4 text-sm" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage === totalPages}>
              Next
            </Button>
          </div>
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-stone-900/30" onClick={() => { setSelectedOrder(null); setActionError(null); }}>
          <div className="ml-auto flex h-full w-full max-w-xl flex-col border-l border-stone-200 bg-white shadow-lift" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
              <div>
                <p className="text-xs font-medium text-stone-500">Order details</p>
                <h2 className="mt-1 font-serif text-xl font-semibold text-stone-900">#{selectedOrder.id.slice(0, 8)}</h2>
              </div>
              <button
                type="button"
                aria-label="Close order details"
                onClick={() => { setSelectedOrder(null); setActionError(null); }}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-900"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-stone-500">Customer</p>
                  <p className="mt-1.5 text-sm text-stone-900">{customerName(selectedOrder)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-stone-500">Created</p>
                  <p className="mt-1.5 font-data text-sm text-stone-900">{formatDate(selectedOrder.created_at)}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge status={normalizePayment(selectedOrder.payment_status)} />
                <Badge status={normalizeStatus(selectedOrder.status)} />
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-stone-500">Line items</p>
                <div className="space-y-2">
                  {(selectedOrder.items || []).map((item: any, index: number) => (
                    <div key={`${item.product_name || 'item'}-${index}`} className="flex items-center justify-between gap-3 border-b border-stone-100 pb-2 text-sm text-stone-700">
                      <div>
                        <p className="font-medium text-stone-900">{item.product_name || 'Product item'}</p>
                        <p className="text-stone-500">{item.variant || 'Standard'} × {item.quantity}</p>
                      </div>
                      <span className="font-data text-stone-900">{formatMoney(item.unit_price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-center justify-between text-sm text-stone-600">
                  <span>Subtotal</span>
                  <span className="font-data text-stone-900">{formatMoney(selectedOrder.subtotal_amount || selectedOrder.total_amount)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-stone-600">
                  <span>Total</span>
                  <span className="font-data text-lg font-medium text-stone-900">{formatMoney(selectedOrder.total_amount)}</span>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-stone-500">Timeline</p>
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
                        <p className="font-data text-xs text-stone-500">{step.done ? formatDate(step.time) : 'Pending'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-stone-500">Notes</p>
                <textarea
                  readOnly
                  value={selectedOrder.notes || 'No notes added yet.'}
                  className="min-h-[120px] w-full resize-none rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600 focus:outline-none"
                />
              </div>

              <div className="rounded-2xl border border-stone-200 bg-stone-200/40 p-4">
                <p className="text-xs font-medium text-stone-600">AI extraction</p>
                <div className="mt-3 rounded-xl border border-stone-200 bg-white p-3 text-sm text-stone-600">
                  <p className="mb-3 text-xs font-medium text-stone-500">Raw customer message</p>
                  <blockquote className="border-l-2 border-stone-200 pl-3 italic text-stone-500">
                    {selectedOrder.raw_message || 'No message text available.'}
                  </blockquote>
                </div>
                <div className="mt-3 space-y-2 text-sm text-stone-700">
                  <p className="font-medium text-stone-900">AI extracted:</p>
                  <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                    <span>Product</span>
                    <span className="font-data text-stone-900">{(selectedOrder.items || [{}])[0]?.product_name || '—'}</span>
                    <span>Qty</span>
                    <span className="font-data text-stone-900">{(selectedOrder.items || [{}])[0]?.quantity || '—'}</span>
                    <span>Size</span>
                    <span className="font-data text-stone-900">{(selectedOrder.items || [{}])[0]?.variant || '—'}</span>
                  </div>
                </div>
                <div className="mt-4">
                  {(selectedOrder.status || '').toLowerCase() === 'awaiting_confirmation' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="primary"
                        className="h-11 px-5 text-sm"
                        onClick={() => handleConfirm(selectedOrder)}
                        disabled={actionPending}
                      >
                        {actionPending ? 'Confirming…' : 'Confirm order'}
                      </Button>
                      <Button
                        variant="danger"
                        className="h-11 px-5 text-sm"
                        onClick={() => handleCancel(selectedOrder)}
                        disabled={actionPending}
                      >
                        {actionPending ? 'Cancelling…' : 'Cancel order'}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-stone-500">
                      This order is {(selectedOrder.status || 'processed').replace(/_/g, ' ')} — no pending action needed.
                    </p>
                  )}
                  {actionError && <p className="mt-2 text-sm text-danger">{actionError}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`toast flex items-center gap-2.5 rounded-xl bg-stone-900 px-4 py-3 text-sm font-medium text-stone-50 shadow-lift ${toast.show ? 'show' : ''}`}
        >
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-600" />
          {toast.text}
        </div>
      )}
    </main>
  );
}
