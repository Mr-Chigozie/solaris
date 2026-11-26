'use client';

import { BadgeCheck, Ban, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { cn, formatDate } from '@/lib/format';

interface Org {
  id: string;
  name: string;
  types: string[];
  isPlatformOwned: boolean;
  verification: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  verificationNote: string | null;
  state: string | null;
  cacNumber: string | null;
  createdAt: string;
  memberships: Array<{ user: { firstName: string; lastName: string; email: string; phone: string | null } }>;
}

const FILTERS = ['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'] as const;

export default function AdminVerificationPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('PENDING');
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setOrgs(null);
    api<Org[]>(`/admin/organizations?verification=${filter}&pageSize=100`)
      .then((r) => setOrgs(r.data))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load organisations'));
  }, [filter]);

  useEffect(load, [load]);

  async function decide(id: string, status: 'VERIFIED' | 'REJECTED' | 'SUSPENDED') {
    const note = window.prompt(`Note for this decision (${status.toLowerCase()}). It is recorded in the audit log:`);
    if (note === null) return;
    setBusyId(id);
    try {
      await api(`/admin/organizations/${id}/verification`, { method: 'PATCH', body: { status, ...(note ? { note } : {}) } });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Business verification</h2>
          <p className="mt-1 text-sm text-ink-400">Check CAC registration, technical credentials and evidence of past work before verifying.</p>
        </div>
        <div className="flex gap-1 self-start rounded-full bg-ink-900/70 p-1">
          {FILTERS.map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={cn('rounded-full px-3 py-1.5 text-xs font-semibold', filter === f ? 'bg-white text-ink-950' : 'text-ink-300')}>
              {f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

      <div className="mt-5 divide-y divide-white/[0.06]">
        {orgs === null && <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-ink-400" /></div>}
        {orgs?.length === 0 && <p className="py-10 text-center text-sm text-ink-400">No businesses with this status.</p>}
        {orgs?.map((o) => {
          const owner = o.memberships[0]?.user;
          return (
            <div key={o.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-bold text-white">
                  {o.name}
                  {o.types.map((t) => <span key={t} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-300">{t}</span>)}
                  {o.isPlatformOwned && <span className="rounded-full bg-sun-400/15 px-2 py-0.5 text-[10px] font-semibold text-sun-200">OFFICIAL</span>}
                </p>
                <p className="mt-0.5 truncate text-xs text-ink-400">
                  {owner ? `${owner.firstName} ${owner.lastName} · ${owner.email}${owner.phone ? ` · ${owner.phone}` : ''}` : 'No owner'} · {o.state ?? 'State not set'}
                  {o.cacNumber ? ` · CAC ${o.cacNumber}` : ''} · joined {formatDate(o.createdAt)}
                </p>
                {o.verificationNote && <p className="mt-1 text-xs italic text-ink-400">Note: {o.verificationNote}</p>}
              </div>
              {!o.isPlatformOwned && (
                <div className="flex gap-2">
                  {o.verification !== 'VERIFIED' && (
                    <button type="button" disabled={busyId === o.id} onClick={() => decide(o.id, 'VERIFIED')} className="btn bg-volt-500/15 px-4 py-2 text-volt-300 hover:bg-volt-500/25">
                      <BadgeCheck className="h-4 w-4" /> Verify
                    </button>
                  )}
                  {o.verification === 'PENDING' && (
                    <button type="button" disabled={busyId === o.id} onClick={() => decide(o.id, 'REJECTED')} className="btn btn-secondary px-4 py-2">Reject</button>
                  )}
                  {o.verification === 'VERIFIED' && (
                    <button type="button" disabled={busyId === o.id} onClick={() => decide(o.id, 'SUSPENDED')} className="btn bg-red-500/10 px-4 py-2 text-red-200 hover:bg-red-500/20">
                      <Ban className="h-4 w-4" /> Suspend
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
