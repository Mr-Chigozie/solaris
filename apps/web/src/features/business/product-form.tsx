'use client';

import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABEL, SPEC_FIELDS } from '@solaris/validation';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ProductCategory } from '@/features/marketplace/types';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/format';
import { MultiImageUpload } from './image-upload';
import { useWorkspace } from './workspace-context';

export interface ProductFormValue {
  id?: string;
  name: string;
  category: ProductCategory;
  brand: string;
  model: string;
  sku: string;
  description: string;
  price: number | null;
  specifications: Record<string, string | number>;
  images: string[];
  stockQuantity: number;
  trackInventory: boolean;
  status: 'DRAFT' | 'PUBLISHED';
}

export const EMPTY_PRODUCT: ProductFormValue = {
  name: '', category: 'SOLAR_PANEL', brand: '', model: '', sku: '', description: '', price: null,
  specifications: {}, images: [], stockQuantity: 0, trackInventory: true, status: 'DRAFT',
};

export function ProductForm({ initial }: { initial: ProductFormValue }) {
  const { ws, reload } = useWorkspace();
  const router = useRouter();
  const [v, setV] = useState<ProductFormValue>(initial);
  const [extra, setExtra] = useState<Array<[string, string]>>(() => {
    const known = new Set(SPEC_FIELDS[initial.category].map((f) => f.key));
    return Object.entries(initial.specifications).filter(([k]) => !known.has(k)).map(([k, val]) => [k, String(val)]);
  });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const fields = SPEC_FIELDS[v.category];

  const set = <K extends keyof ProductFormValue>(k: K, val: ProductFormValue[K]) => setV((x) => ({ ...x, [k]: val }));
  const setSpec = (k: string, val: string | number | undefined) =>
    setV((x) => {
      const specs = { ...x.specifications };
      if (val === undefined || val === '') delete specs[k];
      else specs[k] = val;
      return { ...x, specifications: specs };
    });

  async function save(status: 'DRAFT' | 'PUBLISHED') {
    setBusy(true);
    setErrors({});
    setError(null);
    const known = new Set(fields.map((f) => f.key));
    const specifications = Object.fromEntries([
      ...Object.entries(v.specifications).filter(([k]) => known.has(k)),
      ...extra.filter(([k, val]) => k.trim() && val.trim()).map(([k, val]) => [k.trim(), val.trim()]),
    ]);
    const body = {
      name: v.name, category: v.category, description: v.description || undefined,
      brand: v.brand || undefined, model: v.model || undefined, sku: v.sku || undefined,
      price: v.price, specifications, images: v.images, stockQuantity: v.stockQuantity, trackInventory: v.trackInventory, status,
    };
    try {
      if (v.id) await api(`/organizations/${ws.organization.id}/products/${v.id}`, { method: 'PATCH', body });
      else await api(`/organizations/${ws.organization.id}/products`, { method: 'POST', body });
      reload();
      router.push(`/business/${ws.organization.id}/products`);
    } catch (e) {
      if (e instanceof ApiError && e.issues.length) setErrors(e.fieldErrors());
      setError(e instanceof ApiError ? (e.issues.length ? 'Please fix the highlighted fields.' : e.message) : 'Save failed');
      setBusy(false);
    }
  }

  return (
    <fieldset disabled={busy || !ws.can.MANAGE_PRODUCTS} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <section className="card space-y-4 p-6">
          <label className="block">
            <span className="label">Product name</span>
            <input className={cn('field', errors.name && 'border-red-400/60')} value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Jinko Tiger Neo 580W N-type mono panel" maxLength={140} />
            {errors.name && <span className="mt-1 block text-xs text-red-300">{errors.name}</span>}
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label>
              <span className="label">Category</span>
              <select className="field" value={v.category} onChange={(e) => set('category', e.target.value as ProductCategory)}>
                {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{PRODUCT_CATEGORY_LABEL[c]}</option>)}
              </select>
            </label>
            <label><span className="label">Brand</span><input className="field" value={v.brand} onChange={(e) => set('brand', e.target.value)} maxLength={80} /></label>
            <label><span className="label">Model</span><input className="field" value={v.model} onChange={(e) => set('model', e.target.value)} maxLength={80} /></label>
          </div>
          <label className="block">
            <span className="label">Description</span>
            <textarea className="field min-h-[140px]" value={v.description} onChange={(e) => set('description', e.target.value)} maxLength={5000} placeholder="Key features, what's in the box, warranty terms, delivery and installation notes…" />
          </label>
        </section>

        <section className="card p-6">
          <MultiImageUpload value={v.images} onChange={(images) => set('images', images)} />
        </section>

        <section className="card p-6">
          <h2 className="font-bold text-white">Specifications</h2>
          <p className="mt-1 text-sm text-ink-400">Accurate specs help customers match your product to their solar design.</p>
          {fields.length > 0 && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {fields.map((f) => (
                <label key={f.key}>
                  <span className="label">{f.label}{f.unit ? ` (${f.unit})` : ''}</span>
                  <input
                    className="field"
                    type={f.type === 'number' ? 'number' : 'text'}
                    step="any"
                    value={v.specifications[f.key] ?? ''}
                    onChange={(e) => setSpec(f.key, f.type === 'number' ? (Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined) : e.target.value)}
                  />
                </label>
              ))}
            </div>
          )}
          <div className="mt-5 space-y-2">
            <span className="label">Other specifications</span>
            {extra.map(([k, val], i) => (
              <div key={i} className="flex gap-2">
                <input className="field" placeholder="Name (e.g. Dimensions)" value={k} maxLength={40} onChange={(e) => setExtra((x) => x.map((r, j) => (j === i ? [e.target.value, r[1]] : r)))} />
                <input className="field" placeholder="Value" value={val} maxLength={120} onChange={(e) => setExtra((x) => x.map((r, j) => (j === i ? [r[0], e.target.value] : r)))} />
                <button type="button" className="btn btn-ghost px-2.5" onClick={() => setExtra((x) => x.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost px-3 py-1.5 text-xs" onClick={() => setExtra((x) => [...x, ['', '']])}><Plus className="h-3.5 w-3.5" /> Add specification</button>
          </div>
        </section>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <section className="card space-y-4 p-6">
          <label className="block">
            <span className="label">Price (₦)</span>
            <input className={cn('field', errors.price && 'border-red-400/60')} type="number" min={0} step="any" value={v.price ?? ''} placeholder="Leave empty for “price on request”" onChange={(e) => set('price', Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : null)} />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-300">
            <input type="checkbox" className="h-4 w-4 accent-sun-400" checked={v.trackInventory} onChange={(e) => set('trackInventory', e.target.checked)} />
            Track stock quantity
          </label>
          {v.trackInventory && (
            <label className="block">
              <span className="label">Units in stock</span>
              <input className="field" type="number" min={0} value={v.stockQuantity} onChange={(e) => set('stockQuantity', Math.max(0, Math.round(e.target.valueAsNumber || 0)))} />
            </label>
          )}
          <label className="block"><span className="label">SKU (optional)</span><input className="field" value={v.sku} onChange={(e) => set('sku', e.target.value)} maxLength={60} /></label>
        </section>

        <section className="card space-y-3 p-6">
          {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
          <button type="button" className="btn btn-primary w-full" onClick={() => save('PUBLISHED')}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {initial.status === 'PUBLISHED' ? 'Save & keep published' : 'Publish'}
          </button>
          <button type="button" className="btn btn-secondary w-full" onClick={() => save('DRAFT')}>{initial.status === 'PUBLISHED' ? 'Unpublish (save as draft)' : 'Save as draft'}</button>
          {!ws.publiclyVisible && <p className="text-xs text-ink-400">Published listings appear in the marketplace once your business is verified.</p>}
        </section>
      </aside>
    </fieldset>
  );
}
