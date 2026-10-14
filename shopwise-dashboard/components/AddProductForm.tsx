'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { createProduct, ApiError } from '@/lib/api';

type VariantRow = { size: string; color: string; stock: string };

const input = 'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-600';

// Self-contained "Add product" dialog. All validation that matters (prices, duplicate names,
// duplicate variants) is enforced by POST /products in shopwise-backend; this only collects input.
export function AddProductForm({ vendorId, onClose }: { vendorId: string; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [sell, setSell] = useState('');
  const [floor, setFloor] = useState('');
  const [variants, setVariants] = useState<VariantRow[]>([{ size: '', color: '', stock: '0' }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateVariant(index: number, patch: Partial<VariantRow>) {
    setVariants((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function handleSubmit() {
    setError(null);
    setSaving(true);
    try {
      await createProduct({
        vendor_id: vendorId,
        name,
        cost_price: Number(cost || 0),
        sell_price: Number(sell),
        floor_price: floor.trim() === '' ? undefined : Number(floor),
        variants: variants.map((v) => ({ size: v.size, color: v.color, stock_quantity: Number(v.stock) })),
      });
      router.refresh();
      onClose();
    } catch (e) {
      // 422 detail is a JSON list of field problems; show something readable either way.
      setError(e instanceof ApiError && e.status === 409 ? 'You already have a product with that name.'
        : e instanceof ApiError && e.status === 422 ? 'Check the details: name, a selling price above 0, floor price not above selling price, stock of 0 or more, and different size/colour per row.'
        : 'Could not save the product. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/30 p-4" onClick={onClose}>
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-xl border border-stone-200 bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-stone-900">Add product</h2>
          <button type="button" onClick={onClose} className="text-stone-500 hover:text-stone-900">✕</button>
        </div>

        <div className="space-y-3">
          <label className="block text-sm text-stone-600">Name
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ankara Gown" />
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="block text-sm text-stone-600">Cost (₦)
              <input className={input} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
            </label>
            <label className="block text-sm text-stone-600">Selling price (₦)
              <input className={input} inputMode="decimal" value={sell} onChange={(e) => setSell(e.target.value)} />
            </label>
            <label className="block text-sm text-stone-600">Lowest price (₦)
              <input className={input} inputMode="decimal" value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="optional" />
            </label>
          </div>

          <div>
            <p className="mb-1 text-sm text-stone-600">Variants and stock <span className="text-stone-400">(leave size and colour empty for a single item)</span></p>
            <div className="space-y-2">
              {variants.map((v, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_5rem_auto] gap-2">
                  <input className={input} placeholder="Size" value={v.size} onChange={(e) => updateVariant(i, { size: e.target.value })} />
                  <input className={input} placeholder="Colour" value={v.color} onChange={(e) => updateVariant(i, { color: e.target.value })} />
                  <input className={input} inputMode="numeric" placeholder="Stock" value={v.stock} onChange={(e) => updateVariant(i, { stock: e.target.value })} />
                  <button type="button" disabled={variants.length === 1} onClick={() => setVariants((rows) => rows.filter((_, j) => j !== i))} className="px-2 text-stone-400 hover:text-stone-900 disabled:opacity-30">✕</button>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="mt-2" type="button" onClick={() => setVariants((rows) => [...rows, { size: '', color: '', stock: '0' }])}>+ Add variant</Button>
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
            <Button type="button" disabled={saving || !name.trim() || !sell} onClick={handleSubmit}>{saving ? 'Saving…' : 'Save product'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
