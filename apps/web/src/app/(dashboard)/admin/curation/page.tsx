'use client';

import { Eye, EyeOff, Loader2, Plus, Search, Star } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { SectionTabs } from '@/features/admin/section-tabs';
import { SettingsEditor, Toggle } from '@/features/admin/settings-editor';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/format';

export default function AdminCurationPage() {
  const [active, setActive] = useState('businesses');
  return (
    <div>
      <SectionTabs
        items={[['businesses', 'Businesses'], ['appliances', 'Appliance catalogue'], ['pricing', 'Reference prices']]}
        active={active}
        onChange={setActive}
      />
      {active === 'businesses' && <Businesses />}
      {active === 'appliances' && <Appliances />}
      {active === 'pricing' && (
        <SettingsEditor
          settingKey="pricing"
          title="Reference prices"
          description="Unit prices the calculator uses for cost estimates until designs are matched to real marketplace listings. Fractions are 0–1 (0.12 = 12%). Every saved design keeps the prices it was calculated with."
        />
      )}
    </div>
  );
}

/* ───────────────────────────── businesses */

interface Org {
  id: string;
  name: string;
  types: string[];
  verification: string;
  isPlatformOwned: boolean;
  isFeatured: boolean;
  hiddenAt: string | null;
  hiddenReason: string | null;
  state: string | null;
}

function Businesses() {
  const [q, setQ] = useState('');
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Org[]>(`/admin/organizations?pageSize=100${q ? `&q=${encodeURIComponent(q)}` : ''}`)
      .then((r) => setOrgs(r.data))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load businesses'));
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function curate(o: Org, body: Record<string, unknown>) {
    setBusy(o.id);
    try {
      await api(`/admin/organizations/${o.id}/curation`, { method: 'PATCH', body });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Update failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Business visibility</h2>
          <p className="mt-1 text-sm text-ink-400">Featured businesses get priority placement. Hidden businesses are removed from public listings but keep their accounts.</p>
        </div>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input className="field pl-9" placeholder="Search businesses" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      <div className="mt-5 divide-y divide-white/[0.06]">
        {orgs === null && <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-ink-400" /></div>}
        {orgs?.length === 0 && <p className="py-10 text-center text-sm text-ink-400">No businesses found.</p>}
        {orgs?.map((o) => (
          <div key={o.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-center">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-bold text-white">
                {o.name}
                {o.isPlatformOwned && <span className="rounded-full bg-sun-400/15 px-2 py-0.5 text-[10px] font-semibold text-sun-200">OFFICIAL</span>}
                {o.hiddenAt && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-200">HIDDEN</span>}
              </p>
              <p className="mt-0.5 text-xs text-ink-400">
                {o.types.join(' + ').toLowerCase()} · {o.verification.toLowerCase()} · {o.state ?? 'state not set'}
                {o.hiddenReason ? ` · hidden: ${o.hiddenReason}` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={busy === o.id} onClick={() => curate(o, { isFeatured: !o.isFeatured })} className={cn('btn px-4 py-2', o.isFeatured ? 'bg-sun-400/15 text-sun-200' : 'btn-secondary')}>
                <Star className={cn('h-4 w-4', o.isFeatured && 'fill-current')} /> {o.isFeatured ? 'Featured' : 'Feature'}
              </button>
              <button
                type="button"
                disabled={busy === o.id || o.isPlatformOwned}
                onClick={() => {
                  if (o.hiddenAt) return curate(o, { hidden: false });
                  const reason = window.prompt('Reason for hiding (recorded in the audit log):');
                  if (reason !== null) void curate(o, { hidden: true, hiddenReason: reason });
                }}
                className="btn btn-secondary px-4 py-2"
              >
                {o.hiddenAt ? <><Eye className="h-4 w-4" /> Unhide</> : <><EyeOff className="h-4 w-4" /> Hide</>}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────────── appliance catalogue */

interface Appliance {
  id: string;
  name: string;
  category: string;
  defaultWatts: number;
  surgeFactor: number;
  typicalHoursPerDay: number;
  typicalNightFraction: number;
  note: string | null;
  isActive: boolean;
  sortOrder: number;
}

const CATEGORIES = ['LIGHTING', 'COOLING', 'REFRIGERATION', 'ENTERTAINMENT', 'OFFICE', 'KITCHEN', 'LAUNDRY', 'WATER', 'SECURITY', 'OTHER'];
const BLANK = { id: '', name: '', category: 'OTHER', defaultWatts: 100, surgeFactor: 1, typicalHoursPerDay: 4, typicalNightFraction: 0.5 };

function Appliances() {
  const [items, setItems] = useState<Appliance[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<typeof BLANK | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Appliance[]>('/admin/appliances').then((r) => setItems(r.data)).catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load'));
  }, []);
  useEffect(load, [load]);

  async function patch(id: string, body: Partial<Appliance>) {
    setSaving(id);
    setError(null);
    try {
      const r = await api<Appliance>(`/admin/appliances/${id}`, { method: 'PATCH', body });
      setItems((list) => list?.map((a) => (a.id === id ? r.data : a)) ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? (e.issues[0]?.message ?? e.message) : 'Update failed');
      load();
    } finally {
      setSaving(null);
    }
  }

  async function create() {
    if (!adding) return;
    setSaving('new');
    setError(null);
    try {
      await api('/admin/appliances', { method: 'POST', body: adding });
      setAdding(null);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? (e.issues.map((i) => `${i.path}: ${i.message}`).join(' · ') || e.message) : 'Create failed');
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Appliance catalogue</h2>
          <p className="mt-1 text-sm text-ink-400">What visitors can quick-add in the calculator. Surge factor drives inverter sizing for motors and compressors (≈3 for fridges, ACs, pumps).</p>
        </div>
        <button type="button" onClick={() => setAdding({ ...BLANK })} className="btn btn-primary shrink-0"><Plus className="h-4 w-4" /> Add appliance</button>
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

      {adding && (
        <div className="mt-5 grid gap-3 rounded-2xl border border-sun-400/30 bg-sun-400/[0.04] p-4 sm:grid-cols-3 lg:grid-cols-7">
          <Labeled label="ID (slug)"><input className="field" value={adding.id} onChange={(e) => setAdding({ ...adding, id: e.target.value.toLowerCase() })} placeholder="borehole-pump" /></Labeled>
          <Labeled label="Name" className="sm:col-span-2"><input className="field" value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} /></Labeled>
          <Labeled label="Category">
            <select className="field" value={adding.category} onChange={(e) => setAdding({ ...adding, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Labeled>
          <Labeled label="Watts"><input type="number" className="field" value={adding.defaultWatts} onChange={(e) => setAdding({ ...adding, defaultWatts: e.target.valueAsNumber })} /></Labeled>
          <Labeled label="Surge ×"><input type="number" step="0.5" className="field" value={adding.surgeFactor} onChange={(e) => setAdding({ ...adding, surgeFactor: e.target.valueAsNumber })} /></Labeled>
          <Labeled label="Hours/day"><input type="number" step="0.5" className="field" value={adding.typicalHoursPerDay} onChange={(e) => setAdding({ ...adding, typicalHoursPerDay: e.target.valueAsNumber })} /></Labeled>
          <div className="flex gap-2 sm:col-span-3 lg:col-span-7 lg:justify-end">
            <button type="button" className="btn btn-ghost" onClick={() => setAdding(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={create} disabled={saving === 'new'}>{saving === 'new' && <Loader2 className="h-4 w-4 animate-spin" />} Create</button>
          </div>
        </div>
      )}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-ink-400">
            <tr>
              <th className="py-2 pr-3 font-semibold">Appliance</th>
              <th className="py-2 pr-3 font-semibold">Category</th>
              <th className="w-24 py-2 pr-3 font-semibold">Watts</th>
              <th className="w-24 py-2 pr-3 font-semibold">Surge ×</th>
              <th className="w-24 py-2 pr-3 font-semibold">Hrs/day</th>
              <th className="w-20 py-2 font-semibold">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {items === null && <tr><td colSpan={6} className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-ink-400" /></td></tr>}
            {items?.map((a) => (
              <tr key={a.id} className={cn(!a.isActive && 'opacity-50')}>
                <td className="py-2 pr-3">
                  <div className="font-medium text-white">{a.name}</div>
                  <div className="font-mono text-[11px] text-ink-400">{a.id}</div>
                </td>
                <td className="py-2 pr-3 text-xs text-ink-300">{a.category}</td>
                <td className="py-2 pr-3"><NumberCommit value={a.defaultWatts} onCommit={(v) => patch(a.id, { defaultWatts: v })} /></td>
                <td className="py-2 pr-3"><NumberCommit value={a.surgeFactor} step={0.5} onCommit={(v) => patch(a.id, { surgeFactor: v })} /></td>
                <td className="py-2 pr-3"><NumberCommit value={a.typicalHoursPerDay} step={0.5} onCommit={(v) => patch(a.id, { typicalHoursPerDay: v })} /></td>
                <td className="py-2">
                  {saving === a.id ? <Loader2 className="h-4 w-4 animate-spin text-ink-400" /> : <Toggle checked={a.isActive} label={`${a.name} active`} onChange={(v) => patch(a.id, { isActive: v })} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Saves on blur / Enter, so typing doesn't fire a request per keystroke. */
function NumberCommit({ value, step = 1, onCommit }: { value: number; step?: number; onCommit: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  const commit = () => {
    const n = Number(v);
    if (Number.isFinite(n) && n !== value) onCommit(n);
    else setV(String(value));
  };
  return (
    <input
      type="number"
      step={step}
      className="field px-2.5 py-1.5"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

function Labeled({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={className}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
