'use client';

import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/format';

interface Entry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
  actor: { email: string; firstName: string; lastName: string } | null;
}

const FILTERS: Array<[string, string]> = [
  ['', 'All'],
  ['settings.', 'Settings'],
  ['org.', 'Businesses'],
  ['admin.', 'Admin team'],
  ['auth.', 'Sign-ins'],
  ['appliance.', 'Catalogue'],
];

const TONE: Record<string, string> = {
  settings: 'bg-sun-400/15 text-sun-200',
  org: 'bg-volt-500/15 text-volt-200',
  admin: 'bg-fuchsia-500/15 text-fuchsia-200',
  auth: 'bg-sky-500/15 text-sky-200',
};

export default function AdminAuditPage() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Entry[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 30;

  useEffect(() => {
    setData(null);
    api<Entry[]>(`/admin/audit-logs?page=${page}&pageSize=${pageSize}${action ? `&action=${encodeURIComponent(action)}` : ''}`)
      .then((r) => setData({ items: r.data, total: Number(r.meta?.total ?? 0) }))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load audit log'));
  }, [action, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Audit log</h2>
          <p className="mt-1 text-sm text-ink-400">Append-only record of security, administrative and financial actions.</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map(([v, label]) => (
            <button key={v} type="button" onClick={() => { setAction(v); setPage(1); }} className={cn('rounded-full px-3 py-1.5 text-xs font-semibold', action === v ? 'bg-white text-ink-950' : 'bg-white/[0.05] text-ink-300')}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-ink-400">
            <tr>
              <th className="py-2 pr-3 font-semibold">When</th>
              <th className="py-2 pr-3 font-semibold">Action</th>
              <th className="py-2 pr-3 font-semibold">Who</th>
              <th className="py-2 pr-3 font-semibold">Target</th>
              <th className="py-2 font-semibold">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {data === null && <tr><td colSpan={5} className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-ink-400" /></td></tr>}
            {data?.items.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-ink-400">No entries.</td></tr>}
            {data?.items.map((e) => (
              <tr key={e.id} className="align-top">
                <td className="whitespace-nowrap py-2.5 pr-3 text-xs text-ink-400">{new Date(e.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td className="py-2.5 pr-3">
                  <span className={cn('rounded-full px-2 py-0.5 font-mono text-[11px]', TONE[e.action.split('.')[0] ?? ''] ?? 'bg-white/[0.06] text-ink-300')}>{e.action}</span>
                </td>
                <td className="py-2.5 pr-3 text-xs text-ink-300">{e.actor?.email ?? '—'}</td>
                <td className="py-2.5 pr-3 text-xs text-ink-400">{e.entityType ? `${e.entityType}${e.entityId ? ` · ${e.entityId.slice(0, 12)}` : ''}` : '—'}</td>
                <td className="max-w-[280px] py-2.5 font-mono text-[11px] text-ink-400">{e.metadata ? JSON.stringify(e.metadata).slice(0, 160) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 text-sm text-ink-400">
        <span>Page {page} of {pages}</span>
        <button type="button" className="btn btn-ghost px-2" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" className="btn btn-ghost px-2" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </section>
  );
}
