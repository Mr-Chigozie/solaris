'use client';

import type { BatteryChemistry, CatalogAppliance, SizingResult, SolarResource } from '@solaris/solar-engine';
import { ChevronDown, Loader2, Printer, Save, SlidersHorizontal, WifiOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/format';
import { ApplianceEditor } from './appliance-editor';
import { DesignResults } from './design-results';
import { DEFAULT_STATE, loadState, saveState, toSizingInput, type CalculatorState } from './model';

type Phase = 'idle' | 'loading' | 'ready' | 'error';

export function Calculator() {
  const router = useRouter();
  const { status } = useAuth();
  const [s, setS] = useState<CalculatorState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [states, setStates] = useState<SolarResource[]>([]);
  const [catalog, setCatalog] = useState<CatalogAppliance[]>([]);
  const [result, setResult] = useState<SizingResult | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [title, setTitle] = useState('My solar design');
  const [saving, setSaving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Restore the last calculation on this device, then load reference data.
  useEffect(() => {
    const saved = loadState();
    if (saved) setS(saved);
    setHydrated(true);
    void api<SolarResource[]>('/locations/states').then((r) => setStates(r.data)).catch(() => undefined);
    void api<CatalogAppliance[]>('/catalog/appliances').then((r) => setCatalog(r.data)).catch(() => undefined);
  }, []);

  const input = useMemo(() => toSizingInput(s), [s]);
  const inputKey = JSON.stringify(input);

  // Debounced live recalculation.
  useEffect(() => {
    if (!hydrated) return;
    saveState(s);
    if (input.appliances.length === 0) {
      setResult(null);
      setPhase('idle');
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setPhase('loading');
      try {
        const r = await api<SizingResult>('/solar/designs/estimate', { method: 'POST', body: input, signal: ctrl.signal });
        setResult(r.data);
        setError(null);
        setPhase('ready');
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof ApiError ? (err.issues[0]?.message ?? err.message) : 'Calculation failed');
        setPhase('error');
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey, hydrated]);

  const set = <K extends keyof CalculatorState>(key: K, value: CalculatorState[K]) => setS((prev) => ({ ...prev, [key]: value }));
  const selected = states.find((x) => x.stateCode === s.state);

  async function save() {
    if (status !== 'authenticated') {
      saveState(s);
      router.push('/register?next=/calculator');
      return;
    }
    setSaving(true);
    try {
      const r = await api<{ id: string }>('/solar/designs', { method: 'POST', body: { ...input, title } });
      router.push(`/designs/${r.data.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save design');
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:py-14">
      {/* Inputs */}
      <div className="min-w-0 space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-volt-400">Solar calculator</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Size your solar system</h1>
          <p className="mt-3 text-ink-300">No account needed. Results update as you type.</p>
        </header>

        <section className="card p-5 sm:p-6" aria-labelledby="where">
          <h2 id="where" className="text-base font-bold text-white">1 · Location & power situation</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="state">State</label>
              <select id="state" className="field" value={s.state} onChange={(e) => set('state', e.target.value)}>
                {states.length === 0 && <option value={s.state}>Loading states…</option>}
                {states.map((x) => (
                  <option key={x.stateCode} value={x.stateCode}>
                    {x.state === 'Federal Capital Territory' ? 'FCT (Abuja)' : x.state}
                  </option>
                ))}
              </select>
              {selected && (
                <p className="mt-1.5 text-xs text-ink-400">
                  ≈ {selected.pshAnnual} peak sun hours/day · {selected.pshWorstMonth} in the worst month
                </p>
              )}
            </div>
            <div>
              <label className="label" htmlFor="city">City / area <span className="text-ink-400">(optional)</span></label>
              <input id="city" className="field" placeholder="e.g. Lekki, Gwarinpa" value={s.city} onChange={(e) => set('city', e.target.value)} maxLength={80} />
            </div>
          </div>

          <div className="mt-5">
            <span className="label">Grid connection</span>
            <Segmented
              value={s.gridAvailable ? 'grid' : 'off'}
              onChange={(v) => set('gridAvailable', v === 'grid')}
              options={[
                ['grid', 'Grid with outages'],
                ['off', 'No grid (off-grid)'],
              ]}
            />
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <div className="flex items-baseline justify-between">
                <label className="label" htmlFor="backup">Backup hours needed</label>
                <span className="text-sm font-bold text-sun-300">{s.backupHours} h</span>
              </div>
              <input id="backup" type="range" min={0} max={24} step={1} value={s.backupHours} onChange={(e) => set('backupHours', Number(e.target.value))} className="w-full accent-sun-400" />
              <p className="mt-1 text-xs text-ink-400">{s.gridAvailable ? 'Typical outage length to ride through.' : 'Night-time energy is always covered off-grid.'}</p>
            </div>
            <div>
              <label className="label" htmlFor="autonomy">Days of autonomy</label>
              <select id="autonomy" className="field" value={s.autonomyDays} onChange={(e) => set('autonomyDays', Number(e.target.value))}>
                {[1, 1.5, 2, 3].map((d) => (
                  <option key={d} value={d}>{d} day{d === 1 ? '' : 's'}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5">
            <span className="label">Battery type</span>
            <Segmented<BatteryChemistry>
              value={s.batteryChemistry}
              onChange={(v) => set('batteryChemistry', v)}
              options={[
                ['LIFEPO4', 'Lithium (LiFePO4)'],
                ['LEAD_ACID_TUBULAR', 'Tubular'],
                ['LEAD_ACID_AGM', 'AGM / gel'],
              ]}
            />
          </div>
        </section>

        <section className="card p-5 sm:p-6" aria-labelledby="appliances">
          <h2 id="appliances" className="mb-4 text-base font-bold text-white">2 · What do you want to power?</h2>
          <ApplianceEditor rows={s.appliances} catalog={catalog} onChange={(rows) => set('appliances', rows)} />
        </section>

        <section className="card overflow-hidden">
          <button type="button" className="flex w-full items-center justify-between p-5 text-left sm:px-6" onClick={() => setShowAdvanced((o) => !o)} aria-expanded={showAdvanced}>
            <span className="flex items-center gap-2 text-base font-bold text-white"><SlidersHorizontal className="h-4 w-4 text-ink-300" /> 3 · Engineering assumptions</span>
            <ChevronDown className={cn('h-5 w-5 text-ink-400 transition', showAdvanced && 'rotate-180')} />
          </button>
          {showAdvanced && (
            <div className="grid gap-4 border-t border-white/[0.06] p-5 sm:grid-cols-2 sm:px-6">
              <div className="sm:col-span-2">
                <span className="label">Size the array for</span>
                <Segmented
                  value={s.advanced.solarDesignBasis}
                  onChange={(v) => set('advanced', { ...s.advanced, solarDesignBasis: v })}
                  options={[
                    ['ANNUAL_AVERAGE', 'Annual average sun'],
                    ['WORST_MONTH', 'Worst month (bigger, more reliable)'],
                  ]}
                />
              </div>
              <div>
                <label className="label" htmlFor="psh">Peak sun hours override</label>
                <input
                  id="psh"
                  type="number"
                  step={0.1}
                  min={1}
                  max={8}
                  className="field"
                  placeholder={selected ? `Location default: ${s.advanced.solarDesignBasis === 'WORST_MONTH' ? selected.pshWorstMonth : selected.pshAnnual}` : 'Location default'}
                  value={s.advanced.peakSunHours ?? ''}
                  onChange={(e) => {
                    const v = e.target.valueAsNumber;
                    set('advanced', { ...s.advanced, peakSunHours: Number.isFinite(v) && v >= 1 && v <= 8 ? v : undefined });
                  }}
                />
              </div>
              <div>
                <label className="label" htmlFor="panel">Panel size</label>
                <select id="panel" className="field" value={s.advanced.panelWatts} onChange={(e) => set('advanced', { ...s.advanced, panelWatts: Number(e.target.value) })}>
                  {[300, 400, 450, 550, 600, 650].map((w) => <option key={w} value={w}>{w} W</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <div className="flex items-baseline justify-between">
                  <label className="label" htmlFor="derate">System losses (heat, dust, wiring)</label>
                  <span className="text-sm font-bold text-ink-100">{Math.round((1 - s.advanced.solarDerating) * 100)}%</span>
                </div>
                <input id="derate" type="range" min={0.6} max={0.95} step={0.01} value={s.advanced.solarDerating} onChange={(e) => set('advanced', { ...s.advanced, solarDerating: Number(e.target.value) })} className="w-full accent-volt-400" />
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Results */}
      <div className="min-w-0 lg:sticky lg:top-20 lg:self-start" id="results">
        <div className="no-print mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input className="field sm:max-w-xs" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Design name" maxLength={120} />
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={!result || saving} className="btn btn-primary flex-1 sm:flex-none">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {status === 'authenticated' ? 'Save design' : 'Sign up to save'}
            </button>
            <button type="button" onClick={() => window.print()} disabled={!result} className="btn btn-secondary" aria-label="Print or save as PDF">
              <Printer className="h-4 w-4" />
            </button>
          </div>
        </div>

        {phase === 'error' && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {result ? (
          <DesignResults result={result} busy={phase === 'loading'} />
        ) : (
          <div className="card grid min-h-[320px] place-items-center p-8 text-center text-ink-400">
            {phase === 'loading' ? <Loader2 className="h-6 w-6 animate-spin" /> : <p>Add at least one appliance to see your system.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<[T, string]> }) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl border border-white/[0.07] bg-ink-900/70 p-1" role="radiogroup">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn('rounded-xl px-2 py-2 text-xs font-semibold transition sm:text-sm', value === v ? 'bg-white text-ink-950 shadow' : 'text-ink-300 hover:text-white')}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
