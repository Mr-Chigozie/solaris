'use client';

import { SERVICE_CATEGORIES, SERVICE_CATEGORY_LABEL } from '@solaris/validation';
import { Archive, Loader2, Pencil, Plus, Wrench, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useWorkspace } from '@/features/business/workspace-context';
import { servicePrice, type ServiceCategory, type ServiceData } from '@/features/marketplace/types';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/format';

type Draft = { id?: string; title: string; category: ServiceCategory; description: string; priceType: 'FIXED' | 'FROM' | 'ON_QUOTE'; price: number | null; status: 'DRAFT' | 'PUBLISHED' };
const EMPTY: Draft = { title: '', category: 'INSTALLATION', description: '', priceType: 'ON_QUOTE', price: null, status: 'PUBLISHED' };

export default function BusinessServicesPage() {
  const { ws, reload: reloadWs } = useWorkspace();
  const orgId = ws.organization.id;
  const [items, setItems] = useState<ServiceData[] | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<ServiceData[]>(`/organizations/${orgId}/services`).then((r) => setItems(r.data)).catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load services'));
  }, [orgId]);
  useEffect(load, [load]);

  async function save() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    const { id, ...body } = editing;
    const payload = { ...body, description: body.description || undefined, price: body.priceType === 'ON_QUOTE' ? null : body.price };
    try {
      if (id) await api(`/organizations/${orgId}/services/${id}`, { method: 'PATCH', body: { ...payload, description: body.description } });
      else await api(`/organizations/${orgId}/services`, { method: 'POST', body: payload });
      setEditing(null);
      load();
      reloadWs();
    } catch (e) {
      setError(e instanceof ApiError ? (e.issues[0]?.message ?? e.message) : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function archive(s: ServiceData) {
    if (!window.confirm(`Archive “${s.title}”?`)) return;
    await api(`/organizations/${orgId}/services/${s.id}`, { method: 'DELETE' }).catch(() => undefined);
    load();
    reloadWs();
  }

  return (
    <div className="space-y-6">
      <section className="card p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Services</h2>
            <p className="mt-1 text-sm text-ink-400">What you offer: surveys, installation, maintenance, repairs. Customers can message you about any service.</p>
          </div>
          {ws.can.MANAGE_SERVICES && !editing && <button type="button" onClick={() => setEditing({ ...EMPTY })} className="btn btn-primary self-start"><Plus className="h-4 w-4" /> Add service</button>}
        </div>

        {editing && (
          <fieldset disabled={busy} className="mt-6 grid gap-4 rounded-2xl border border-sun-400/30 bg-sun-400/[0.04] p-5 sm:grid-cols-2">
            <div className="flex items-center justify-between sm:col-span-2">
              <h3 className="font-bold text-white">{editing.id ? 'Edit service' : 'New service'}</h3>
              <button type="button" className="btn btn-ghost px-2" onClick={() => setEditing(null)} aria-label="Cancel"><X className="h-4 w-4" /></button>
            </div>
            <label className="sm:col-span-2"><span className="label">Title</span><input className="field" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} maxLength={140} placeholder="e.g. 5 kVA hybrid system installation" /></label>
            <label>
              <span className="label">Category</span>
              <select className="field" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as ServiceCategory })}>
                {SERVICE_CATEGORIES.map((c) => <option key={c} value={c}>{SERVICE_CATEGORY_LABEL[c]}</option>)}
              </select>
            </label>
            <label>
              <span className="label">Pricing</span>
              <select className="field" value={editing.priceType} onChange={(e) => setEditing({ ...editing, priceType: e.target.value as Draft['priceType'] })}>
                <option value="ON_QUOTE">Price on quote</option>
                <option value="FROM">Starting from</option>
                <option value="FIXED">Fixed price</option>
              </select>
            </label>
            {editing.priceType !== 'ON_QUOTE' && (
              <label><span className="label">Price (₦)</span><input className="field" type="number" min={0} value={editing.price ?? ''} onChange={(e) => setEditing({ ...editing, price: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : null })} /></label>
            )}
            <label className="sm:col-span-2"><span className="label">Description</span><textarea className="field min-h-[110px]" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} maxLength={5000} placeholder="What's included, typical timeline, coverage area, warranty on workmanship…" /></label>
            <label className="flex items-center gap-2 text-sm text-ink-300 sm:col-span-2">
              <input type="checkbox" className="h-4 w-4 accent-sun-400" checked={editing.status === 'PUBLISHED'} onChange={(e) => setEditing({ ...editing, status: e.target.checked ? 'PUBLISHED' : 'DRAFT' })} />
              Publish (visible once your business is verified)
            </label>
            {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-200 sm:col-span-2">{error}</p>}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={editing.title.trim().length < 2}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save service</button>
            </div>
          </fieldset>
        )}

        {items === null && <div className="grid h-32 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-ink-400" /></div>}
        {items?.length === 0 && !editing && (
          <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-10 text-center">
            <Wrench className="mx-auto h-8 w-8 text-ink-400" />
            <p className="mt-3 text-ink-300">No services yet.</p>
          </div>
        )}
        <div className="mt-5 divide-y divide-white/[0.06]">
          {items?.map((s) => (
            <div key={s.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">{s.title}</p>
                <p className="text-xs text-ink-400">
                  {SERVICE_CATEGORY_LABEL[s.category]} · {servicePrice(s)}
                  <span className={cn('ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', s.status === 'PUBLISHED' ? 'bg-volt-500/15 text-volt-300' : 'bg-white/[0.06] text-ink-400')}>{s.status === 'PUBLISHED' ? 'Live' : 'Draft'}</span>
                </p>
              </div>
              {ws.can.MANAGE_SERVICES && (
                <div className="flex gap-2">
                  <button type="button" className="btn btn-secondary px-3 py-2" onClick={() => setEditing({ id: s.id, title: s.title, category: s.category, description: s.description ?? '', priceType: s.priceType, price: s.price, status: s.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT' })}><Pencil className="h-4 w-4" /> Edit</button>
                  <button type="button" className="btn btn-ghost px-2.5" onClick={() => archive(s)} aria-label="Archive"><Archive className="h-4 w-4" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
