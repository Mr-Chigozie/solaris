'use client';

import { FileText, Loader2, Package, Plus, Trash2, Wrench, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ProductCardData, ServiceData } from '@/features/marketplace/types';
import { api, ApiError } from '@/lib/api';
import { cn, formatNaira } from '@/lib/format';
import type { QuoteRevision } from './types';

type Line = { key: string; kind: 'PRODUCT' | 'SERVICE' | 'CUSTOM'; productId?: string; serviceId?: string; description: string; quantity: number; unitPrice: number };

const VAT_RATE = 0.075; // display only — the server applies the admin-configured rate
let seq = 0;
const key = () => `l${seq++}`;

interface Props {
  organizationId: string;
  conversationId?: string;
  /** Revise an existing quotation instead of creating one. */
  quotationId?: string;
  initial?: Pick<QuoteRevision, 'lineItems' | 'discount' | 'vatRate' | 'notes'> & { title?: string | null };
  onClose: () => void;
  onSaved: (id: string) => void;
}

/** Itemised quotation builder. Totals shown here are a preview; the server recomputes them. */
export function QuoteBuilder({ organizationId, conversationId, quotationId, initial, onClose, onSaved }: Props) {
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [services, setServices] = useState<ServiceData[]>([]);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [lines, setLines] = useState<Line[]>(
    initial?.lineItems.map((l) => ({ key: key(), kind: l.kind, productId: l.productId ?? undefined, serviceId: l.serviceId ?? undefined, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice })) ?? [],
  );
  const [discount, setDiscount] = useState(initial?.discount ?? 0);
  const [applyVat, setApplyVat] = useState(Boolean(initial && initial.vatRate > 0));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [validDays, setValidDays] = useState(14);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<ProductCardData[]>(`/organizations/${organizationId}/products`).then((r) => setProducts(r.data)).catch(() => undefined);
    api<ServiceData[]>(`/organizations/${organizationId}/services`).then((r) => setServices(r.data)).catch(() => undefined);
  }, [organizationId]);

  const totals = useMemo(() => {
    const sub = lines.reduce((s, l) => s + Math.round(l.unitPrice * 100) * l.quantity, 0);
    const disc = Math.round(discount * 100);
    const tax = applyVat ? Math.round((sub - disc) * VAT_RATE) : 0;
    return { subtotal: sub / 100, discount: disc / 100, tax: tax / 100, total: (sub - disc + tax) / 100 };
  }, [lines, discount, applyVat]);

  const update = (k: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === k ? { ...l, ...patch } : l)));

  function addProduct(id: string) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setLines((ls) => [...ls, { key: key(), kind: 'PRODUCT', productId: p.id, description: p.name, quantity: 1, unitPrice: p.price ?? 0 }]);
  }
  function addService(id: string) {
    const s = services.find((x) => x.id === id);
    if (!s) return;
    setLines((ls) => [...ls, { key: key(), kind: 'SERVICE', serviceId: s.id, description: s.title, quantity: 1, unitPrice: s.price ?? 0 }]);
  }

  async function save(send: boolean) {
    setBusy(true);
    setError(null);
    const body = {
      ...(title.trim() ? { title: title.trim() } : {}),
      lineItems: lines.map(({ key: _k, ...l }) => l),
      discount,
      applyVat,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      validDays,
      send,
    };
    try {
      const r = quotationId
        ? await api<{ id: string }>(`/organizations/${organizationId}/quotations/${quotationId}/revisions`, { method: 'POST', body })
        : await api<{ id: string }>(`/organizations/${organizationId}/quotations`, { method: 'POST', body: { ...body, conversationId } });
      onSaved(r.data.id);
    } catch (e) {
      setError(e instanceof ApiError ? (e.issues.map((i) => i.message).join(' · ') || e.message) : 'Could not save quotation');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Quotation builder" className="card flex max-h-[94dvh] w-full max-w-3xl flex-col rounded-b-none p-0 sm:rounded-[var(--brand-radius)]" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-white/[0.06] p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white"><FileText className="h-5 w-5 text-sun-400" /> {quotationId ? 'Revise quotation' : 'New quotation'}</h2>
          <button type="button" onClick={onClose} className="btn btn-ghost px-2" aria-label="Close"><X className="h-5 w-5" /></button>
        </header>

        <fieldset disabled={busy} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <input className="field" placeholder="Title (e.g. 5kVA backup system for Lekki home)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />

          <div className="grid gap-2 sm:grid-cols-3">
            <select className="field" value="" onChange={(e) => addProduct(e.target.value)} aria-label="Add product">
              <option value="">+ Add product…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.price !== null ? ` — ${formatNaira(p.price)}` : ''}</option>)}
            </select>
            <select className="field" value="" onChange={(e) => addService(e.target.value)} aria-label="Add service">
              <option value="">+ Add service…</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
            <button type="button" className="btn btn-secondary" onClick={() => setLines((ls) => [...ls, { key: key(), kind: 'CUSTOM', description: '', quantity: 1, unitPrice: 0 }])}>
              <Plus className="h-4 w-4" /> Custom line
            </button>
          </div>

          <div className="space-y-2">
            {lines.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-ink-400">Add products, services, delivery or labour.</p>}
            {lines.map((l) => (
              <div key={l.key} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-white/[0.06] bg-ink-900/50 p-3 sm:grid-cols-[auto_minmax(0,1fr)_80px_140px_110px_auto]">
                <span className={cn('grid h-8 w-8 place-items-center rounded-lg', l.kind === 'CUSTOM' ? 'bg-white/[0.05] text-ink-300' : 'bg-sun-400/10 text-sun-400')}>
                  {l.kind === 'PRODUCT' ? <Package className="h-4 w-4" /> : l.kind === 'SERVICE' ? <Wrench className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </span>
                <input className="field" value={l.description} placeholder="Description" onChange={(e) => update(l.key, { description: e.target.value })} aria-label="Line description" maxLength={200} />
                <button type="button" className="btn btn-ghost px-2 sm:order-last" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Remove line"><Trash2 className="h-4 w-4" /></button>
                <label className="col-span-1 col-start-2 flex items-center gap-2 text-xs text-ink-400 sm:col-span-1 sm:col-start-auto">
                  <span className="sm:hidden">Qty</span>
                  <input type="number" min={1} className="field px-2 text-center" value={l.quantity} onChange={(e) => update(l.key, { quantity: Math.max(1, Math.round(e.target.valueAsNumber || 1)) })} aria-label="Quantity" />
                </label>
                <label className="col-start-2 flex items-center gap-2 text-xs text-ink-400 sm:col-start-auto">
                  <span className="sm:hidden">Unit ₦</span>
                  <input type="number" min={0} step="any" className="field px-2 text-right" value={l.unitPrice} onChange={(e) => update(l.key, { unitPrice: Math.max(0, e.target.valueAsNumber || 0) })} aria-label="Unit price" />
                </label>
                <span className="col-start-2 text-right text-sm font-semibold text-white sm:col-start-auto">{formatNaira(l.unitPrice * l.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <label className="block">
                <span className="label">Notes for the customer</span>
                <textarea className="field min-h-[90px]" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={3000} placeholder="Lead time, warranty, installation terms, what's excluded…" />
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-300">
                Valid for
                <select className="field w-28 py-1.5" value={validDays} onChange={(e) => setValidDays(Number(e.target.value))}>
                  {[3, 7, 14, 30].map((d) => <option key={d} value={d}>{d} days</option>)}
                </select>
              </label>
            </div>
            <div className="space-y-2 rounded-2xl bg-white/[0.03] p-4 text-sm">
              <Row label="Subtotal" value={formatNaira(totals.subtotal)} />
              <label className="flex items-center justify-between gap-3 text-ink-300">
                Discount (₦)
                <input type="number" min={0} className="field w-36 px-2 py-1.5 text-right" value={discount} onChange={(e) => setDiscount(Math.max(0, e.target.valueAsNumber || 0))} />
              </label>
              <label className="flex items-center justify-between gap-3 text-ink-300">
                <span className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-sun-400" checked={applyVat} onChange={(e) => setApplyVat(e.target.checked)} /> Add VAT (7.5%)</span>
                <span className="text-white">{formatNaira(totals.tax)}</span>
              </label>
              <div className="flex justify-between border-t border-white/[0.08] pt-3 text-base font-extrabold text-white">
                <span>Total</span>
                <span className="text-sun-300">{formatNaira(totals.total)}</span>
              </div>
              <p className="text-[11px] text-ink-400">Only tick VAT if your business is VAT-registered. Final totals are calculated by SOLARIS when you send.</p>
            </div>
          </div>
          {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        </fieldset>

        <footer className="flex flex-col-reverse gap-2 border-t border-white/[0.06] p-4 sm:flex-row sm:justify-end">
          {!quotationId && <button type="button" className="btn btn-ghost" onClick={() => save(false)} disabled={busy || lines.length === 0}>Save draft</button>}
          <button type="button" className="btn btn-primary" onClick={() => save(true)} disabled={busy || lines.length === 0 || lines.some((l) => !l.description.trim())}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {quotationId ? 'Send revised quotation' : 'Send quotation'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-ink-300">
      <span>{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
