'use client';

import { ArrowRight, HardHat, Loader2, Store } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { stateLabel, useStates } from '@/features/marketplace/states';
import { api, ApiError, refreshSession } from '@/lib/api';
import { cn } from '@/lib/format';

/** Pick one of your businesses — or open one. Any customer can become a seller or installer. */
export default function BusinessIndexPage() {
  const { user } = useAuth();
  const router = useRouter();
  const memberships = user?.memberships ?? [];

  useEffect(() => {
    if (memberships.length === 1) router.replace(`/business/${memberships[0]!.organization.id}`);
  }, [memberships, router]);

  if (memberships.length === 1) return null;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-extrabold tracking-tight text-white">{memberships.length ? 'Your businesses' : 'Sell or install on SOLARIS'}</h1>
      <p className="mt-1 text-ink-400">{memberships.length ? 'Choose a workspace, or open another business.' : 'Open a storefront for free. Keep using the same account as a customer.'}</p>

      {memberships.length > 0 && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {memberships.map(({ organization: o, role }) => (
            <Link key={o.id} href={`/business/${o.id}`} className="card group flex items-center justify-between p-5 hover:border-white/15">
              <div>
                <p className="font-bold text-white group-hover:text-sun-200">{o.name}</p>
                <p className="text-xs text-ink-400">{o.types.join(' + ').toLowerCase()} · {role.toLowerCase()} · {o.verification.toLowerCase()}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-ink-400" />
            </Link>
          ))}
        </div>
      )}

      <OpenBusinessForm />
    </div>
  );
}

function OpenBusinessForm() {
  const router = useRouter();
  const states = useStates();
  const [name, setName] = useState('');
  const [types, setTypes] = useState<Array<'VENDOR' | 'INSTALLER'>>(['VENDOR']);
  const [state, setState] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (t: 'VENDOR' | 'INSTALLER') => setTypes((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ id: string }>('/organizations', { method: 'POST', body: { name, types, ...(state ? { state } : {}) } });
      await refreshSession(); // pick up the new membership
      router.push(`/business/${r.data.id}/profile`);
    } catch (e) {
      setError(e instanceof ApiError ? (e.issues[0]?.message ?? e.message) : 'Could not create business');
      setBusy(false);
    }
  }

  return (
    <section className="card mt-8 p-6">
      <h2 className="text-lg font-bold text-white">Open a business</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="label">Business name</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunrise Energy Ltd" maxLength={120} />
        </label>
        <div className="sm:col-span-2">
          <span className="label">What does your business do? (choose one or both)</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {([['VENDOR', 'Sell equipment', 'Panels, inverters, batteries, accessories', Store], ['INSTALLER', 'Install & maintain', 'Surveys, installation, maintenance, repairs', HardHat]] as const).map(([t, title, desc, Icon]) => (
              <button key={t} type="button" onClick={() => toggle(t)} aria-pressed={types.includes(t)} className={cn('flex gap-3 rounded-2xl border p-4 text-left transition', types.includes(t) ? 'border-sun-400/60 bg-sun-400/10' : 'border-white/10 hover:border-white/20')}>
                <Icon className={cn('h-5 w-5 shrink-0', types.includes(t) ? 'text-sun-400' : 'text-ink-400')} />
                <span>
                  <span className="block text-sm font-bold text-white">{title}</span>
                  <span className="block text-xs text-ink-400">{desc}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <label>
          <span className="label">Main state</span>
          <select className="field" value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">Select…</option>
            {states.map((s) => <option key={s.stateCode} value={s.state}>{stateLabel(s.state)}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      <button type="button" onClick={submit} disabled={busy || name.trim().length < 2 || types.length === 0} className="btn btn-primary mt-6">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create business
      </button>
      <p className="mt-3 text-xs text-ink-400">Free to join. Your storefront goes live after SOLARIS verifies your business registration and credentials.</p>
    </section>
  );
}
