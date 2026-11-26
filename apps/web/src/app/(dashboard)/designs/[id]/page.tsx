'use client';

import { ArrowLeft, Loader2, Printer, RefreshCw, Send } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { DesignResults } from '@/features/calculator/design-results';
import { STATUS_LABEL, type DesignDetail } from '@/features/designs/types';
import { api, ApiError } from '@/lib/api';
import { cn, formatDate } from '@/lib/format';

export default function DesignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [design, setDesign] = useState<DesignDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'review' | 'recalc' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    api<DesignDetail>(`/solar/designs/${id}`)
      .then((r) => setDesign(r.data))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load design'));
  }, [id]);

  useEffect(load, [load]);

  async function requestReview() {
    setBusy('review');
    try {
      await api(`/solar/designs/${id}/request-review`, { method: 'POST' });
      setNotice('Review requested. A verified installer will be matched to your design once installer reviews launch.');
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Request failed');
    } finally {
      setBusy(null);
    }
  }

  async function recalculate() {
    setBusy('recalc');
    try {
      const r = await api<{ previous: { engineVersion: string } }>(`/solar/designs/${id}/recalculate`, { method: 'POST' });
      setNotice(`Recalculated with the current engine (previously v${r.data.previous.engineVersion}).`);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Recalculation failed');
    } finally {
      setBusy(null);
    }
  }

  if (error && !design) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-200">{error}</p>
        <Link href="/designs" className="btn btn-secondary mt-6"><ArrowLeft className="h-4 w-4" /> Back to designs</Link>
      </div>
    );
  }

  if (!design) return <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-ink-400" /></div>;

  const status = STATUS_LABEL[design.status];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/designs" className="no-print inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> My designs
      </Link>
      <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">{design.title}</h1>
            <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold', status.className)}>{status.label}</span>
          </div>
          <p className="mt-1 text-sm text-ink-400">
            Saved {formatDate(design.createdAt)} · engine v{design.engineVersion} · data {design.dataVersion}
          </p>
        </div>
        <div className="no-print flex gap-2">
          <button type="button" onClick={() => window.print()} className="btn btn-secondary" aria-label="Print or save as PDF"><Printer className="h-4 w-4" /></button>
          <button type="button" onClick={recalculate} disabled={busy !== null || design.status === 'INSTALLER_APPROVED'} className="btn btn-secondary">
            {busy === 'recalc' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Recalculate
          </button>
          <button type="button" onClick={requestReview} disabled={busy !== null || design.status !== 'ESTIMATED'} className="btn btn-primary">
            {busy === 'review' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {design.status === 'REVIEW_REQUESTED' ? 'Review requested' : 'Request review'}
          </button>
        </div>
      </header>

      {notice && <p className="mt-6 rounded-2xl border border-volt-400/25 bg-volt-500/[0.08] p-4 text-sm text-volt-200">{notice}</p>}
      {error && <p className="mt-6 rounded-2xl bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}

      <div className="mt-8">
        <DesignResults result={design.result} />
      </div>
    </div>
  );
}
