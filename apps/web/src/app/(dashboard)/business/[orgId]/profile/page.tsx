'use client';

import { Check, Loader2, Lock } from 'lucide-react';
import { useState } from 'react';
import { SingleImageUpload } from '@/features/business/image-upload';
import { useWorkspace } from '@/features/business/workspace-context';
import { stateLabel, useStates } from '@/features/marketplace/states';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/format';

export default function StorefrontProfilePage() {
  const { ws, reload } = useWorkspace();
  const o = ws.organization;
  const states = useStates();
  const [form, setForm] = useState({
    name: o.name,
    tagline: o.tagline ?? '',
    description: o.description ?? '',
    logoUrl: o.logoUrl ?? '',
    coverUrl: o.coverUrl ?? '',
    website: o.website ?? '',
    email: o.email ?? '',
    phone: o.phone ?? '',
    whatsapp: o.whatsapp ?? '',
    state: o.state ?? '',
    city: o.city ?? '',
    address: o.address ?? '',
    cacNumber: o.cacNumber ?? '',
    yearsInBusiness: o.yearsInBusiness,
    serviceStates: o.serviceStates,
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const readOnly = !ws.can.MANAGE_PROFILE;

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  async function save() {
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      await api(`/organizations/${o.id}/profile`, { method: 'PATCH', body: form });
      setSaved(true);
      reload();
    } catch (e) {
      if (e instanceof ApiError && e.issues.length) setErrors(e.fieldErrors());
      setError(e instanceof ApiError ? (e.issues.length ? 'Please fix the highlighted fields.' : e.message) : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  const text = (k: keyof typeof form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label>
      <span className="label">{label}</span>
      <input className={cn('field', errors[k] && 'border-red-400/60')} value={String(form[k] ?? '')} onChange={(e) => set(k, e.target.value as never)} {...props} />
      {errors[k] && <span className="mt-1 block text-xs text-red-300">{errors[k]}</span>}
    </label>
  );

  return (
    <fieldset disabled={readOnly || busy} className="space-y-6">
      {readOnly && <p className="flex items-center gap-2 rounded-xl bg-white/[0.04] p-3 text-sm text-ink-300"><Lock className="h-4 w-4" /> You can view but not edit the storefront.</p>}

      <section className="card p-6">
        <h2 className="text-lg font-bold text-white">Brand</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr]">
          <SingleImageUpload label="Logo" value={form.logoUrl} onChange={(v) => set('logoUrl', v)} />
          <SingleImageUpload label="Cover image" aspect="wide" value={form.coverUrl} onChange={(v) => set('coverUrl', v)} />
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {text('name', 'Business name', { maxLength: 120 })}
          {text('tagline', 'Tagline', { maxLength: 140, placeholder: 'e.g. Tier-1 panels & lithium batteries, delivered nationwide' })}
          <label className="sm:col-span-2">
            <span className="label">About your business</span>
            <textarea className="field min-h-[140px]" value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={4000} placeholder="What you sell or install, brands you carry, warranties, experience, notable projects…" />
          </label>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-bold text-white">Contact & location</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {text('phone', 'Phone', { type: 'tel', placeholder: '0803 000 0000' })}
          {text('whatsapp', 'WhatsApp', { type: 'tel' })}
          {text('email', 'Public email', { type: 'email' })}
          {text('website', 'Website', { type: 'url', placeholder: 'https://' })}
          <label>
            <span className="label">State</span>
            <select className="field" value={form.state} onChange={(e) => set('state', e.target.value)}>
              <option value="">Select…</option>
              {states.map((s) => <option key={s.stateCode} value={s.state}>{stateLabel(s.state)}</option>)}
            </select>
          </label>
          {text('city', 'City / area')}
          <div className="sm:col-span-2">{text('address', 'Address (optional)')}</div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-bold text-white">States you deliver to or install in</h2>
        <p className="mt-1 text-sm text-ink-400">Customers filtering by state will find you here.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost px-3 py-1.5 text-xs" onClick={() => set('serviceStates', states.map((s) => s.state))}>Nationwide</button>
          <button type="button" className="btn btn-ghost px-3 py-1.5 text-xs" onClick={() => set('serviceStates', [])}>Clear</button>
          {states.map((s) => {
            const on = form.serviceStates.includes(s.state);
            return (
              <button
                key={s.stateCode}
                type="button"
                aria-pressed={on}
                onClick={() => set('serviceStates', on ? form.serviceStates.filter((x) => x !== s.state) : [...form.serviceStates, s.state])}
                className={cn('rounded-full px-3 py-1.5 text-xs font-semibold transition', on ? 'bg-volt-500/20 text-volt-200' : 'bg-white/[0.05] text-ink-400 hover:text-white')}
              >
                {stateLabel(s.state)}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-bold text-white">Verification details</h2>
        <p className="mt-1 text-sm text-ink-400">Used by SOLARIS to verify your business. Your CAC number is shown on your storefront once verified.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {text('cacNumber', 'CAC registration number', { placeholder: 'RC 1234567' })}
          <label>
            <span className="label">Years in business</span>
            <input type="number" min={0} max={100} className="field" value={form.yearsInBusiness ?? ''} onChange={(e) => set('yearsInBusiness', Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : null)} />
          </label>
        </div>
      </section>

      {!readOnly && (
        <div className="sticky bottom-24 flex items-center justify-end gap-3 rounded-2xl border border-white/[0.08] bg-ink-850/95 p-3 backdrop-blur lg:bottom-4">
          {error && <span className="mr-auto text-sm text-red-300">{error}</span>}
          {saved && <span className="flex items-center gap-1 text-sm text-volt-300"><Check className="h-4 w-4" /> Saved</span>}
          <button type="button" onClick={save} className="btn btn-primary">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save storefront</button>
        </div>
      )}
    </fieldset>
  );
}
