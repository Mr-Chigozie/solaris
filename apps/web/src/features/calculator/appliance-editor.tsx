'use client';

import type { CatalogAppliance } from '@solaris/solar-engine';
import { Moon, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn, formatNumber } from '@/lib/format';
import { CATEGORY_LABELS, isRowValid, newKey, rowFromCatalog, type ApplianceRow } from './model';

interface Props {
  rows: ApplianceRow[];
  catalog: CatalogAppliance[];
  onChange: (rows: ApplianceRow[]) => void;
}

export function ApplianceEditor({ rows, catalog, onChange }: Props) {
  const [category, setCategory] = useState<string>('ALL');
  const [query, setQuery] = useState('');

  const categories = useMemo(() => ['ALL', ...new Set(catalog.map((a) => a.category))], [catalog]);
  const visible = useMemo(
    () =>
      catalog.filter(
        (a) => (category === 'ALL' || a.category === category) && a.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [catalog, category, query],
  );

  const update = (key: string, patch: Partial<ApplianceRow>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const add = (a: CatalogAppliance) => {
    const existing = rows.find((r) => r.catalogId === a.id);
    if (existing) update(existing.key, { quantity: existing.quantity + 1 });
    else onChange([...rows, rowFromCatalog(a)]);
  };

  const addCustom = () =>
    onChange([...rows, { key: newKey(), name: '', quantity: 1, watts: 100, hoursPerDay: 4, simultaneousUse: true }]);

  const totalKwh = rows.filter(isRowValid).reduce((s, r) => s + (r.watts * r.quantity * r.hoursPerDay) / 1000, 0);

  return (
    <div>
      {/* Quick add */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            className="field pl-9"
            placeholder="Search appliances (e.g. freezer, pump, AC)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search appliance catalogue"
          />
        </div>
        <button type="button" onClick={addCustom} className="btn btn-secondary shrink-0">
          <Plus className="h-4 w-4" /> Custom appliance
        </button>
      </div>

      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition',
              category === c ? 'bg-white text-ink-950' : 'bg-white/[0.05] text-ink-300 hover:bg-white/[0.09]',
            )}
          >
            {c === 'ALL' ? 'All' : CATEGORY_LABELS[c] ?? c}
          </button>
        ))}
      </div>

      <div className="mt-3 flex max-h-[7.5rem] flex-wrap gap-2 overflow-y-auto pr-1">
        {visible.map((a) => {
          const count = rows.find((r) => r.catalogId === a.id)?.quantity;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => add(a)}
              title={a.note}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition',
                count ? 'border-sun-400/40 bg-sun-400/10 text-sun-200' : 'border-white/10 bg-white/[0.03] text-ink-300 hover:border-white/20 hover:text-white',
              )}
            >
              <Plus className="h-3 w-3" /> {a.name}
              <span className="text-ink-400">{a.defaultWatts} W</span>
              {count ? <span className="rounded-full bg-sun-400 px-1.5 text-[10px] font-bold text-ink-950">{count}</span> : null}
            </button>
          );
        })}
        {visible.length === 0 && <p className="text-xs text-ink-400">No match — add it as a custom appliance.</p>}
      </div>

      {/* Rows */}
      <div className="mt-6 hidden grid-cols-[minmax(0,1fr)_64px_84px_72px_72px_64px_36px] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400 md:grid">
        <span>Appliance</span>
        <span>Qty</span>
        <span>Watts</span>
        <span>Hrs/day</span>
        <span className="flex items-center gap-1"><Moon className="h-3 w-3" /> Night</span>
        <span className="text-right">kWh</span>
        <span />
      </div>

      <ul className="mt-2 space-y-2">
        {rows.map((r) => {
          const valid = isRowValid(r);
          const kwh = (r.watts * r.quantity * r.hoursPerDay) / 1000;
          return (
            <li
              key={r.key}
              className={cn(
                'grid grid-cols-[repeat(6,minmax(0,1fr))] gap-2 rounded-2xl border bg-ink-900/50 p-3 md:grid-cols-[minmax(0,1fr)_64px_84px_72px_72px_64px_36px] md:items-center md:border-transparent md:bg-transparent md:p-1',
                valid ? 'border-white/[0.06]' : 'border-red-400/40',
              )}
            >
              <input
                className="field col-span-5 md:col-span-1"
                value={r.name}
                placeholder="Appliance name"
                onChange={(e) => update(r.key, { name: e.target.value })}
                aria-label="Appliance name"
              />
              <button type="button" onClick={() => onChange(rows.filter((x) => x.key !== r.key))} className="btn btn-ghost col-start-6 row-start-1 px-0 md:order-last md:col-start-auto md:row-start-auto" aria-label={`Remove ${r.name || 'appliance'}`}>
                <Trash2 className="h-4 w-4" />
              </button>
              <NumberCell label="Qty" value={r.quantity} min={1} step={1} onChange={(v) => update(r.key, { quantity: Math.round(v) })} />
              <NumberCell label="Watts" value={r.watts} min={1} step={5} onChange={(v) => update(r.key, { watts: v })} />
              <NumberCell label="Hrs/day" value={r.hoursPerDay} min={0.1} max={24} step={0.5} onChange={(v) => update(r.key, { hoursPerDay: v, ...(r.nightHoursPerDay !== undefined && r.nightHoursPerDay > v ? { nightHoursPerDay: v } : {}) })} />
              <NumberCell label="Night hrs" value={r.nightHoursPerDay ?? ''} min={0} max={r.hoursPerDay} step={0.5} onChange={(v) => update(r.key, { nightHoursPerDay: v })} />
              <div className="col-span-2 flex items-center justify-end text-sm font-semibold text-white md:col-span-1 md:order-none">
                <span className="mr-1 text-xs font-normal text-ink-400 md:hidden">Daily</span>
                {formatNumber(kwh, 2)}
              </div>
            </li>
          );
        })}
      </ul>

      {rows.length === 0 && (
        <p className="mt-4 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-ink-400">Add the appliances you want to power.</p>
      )}

      <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3 text-sm">
        <span className="text-ink-300">{rows.length} appliance{rows.length === 1 ? '' : 's'}</span>
        <span className="font-semibold text-white">{formatNumber(totalKwh, 2)} kWh / day</span>
      </div>
    </div>
  );
}

function NumberCell({ label, value, min, max, step, onChange }: { label: string; value: number | ''; min?: number; max?: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label className="col-span-2 md:col-span-1">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-ink-400 md:hidden">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        className="field px-2.5 text-center"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        onChange={(e) => {
          const v = e.target.valueAsNumber;
          onChange(Number.isFinite(v) ? v : 0);
        }}
      />
    </label>
  );
}
