'use client';

import { FileText, Loader2, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useWorkspace } from '@/features/business/workspace-context';
import { QUOTE_STATUS_STYLE, type QuoteSummary } from '@/features/commerce/types';
import { api, ApiError } from '@/lib/api';
import { cn, formatDate, formatNaira } from '@/lib/format';

const FILTERS = ['', 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const;

export default function BusinessQuotationsPage() {
  const { ws } = useWorkspace();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('');
  const [items, setItems] = useState<QuoteSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(null);
    api<QuoteSummary[]>(`/organizations/${ws.organization.id}/quotations${filter ? `?status=${filter}` : ''}`)
      .then((r) => setItems(r.data))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load quotations'));
  }, [ws.organization.id, filter]);

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Quotations</h2>
          <p className="mt-1 text-sm text-ink-400">Create quotations from a customer conversation — they arrive in the customer’s chat and can be accepted in one tap.</p>
        </div>
        <Link href={`/messages?inbox=${ws.organization.id}`} className="btn btn-primary self-start"><MessageSquare className="h-4 w-4" /> Quote from inbox</Link>
      </div>
      <div className="mt-5 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f || 'all'} type="button" onClick={() => setFilter(f)} className={cn('rounded-full px-3 py-1.5 text-xs font-semibold', filter === f ? 'bg-white text-ink-950' : 'bg-white/[0.05] text-ink-300')}>
            {f ? QUOTE_STATUS_STYLE[f].label : 'All'}
          </button>
        ))}
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      {items === null && !error && <div className="grid h-32 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-ink-400" /></div>}
      {items?.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-ink-400">
          <FileText className="mx-auto mb-3 h-8 w-8" /> No quotations here yet.
        </div>
      )}
      <div className="mt-4 divide-y divide-white/[0.06]">
        {items?.map((q) => (
          <Link key={q.id} href={`/quotes/${q.id}`} className="flex items-center gap-4 py-4 hover:bg-white/[0.02]">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-white">{q.title ?? `Quotation for ${q.customer?.firstName} ${q.customer?.lastName}`}</p>
              <p className="text-xs text-ink-400"><span className="font-mono">{q.reference}</span> · {q.customer?.firstName} {q.customer?.lastName} · rev {q.currentRevision} · {formatDate(q.updatedAt)}{q.order ? ` · order ${q.order.reference}` : ''}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-white">{q.total !== null ? formatNaira(q.total) : '—'}</p>
              <span className={cn('mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold', QUOTE_STATUS_STYLE[q.status].className)}>{QUOTE_STATUS_STYLE[q.status].label}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
