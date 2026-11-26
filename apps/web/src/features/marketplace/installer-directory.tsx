'use client';

import { SERVICE_CATEGORIES, SERVICE_CATEGORY_LABEL } from '@solaris/validation';
import { HardHat, Loader2, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/format';
import { BusinessCard, ServiceRow } from './cards';
import { stateLabel, useStates } from './states';
import type { OrgCard, ServiceData } from './types';

export function InstallerDirectory() {
  const states = useStates();
  const [q, setQ] = useState('');
  const [state, setState] = useState('');
  const [category, setCategory] = useState('');
  const [installers, setInstallers] = useState<OrgCard[] | null>(null);
  const [services, setServices] = useState<ServiceData[] | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const base = new URLSearchParams({ pageSize: '30', ...(q ? { q } : {}), ...(state ? { state } : {}) });
      setInstallers(null);
      setServices(null);
      api<OrgCard[]>(`/marketplace/businesses?type=INSTALLER&${base}`).then((r) => setInstallers(r.data)).catch(() => setInstallers([]));
      api<ServiceData[]>(`/marketplace/services?${base}${category ? `&category=${category}` : ''}`).then((r) => setServices(r.data)).catch(() => setServices([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q, state, category]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-volt-400">Installers</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Find a verified installer near you</h1>
      <p className="mt-2 max-w-2xl text-ink-300">Every installer listed here has been reviewed for business registration, credentials and evidence of completed work. Message them directly, or share a saved design for a quote.</p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input className="field py-3 pl-10" placeholder="Search installers or services…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search installers" />
        </div>
        <select className="field sm:w-60" value={state} onChange={(e) => setState(e.target.value)} aria-label="Your state">
          <option value="">All states</option>
          {states.map((s) => <option key={s.stateCode} value={s.state}>{stateLabel(s.state)}</option>)}
        </select>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-white">Installers</h2>
        {installers === null ? (
          <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-ink-400" /></div>
        ) : installers.length === 0 ? (
          <div className="card mt-4 p-8 text-center">
            <HardHat className="mx-auto h-8 w-8 text-ink-400" />
            <p className="mt-3 text-ink-300">No verified installers match yet{state ? ` in ${stateLabel(state)}` : ''}.</p>
            <Link href="/register?type=INSTALLER" className="btn btn-secondary mt-5">Are you an installer? Join SOLARIS</Link>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{installers.map((o) => <BusinessCard key={o.id} org={o} />)}</div>
        )}
      </section>

      <section className="mt-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-white">Services</h2>
          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
            <button type="button" onClick={() => setCategory('')} className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold', !category ? 'bg-white text-ink-950' : 'bg-white/[0.05] text-ink-300')}>All</button>
            {SERVICE_CATEGORIES.map((c) => (
              <button key={c} type="button" onClick={() => setCategory(c)} className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold', category === c ? 'bg-white text-ink-950' : 'bg-white/[0.05] text-ink-300')}>
                {SERVICE_CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </div>
        {services === null ? (
          <div className="grid h-32 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-ink-400" /></div>
        ) : services.length === 0 ? (
          <p className="mt-4 text-sm text-ink-400">No services listed for this filter yet.</p>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">{services.map((s) => <ServiceRow key={s.id} s={s} />)}</div>
        )}
      </section>
    </div>
  );
}
