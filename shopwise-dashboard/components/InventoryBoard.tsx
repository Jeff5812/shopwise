'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { updateStock, ApiError } from '@/lib/api';

function formatMoney(value: number | null | undefined) {
  const numeric = Number(value ?? 0);
  return `₦${numeric.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

function getStockStatus(stock: number, typicalStock: number) {
  const safeTypical = Math.max(typicalStock || 10, 1);
  if (stock <= 0) return 'out_of_stock';
  if (stock <= 5 || stock <= safeTypical * 0.05) return 'critical';
  if (stock <= safeTypical * 0.2) return 'low';
  return 'healthy';
}

export function InventoryBoard({ inventory }: { inventory: any[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [filter, setFilter] = useState<'all' | 'healthy' | 'low' | 'critical' | 'out_of_stock'>('all');
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [pendingVariantId, setPendingVariantId] = useState<string | null>(null);
  const [stockError, setStockError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return inventory.filter((row) => {
      const matchesQuery =
        !normalized ||
        (row.name || '').toLowerCase().includes(normalized) ||
        (row.sku || '').toLowerCase().includes(normalized) ||
        (row.product_id || '').toLowerCase().includes(normalized);
      const matchesFilter = filter === 'all' || row.status === filter;
      return matchesQuery && matchesFilter;
    });
  }, [inventory, query, filter]);

  const summary = useMemo(() => {
    const totals = {
      totalProducts: inventory.length,
      lowStock: inventory.filter((row) => row.status === 'low').length,
      outOfStock: inventory.filter((row) => row.status === 'out_of_stock').length,
      inventoryValue: inventory.reduce((sum, row) => sum + Number(row.stock_quantity || 0) * Number(row.cost_price || 0), 0),
    };
    return totals;
  }, [inventory]);

  const activeProduct = selectedProduct || filtered[0] || null;

  async function handleStockSave(variantId: string) {
    const raw = editValues[variantId];
    const parsed = Number(raw);
    if (raw === undefined || Number.isNaN(parsed) || parsed < 0) {
      setStockError('Enter a valid non-negative number.');
      return;
    }
    setPendingVariantId(variantId);
    setStockError(null);
    try {
      await updateStock(variantId, parsed);
      router.refresh();
    } catch (err) {
      setStockError(err instanceof ApiError ? err.message : 'Could not update stock. Try again.');
    } finally {
      setPendingVariantId(null);
    }
  }

  if (!inventory.length) {
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-6 xl:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.05em] text-stone-900">Inventory</h1>
          </div>
        </div>

        <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 border border-dashed border-stone-200 bg-white p-8 text-center">
          <div>
            <p className="text-lg font-medium text-stone-900">No products yet</p>
            <p className="mt-1 text-sm text-stone-500">Add stock to start tracking inventory levels and replenishment.</p>
          </div>
          <Button variant="primary" className="h-10 px-4 text-sm">Add product</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6 xl:p-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-semibold tracking-[-0.05em] text-stone-900">Inventory</h1>
        <div className="flex w-full max-w-lg items-center gap-2 sm:w-auto">
          <label className="flex flex-1 items-center gap-2 surface-card px-3 py-2 text-sm text-stone-500">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="5.5" />
              <path d="M16 16l4.5 4.5" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search product"
              className="w-full bg-transparent text-stone-700 placeholder:text-stone-400 focus:outline-none"
            />
          </label>
          <Button variant="secondary" className="h-10 px-3 text-sm">Category</Button>
          <Button variant="secondary" className="h-10 px-3 text-sm">Status</Button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-stone-500">
        <div className="flex items-center gap-2">
          <span>Total products</span>
          <span className="font-data text-base text-stone-900">{summary.totalProducts}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Low stock</span>
          <span className="font-data text-base text-stone-900">{summary.lowStock}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Out of stock</span>
          <span className="font-data text-base text-stone-900">{summary.outOfStock}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Inventory value</span>
          <span className="font-data text-base text-stone-900">{formatMoney(summary.inventoryValue)}</span>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', 'healthy', 'low', 'critical', 'out_of_stock'] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              filter === status
                ? 'border-stone-900 bg-stone-100 text-stone-900'
                : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
            }`}
          >
            {status === 'all' ? 'All' : status.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="overflow-hidden surface-card">
        <div className="hidden border-b border-stone-200 bg-stone-50 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500 md:grid md:grid-cols-[1.6fr_1fr_0.9fr_0.8fr_0.8fr_0.8fr_0.7fr]">
          <div className="px-4 py-3">Product</div>
          <div className="px-4 py-3">SKU</div>
          <div className="px-4 py-3">Stock</div>
          <div className="px-4 py-3">Cost</div>
          <div className="px-4 py-3">Price</div>
          <div className="px-4 py-3">Margin</div>
          <div className="px-4 py-3">Status</div>
        </div>

        {filtered.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelectedProduct(item)}
            className="block w-full border-b border-stone-100 text-left transition-colors last:border-0 hover:bg-stone-50 md:grid md:grid-cols-[1.6fr_1fr_0.9fr_0.8fr_0.8fr_0.8fr_0.7fr]"
          >
            <div className="px-4 py-3 text-sm text-stone-800">{item.name || 'Unnamed product'}</div>
            <div className="px-4 py-3 font-data text-sm text-stone-600">{item.sku || '—'}</div>
            <div className="px-4 py-3 font-data text-sm text-stone-900">{item.stock_quantity ?? 0}</div>
            <div className="px-4 py-3 font-data text-sm text-stone-600">{formatMoney(item.cost_price)}</div>
            <div className="px-4 py-3 font-data text-sm text-stone-600">{formatMoney(item.price)}</div>
            <div className="px-4 py-3 font-data text-sm text-stone-600">
              {item.price ? formatMoney((Number(item.price) - Number(item.cost_price || 0)) * Number(item.stock_quantity || 0)) : '—'}
            </div>
            <div className="px-4 py-3"><Badge status={item.status} /></div>
          </button>
        ))}
      </div>

      {activeProduct && (
        <div className="fixed inset-0 z-50 bg-stone-900/20" onClick={() => setSelectedProduct(null)}>
          <div className="ml-auto flex h-full w-full max-w-xl flex-col border-l border-stone-200 bg-white" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-400">Product details</p>
                <h2 className="mt-1 text-xl font-semibold text-stone-900">{activeProduct.name || 'Product'}</h2>
              </div>
              <button type="button" onClick={() => setSelectedProduct(null)} className="text-stone-500 hover:text-stone-900">✕</button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-stone-400">SKU</p>
                  <p className="mt-2 font-data text-sm text-stone-800">{activeProduct.sku || '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Stock</p>
                  <p className="mt-2 font-data text-sm text-stone-800">{activeProduct.stock_quantity ?? 0}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2"><Badge status={activeProduct.status} /></div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.12em] text-stone-400">Variants &amp; stock</p>
                <div className="space-y-2">
                  {(activeProduct.variants || []).length === 0 && (
                    <p className="text-sm text-stone-500">No variants recorded for this product.</p>
                  )}
                  {(activeProduct.variants || []).map((variant: any) => {
                    const label = [variant.size, variant.color].filter(Boolean).join(' / ') || 'Default';
                    const currentEdit = editValues[variant.id] ?? String(variant.stock_quantity);
                    return (
                      <div key={variant.id} className="flex items-center justify-between gap-3 rounded-md border border-stone-200 bg-stone-50 p-3">
                        <div>
                          <p className="text-sm font-medium text-stone-800">{label}</p>
                          <p className="text-xs text-stone-500">Current stock: {variant.stock_quantity}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            value={currentEdit}
                            onChange={(event) => setEditValues((prev) => ({ ...prev, [variant.id]: event.target.value }))}
                            className="w-20 rounded-md border border-stone-300 px-2 py-1.5 text-sm text-stone-800 focus:border-stone-500 focus:outline-none"
                          />
                          <Button
                            variant="secondary"
                            className="h-9 px-3 text-sm"
                            onClick={() => handleStockSave(variant.id)}
                            disabled={pendingVariantId === variant.id}
                          >
                            {pendingVariantId === variant.id ? 'Saving…' : 'Save'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {stockError && <p className="mt-2 text-sm text-rose-600">{stockError}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-md border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Units sold</p>
                  <p className="mt-2 font-data text-stone-800">{activeProduct.units_sold ?? 'Not available'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Velocity</p>
                  <p className="mt-2 font-data text-stone-800">{activeProduct.sales_velocity ?? 'Not available'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Cost</p>
                  <p className="mt-2 font-data text-stone-800">{activeProduct.cost_price ? formatMoney(activeProduct.cost_price) : 'Not available'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Price</p>
                  <p className="mt-2 font-data text-stone-800">{activeProduct.price ? formatMoney(Number(activeProduct.price)) : 'Not available'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Profit</p>
                  <p className="mt-2 font-data text-stone-800">{activeProduct.cost_price && (activeProduct.price) ? formatMoney(Number(activeProduct.price) - Number(activeProduct.cost_price)) : 'Not available'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Supplier</p>
                  <p className="mt-2 text-stone-800">{activeProduct.supplier_name || activeProduct.supplier || 'Not available in current data model'}</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.12em] text-stone-400">Stock history</p>
                <div className="rounded-md border border-stone-200 bg-stone-50 p-3 text-sm text-stone-500">
                  {activeProduct.stock_history && activeProduct.stock_history.length ? (
                    <div className="space-y-2">
                      {activeProduct.stock_history.slice(0, 4).map((entry: any, idx: number) => (
                        <div key={`${entry.date || 'entry'}-${idx}`} className="flex items-center justify-between gap-3">
                          <span>{entry.date || 'Unknown date'}</span>
                          <span className="font-data text-stone-800">{entry.stock ?? '—'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>Stock history is not available in the current data model.</p>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.12em] text-stone-400">Last restock</p>
                <p className="text-sm text-stone-600">{activeProduct.last_restock || 'No restock history available yet.'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
