'use client';

import { DEFAULT_SITE_SETTINGS, FONT_CHOICES, type SiteSettingKey } from '@solaris/validation';
import { History, Loader2, Lock, Minus, Plus, RotateCcw, Save, Undo2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { cn, formatDate } from '@/lib/format';
import { ADMIN_ROLE_LABEL, type AdminRole } from './use-admin';

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

interface SettingRow {
  key: SiteSettingKey;
  value: Json;
  version: number;
  updatedAt: string | null;
  editorRole: AdminRole;
  canEdit: boolean;
}

interface Revision {
  id: string;
  version: number;
  note: string | null;
  createdAt: string;
  author: { firstName: string; lastName: string; email: string } | null;
}

/* ───────────────────────────── field presentation hints */

const LABELS: Record<string, string> = {
  titleLine1: 'Headline (first line)',
  titleHighlight: 'Headline (highlighted line)',
  primaryCtaLabel: 'Primary button label',
  secondaryCtaLabel: 'Secondary button label',
  ctaLabel: 'Link label',
  linkUrl: 'Link URL',
  ogImageUrl: 'Social share image URL',
  logoUrl: 'Logo image URL (leave empty for the default mark)',
  allowIndexing: 'Allow search engines to index the site',
  consumerRegistration: 'Customer sign-up',
  installerRegistration: 'Installer sign-up',
  vendorRegistration: 'Vendor sign-up',
  installerDirectory: 'Installer directory',
  demoMonitoring: 'Demo monitoring card on dashboards',
  maintenanceMode: 'Maintenance mode (public sees a maintenance page)',
  pricesReviewed: 'Prices last reviewed (YYYY-MM)',
  panelPricePerWatt: 'Solar panel price per watt (₦)',
  batteryPricePerKwh: 'Battery price per kWh (₦)',
  LIFEPO4: 'Lithium (LiFePO4)',
  LEAD_ACID_AGM: 'AGM / gel',
  LEAD_ACID_TUBULAR: 'Tubular',
  inverterPricePerKva: 'Inverter price per kVA (₦)',
  balanceOfSystemFraction: 'Cables, protection & mounting (fraction of equipment)',
  installationFraction: 'Installation labour (fraction)',
  logisticsFlat: 'Logistics flat fee (₦)',
  contingencyFraction: 'Contingency (fraction)',
};
const LONG_TEXT = new Set(['subtitle', 'body', 'description', 'about', 'disclaimer', 'message', 'maintenanceMessage']);
const GROWABLE = new Set(['keywords', 'points']);
const OPTIONS: Record<string, readonly string[]> = {
  font: FONT_CHOICES,
  cornerStyle: ['rounded', 'soft', 'sharp'],
  tone: ['info', 'success', 'warning'],
};

const humanize = (key: string) =>
  LABELS[key] ?? key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

function setIn(obj: Json, path: (string | number)[], value: Json): Json {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  if (Array.isArray(obj)) {
    const copy = [...obj];
    copy[head as number] = setIn(copy[head as number] ?? null, rest, value);
    return copy;
  }
  const o = (obj ?? {}) as Record<string, Json>;
  return { ...o, [head as string]: setIn(o[head as string] ?? null, rest, value) };
}

/* ───────────────────────────── data hook */

export function useSetting(key: SiteSettingKey) {
  const [row, setRow] = useState<SettingRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api<SettingRow[]>('/admin/settings')
      .then((r) => setRow(r.data.find((s) => s.key === key) ?? null))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load settings'));
  }, [key]);
  useEffect(load, [load]);
  return { row, error, reload: load };
}

/* ───────────────────────────── editor */

interface EditorProps {
  settingKey: SiteSettingKey;
  title: string;
  description: string;
  /** Optional live preview of the unsaved draft. */
  preview?: (draft: Json) => React.ReactNode;
}

export function SettingsEditor({ settingKey, title, description, preview }: EditorProps) {
  const router = useRouter();
  const { row, error: loadError, reload } = useSetting(settingKey);
  const [draft, setDraft] = useState<Json | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'save' | 'reset' | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (row) setDraft(row.value);
  }, [row]);

  const dirty = useMemo(() => row !== null && JSON.stringify(row.value) !== JSON.stringify(draft), [row, draft]);
  const readOnly = !row?.canEdit;

  async function save() {
    setBusy('save');
    setErrors({});
    setMessage(null);
    try {
      await api(`/admin/settings/${settingKey}`, { method: 'PUT', body: { value: draft, ...(note.trim() ? { note: note.trim() } : {}) } });
      setNote('');
      setMessage({ tone: 'ok', text: 'Saved and published. The live site updates within a few seconds.' });
      reload();
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.issues.length) {
        setErrors(e.fieldErrors());
        setMessage({ tone: 'error', text: 'Some fields need attention.' });
      } else setMessage({ tone: 'error', text: e instanceof ApiError ? e.message : 'Save failed' });
    } finally {
      setBusy(null);
    }
  }

  async function resetToDefaults() {
    if (!window.confirm('Reset this section to the built-in defaults? The current version stays in history.')) return;
    setBusy('reset');
    try {
      await api(`/admin/settings/${settingKey}/reset`, { method: 'POST' });
      setMessage({ tone: 'ok', text: 'Reset to defaults.' });
      reload();
      router.refresh();
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof ApiError ? e.message : 'Reset failed' });
    } finally {
      setBusy(null);
    }
  }

  if (loadError) return <p className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-200">{loadError}</p>;
  if (!row || draft === null) return <div className="card grid h-48 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-ink-400" /></div>;

  return (
    <div className={cn('grid gap-6', preview && 'xl:grid-cols-[minmax(0,1fr)_380px]')}>
      <section className="card min-w-0 p-5 sm:p-6">
        <header className="flex flex-col gap-3 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <p className="mt-1 text-sm text-ink-400">{description}</p>
            <p className="mt-2 text-xs text-ink-400">
              {row.version > 0 ? `Version ${row.version}${row.updatedAt ? ` · updated ${formatDate(row.updatedAt)}` : ''}` : 'Using built-in defaults'}
            </p>
          </div>
          <button type="button" onClick={() => setShowHistory(true)} className="btn btn-secondary shrink-0 self-start px-4 py-2">
            <History className="h-4 w-4" /> History
          </button>
        </header>

        {readOnly && (
          <p className="mt-5 flex items-center gap-2 rounded-xl bg-white/[0.04] p-3 text-sm text-ink-300">
            <Lock className="h-4 w-4" /> Read-only. Editing requires the {ADMIN_ROLE_LABEL[row.editorRole].label} role.
          </p>
        )}

        <fieldset disabled={readOnly || busy !== null} className="mt-5 space-y-5">
          <FieldNode value={draft} path={[]} errors={errors} onChange={(path, v) => setDraft((d) => setIn(d as Json, path, v))} />
        </fieldset>

        {!readOnly && (
          <footer className="sticky bottom-24 mt-8 flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-ink-850/95 p-3 backdrop-blur lg:bottom-4 sm:flex-row sm:items-center">
            <input className="field flex-1" placeholder="What changed? (optional, shown in history)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setDraft(row.value)} disabled={!dirty || busy !== null} className="btn btn-ghost px-3" title="Discard changes">
                <Undo2 className="h-4 w-4" />
              </button>
              <button type="button" onClick={resetToDefaults} disabled={busy !== null} className="btn btn-ghost px-3" title="Reset to defaults">
                {busy === 'reset' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              </button>
              <button type="button" onClick={save} disabled={!dirty || busy !== null} className="btn btn-primary">
                {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Publish
              </button>
            </div>
          </footer>
        )}
        {message && (
          <p role="status" className={cn('mt-4 rounded-xl p-3 text-sm', message.tone === 'ok' ? 'bg-volt-500/10 text-volt-200' : 'bg-red-500/10 text-red-200')}>{message.text}</p>
        )}
      </section>

      {preview && <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start">{preview(draft)}</aside>}

      {showHistory && (
        <HistoryDrawer
          settingKey={settingKey}
          canRestore={!readOnly}
          onClose={() => setShowHistory(false)}
          onRestored={() => {
            setShowHistory(false);
            setMessage({ tone: 'ok', text: 'Version restored and published.' });
            reload();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/* ───────────────────────────── recursive field renderer */

function FieldNode({ value, path, errors, onChange, label }: { value: Json; path: (string | number)[]; errors: Record<string, string>; onChange: (path: (string | number)[], v: Json) => void; label?: string }) {
  const key = String(path[path.length - 1] ?? '');
  const err = errors[path.join('.')];

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value);
    const body = entries.map(([k, v]) => <FieldNode key={k} value={v} path={[...path, k]} errors={errors} onChange={onChange} />);
    if (path.length === 0) return <>{body}</>;
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="mb-4 text-xs font-bold uppercase tracking-wider text-ink-300">{label ?? humanize(key)}</p>
        <div className="space-y-4">{body}</div>
      </div>
    );
  }

  if (Array.isArray(value)) {
    const growable = GROWABLE.has(key);
    const isPrimitive = value.every((v) => typeof v !== 'object' || v === null);
    if (!isPrimitive) {
      return (
        <div>
          <p className="label">{humanize(key)}</p>
          <div className="grid gap-3 md:grid-cols-2">
            {value.map((item, i) => (
              <FieldNode key={i} value={item} path={[...path, i]} errors={errors} onChange={onChange} label={`${humanize(key).replace(/s$/, '')} ${i + 1}`} />
            ))}
          </div>
        </div>
      );
    }
    return (
      <div>
        <p className="label">{humanize(key)}</p>
        <div className="space-y-2">
          {value.map((item, i) => (
            <div key={i} className="flex gap-2">
              <input className="field" value={String(item ?? '')} onChange={(e) => onChange([...path, i], e.target.value)} aria-label={`${humanize(key)} ${i + 1}`} />
              {growable && (
                <button type="button" className="btn btn-ghost px-2.5" aria-label="Remove" onClick={() => onChange(path, value.filter((_, j) => j !== i))}>
                  <Minus className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {growable && (
            <button type="button" className="btn btn-ghost px-3 py-1.5 text-xs" onClick={() => onChange(path, [...value, ''])}>
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          )}
        </div>
        {err && <p className="mt-1 text-xs text-red-300">{err}</p>}
      </div>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-white/[0.03] px-4 py-3">
        <span className="text-sm text-ink-100">{humanize(key)}</span>
        <Toggle checked={value} onChange={(v) => onChange(path, v)} />
      </label>
    );
  }

  if (typeof value === 'number') {
    return (
      <div>
        <label className="label">{humanize(key)}</label>
        <input type="number" step="any" className="field" value={Number.isFinite(value) ? value : ''} onChange={(e) => onChange(path, e.target.valueAsNumber)} />
        {err && <p className="mt-1 text-xs text-red-300">{err}</p>}
      </div>
    );
  }

  const str = String(value ?? '');
  const options = OPTIONS[key];
  return (
    <div>
      <label className="label">{humanize(key)}</label>
      {options ? (
        <select className="field" value={str} onChange={(e) => onChange(path, e.target.value)}>
          {options.map((o) => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
        </select>
      ) : /Color$/.test(key) ? (
        <div className="flex gap-2">
          <input type="color" className="h-11 w-14 cursor-pointer rounded-lg border border-white/10 bg-transparent" value={/^#[0-9a-fA-F]{6}$/.test(str) ? str : '#000000'} onChange={(e) => onChange(path, e.target.value.toUpperCase())} aria-label={`${humanize(key)} picker`} />
          <input className="field font-mono uppercase" value={str} onChange={(e) => onChange(path, e.target.value)} maxLength={7} />
        </div>
      ) : LONG_TEXT.has(key) ? (
        <textarea className="field min-h-[88px] resize-y" value={str} onChange={(e) => onChange(path, e.target.value)} />
      ) : (
        <input className="field" value={str} onChange={(e) => onChange(path, e.target.value)} />
      )}
      {err && <p className="mt-1 text-xs text-red-300">{err}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-volt-500' : 'bg-white/15')}
    >
      <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

/* ───────────────────────────── history */

function HistoryDrawer({ settingKey, canRestore, onClose, onRestored }: { settingKey: SiteSettingKey; canRestore: boolean; onClose: () => void; onRestored: () => void }) {
  const [revs, setRevs] = useState<Revision[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api<Revision[]>(`/admin/settings/${settingKey}/revisions`).then((r) => setRevs(r.data)).catch(() => setRevs([]));
  }, [settingKey]);

  async function restore(id: string, version: number) {
    if (!window.confirm(`Restore version ${version}? This publishes it as a new version.`)) return;
    setBusy(id);
    try {
      await api(`/admin/settings/${settingKey}/revisions/${id}/restore`, { method: 'POST' });
      onRestored();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <aside className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-ink-900 p-6" onClick={(e) => e.stopPropagation()} aria-label="Version history">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Version history</h3>
          <button type="button" onClick={onClose} className="btn btn-ghost px-2" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <ol className="mt-6 space-y-3">
          {revs === null && <Loader2 className="mx-auto h-5 w-5 animate-spin text-ink-400" />}
          {revs?.length === 0 && <p className="text-sm text-ink-400">No saved versions yet — the built-in defaults are in use.</p>}
          {revs?.map((r, i) => (
            <li key={r.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-white">v{r.version}{i === 0 && <span className="ml-2 rounded-full bg-volt-500/15 px-2 py-0.5 text-[10px] font-semibold text-volt-300">LIVE</span>}</span>
                {canRestore && i > 0 && (
                  <button type="button" disabled={busy !== null} onClick={() => restore(r.id, r.version)} className="btn btn-secondary px-3 py-1 text-xs">
                    {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Restore
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-ink-400">
                {formatDate(r.createdAt)} · {new Date(r.createdAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })} · {r.author ? `${r.author.firstName} ${r.author.lastName}` : 'system'}
              </p>
              {r.note && <p className="mt-2 text-sm text-ink-300">“{r.note}”</p>}
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}

export { DEFAULT_SITE_SETTINGS };
