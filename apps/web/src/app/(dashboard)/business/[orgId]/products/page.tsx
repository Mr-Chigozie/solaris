'use client';

import { PRODUCT_CATEGORY_LABEL } from '@solaris/validation';
import { Archive, Eye, Loader2, Package, Pencil, Plus } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useWorkspace } from '@/features/business/workspace-context';
import { productPrice, type ProductCardData } from '@/features/marketplace/types';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/format';

type Row = ProductCardData & { status: 'DRAFT' | 'PUBLISHED' };

export default function BusinessProductsPage() {
  const { ws, reload: reloadWs } = useWorkspace();
  const orgId = ws.organization.id;
  const [items, setItems] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Row[]>(`/organizations/${orgId}/products`).then((r) => setItems(r.data)).catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load products'));
  }, [orgId]);
  useEffect(load, [load]);

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    setError(null);
    try {
      await fn();
      load();
      reloadWs();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Products</h2>
          <p className="mt-1 text-sm text-ink-400">Drafts are only visible to your team. Stock updates instantly.</p>
        </div>
        {ws.can.MANAGE_PRODUCTS && <Link href={`/business/${orgId}/products/new`} className="btn btn-primary self-start"><Plus className="h-4 w-4" /> Add product</Link>}
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

      {items === null && !error && <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-ink-400" /></div>}
      {items?.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-10 text-center">
          <Package className="mx-auto h-8 w-8 text-ink-400" />
          <p className="mt-3 text-ink-300">No products yet.</p>
        </div>
      )}

      <div className="mt-5 divide-y divide-white/[0.06]">
        {items?.map((p) => (
          <div key={p.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-ink-900/70">
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                ) : <Package className="m-auto mt-4 h-6 w-6 text-ink-600" />}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{p.name}</p>
                <p className="text-xs text-ink-400">
                  {PRODUCT_CATEGORY_LABEL[p.category]} · {productPrice(p)}
                  <span className={cn('ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', p.status === 'PUBLISHED' ? 'bg-volt-500/15 text-volt-300' : 'bg-white/[0.06] text-ink-400')}>{p.status === 'PUBLISHED' ? 'Live' : 'Draft'}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {p.trackInventory && (
                <StockInput value={p.stockQuantity} disabled={!ws.can.MANAGE_INVENTORY || busy === p.id} onCommit={(n) => act(p.id, () => api(`/organizations/${orgId}/products/${p.id}/stock`, { method: 'PATCH', body: { stockQuantity: n } }))} />
              )}
              {p.status === 'PUBLISHED' && ws.publiclyVisible && (
                <Link href={`/marketplace/${ws.organization.slug}/${p.slug}`} target="_blank" className="btn btn-ghost px-2.5" aria-label="View live"><Eye className="h-4 w-4" /></Link>
              )}
              {ws.can.MANAGE_PRODUCTS && (
                <>
                  <Link href={`/business/${orgId}/products/${p.id}`} className="btn btn-secondary px-3 py-2"><Pencil className="h-4 w-4" /> Edit</Link>
                  <button
                    type="button"
                    className="btn btn-ghost px-2.5"
                    disabled={busy === p.id}
                    aria-label="Archive"
                    onClick={() => window.confirm(`Archive “${p.name}”? It will be removed from the marketplace.`) && act(p.id, () => api(`/organizations/${orgId}/products/${p.id}`, { method: 'DELETE' }))}
                  >
                    {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StockInput({ value, disabled, onCommit }: { value: number; disabled?: boolean; onCommit: (n: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return (
    <label className="flex items-center gap-2 text-xs text-ink-400">
      Stock
      <input
        type="number"
        min={0}
        disabled={disabled}
        className="field w-20 px-2 py-1.5 text-center"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const n = Math.max(0, Math.round(Number(v)));
          if (Number.isFinite(n) && n !== value) onCommit(n);
          else setV(String(value));
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  );
}
