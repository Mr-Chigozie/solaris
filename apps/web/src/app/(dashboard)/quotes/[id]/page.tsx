'use client';

import { ArrowLeft, Check, History, Loader2, MessageSquare, Pencil, Printer, ShieldCheck, Undo2, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { QuoteBuilder } from '@/features/commerce/quote-builder';
import { QUOTE_STATUS_STYLE, type QuoteDetail } from '@/features/commerce/types';
import { OrgAvatar, VerifiedBadge } from '@/features/marketplace/cards';
import { stateLabel, useStates } from '@/features/marketplace/states';
import { api, ApiError } from '@/lib/api';
import { cn, formatDate, formatNaira } from '@/lib/format';

export default function QuotePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [q, setQ] = useState<QuoteDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRev, setShowRev] = useState<number | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [revising, setRevising] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<QuoteDetail>(`/quotations/${id}`)
      .then((r) => setQ(r.data))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load quotation'));
  }, [id]);
  useEffect(load, [load]);

  if (error && !q) return <p className="mx-auto max-w-3xl rounded-2xl bg-red-500/10 p-4 text-sm text-red-200">{error}</p>;
  if (!q) return <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-ink-400" /></div>;

  const current = q.revisions.find((r) => r.revision === q.currentRevision)!;
  const shown = q.revisions.find((r) => r.revision === (showRev ?? q.currentRevision)) ?? current;
  const isCurrent = shown.revision === q.currentRevision;
  const style = QUOTE_STATUS_STYLE[q.status];

  async function act(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      await api(path, { method: 'POST', body });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href={q.side === 'customer' ? '/orders?tab=quotes' : `/business/${q.organization.id}/quotations`} className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> {q.side === 'customer' ? 'My quotes' : 'Quotations'}
        </Link>
        <div className="flex flex-wrap gap-2">
          {q.conversationId && (
            <Link href={`/messages?c=${q.conversationId}${q.side === 'business' ? `&inbox=${q.organization.id}` : ''}`} className="btn btn-ghost"><MessageSquare className="h-4 w-4" /> Chat</Link>
          )}
          <button type="button" onClick={() => window.print()} className="btn btn-ghost" aria-label="Print or save as PDF"><Printer className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Action bar */}
      <div className="no-print mt-4">
        {q.side === 'customer' && q.status === 'SENT' && (
          <div className="flex flex-col gap-3 rounded-2xl border border-sun-400/30 bg-sun-400/[0.07] p-4 sm:flex-row sm:items-center">
            <p className="flex-1 text-sm text-sun-100">
              {q.organization.name} sent you this quotation{q.expiresAt ? `, valid until ${formatDate(q.expiresAt)}` : ''}. Accepting creates an order{q.organization.acceptsOnlinePayment ? ' you can pay for securely with Paystack' : ''}.
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { const reason = window.prompt('Optional: tell the business why you are declining'); if (reason !== null) void act(`/quotations/${q.id}/reject`, reason ? { reason } : {}); }}>
                <X className="h-4 w-4" /> Decline
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => setAccepting(true)}><Check className="h-4 w-4" /> Accept</button>
            </div>
          </div>
        )}
        {q.order && (
          <Link href={`/orders/${q.order.id}`} className="flex items-center justify-between rounded-2xl border border-volt-400/25 bg-volt-500/[0.08] p-4 text-sm text-volt-200 hover:bg-volt-500/[0.12]">
            <span>Accepted — order <strong>{q.order.reference}</strong></span>
            <span className="font-semibold">View order →</span>
          </Link>
        )}
        {q.side === 'business' && q.canManage && ['DRAFT', 'SENT', 'REJECTED', 'EXPIRED'].includes(q.status) && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={() => setRevising(true)}><Pencil className="h-4 w-4" /> {q.status === 'DRAFT' ? 'Edit & send' : 'Revise & resend'}</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => window.confirm('Withdraw this quotation? The customer will no longer be able to accept it.') && act(`/organizations/${q.organization.id}/quotations/${q.id}/withdraw`)}>
              <Undo2 className="h-4 w-4" /> Withdraw
            </button>
          </div>
        )}
        {q.status === 'REJECTED' && q.rejectionReason && <p className="mt-3 rounded-xl bg-white/[0.04] p-3 text-sm text-ink-300">Declined: “{q.rejectionReason}”</p>}
        {error && <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      </div>

      {/* Document */}
      <article className="card mt-6 p-6 sm:p-10">
        <header className="flex flex-col gap-6 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <OrgAvatar org={q.organization} size={52} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold text-white">{q.organization.name}</h1>
                <VerifiedBadge org={q.organization} />
              </div>
              <p className="text-xs text-ink-400">{[q.organization.city, q.organization.state].filter(Boolean).join(', ')}{q.organization.cacNumber ? ` · CAC ${q.organization.cacNumber}` : ''}</p>
              {q.organization.phone && <p className="text-xs text-ink-400">{q.organization.phone}</p>}
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-400">Quotation</p>
            <p className="font-mono text-lg font-bold text-white">{q.reference}</p>
            <span className={cn('mt-1 inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold', style.className)}>{style.label}</span>
          </div>
        </header>

        <div className="grid gap-4 py-6 text-sm sm:grid-cols-3">
          <Meta label="Prepared for" value={`${q.customer.firstName} ${q.customer.lastName}`} />
          <Meta label="Date" value={formatDate(shown.createdAt)} />
          <Meta label="Valid until" value={shown.validUntil ? formatDate(shown.validUntil) : '—'} />
        </div>
        {q.title && <h2 className="mb-4 text-lg font-bold text-white">{q.title}</h2>}
        {!isCurrent && <p className="mb-4 rounded-xl bg-white/[0.05] p-3 text-sm text-ink-300">You’re viewing revision {shown.revision}. The current revision is {q.currentRevision}.</p>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="border-b border-white/[0.08] text-left text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="py-2 pr-3 font-semibold">Item</th>
                <th className="w-16 py-2 pr-3 text-right font-semibold">Qty</th>
                <th className="w-32 py-2 pr-3 text-right font-semibold">Unit price</th>
                <th className="w-32 py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {shown.lineItems.map((l, i) => (
                <tr key={i}>
                  <td className="py-3 pr-3 text-ink-100">
                    {l.description}
                    {l.snapshot?.brand && <span className="block text-xs text-ink-400">{l.snapshot.brand}</span>}
                  </td>
                  <td className="py-3 pr-3 text-right text-ink-300">{l.quantity}</td>
                  <td className="py-3 pr-3 text-right text-ink-300">{formatNaira(l.unitPrice)}</td>
                  <td className="py-3 text-right font-semibold text-white">{formatNaira(l.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ml-auto mt-6 max-w-xs space-y-2 text-sm">
          <Line label="Subtotal" value={formatNaira(shown.subtotal)} />
          {shown.discount > 0 && <Line label="Discount" value={`− ${formatNaira(shown.discount)}`} />}
          {shown.tax > 0 && <Line label={`VAT (${(shown.vatRate * 100).toFixed(1)}%)`} value={formatNaira(shown.tax)} />}
          <div className="flex justify-between border-t border-white/[0.1] pt-3 text-lg font-extrabold text-white">
            <span>Total</span>
            <span className="text-sun-300">{formatNaira(shown.total)}</span>
          </div>
        </div>

        {shown.notes && (
          <section className="mt-8">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-400">Notes & terms</h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-300">{shown.notes}</p>
          </section>
        )}
        <p className="mt-8 flex items-start gap-2 text-xs text-ink-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-volt-400" />
          Prices on this quotation are locked. Any change creates a new revision you can review before accepting.
        </p>
      </article>

      {q.revisions.length > 1 && (
        <section className="no-print card mt-6 p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-white"><History className="h-4 w-4" /> Revisions</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {q.revisions.map((r) => (
              <button key={r.revision} type="button" onClick={() => setShowRev(r.revision)} className={cn('rounded-full px-3 py-1.5 text-xs font-semibold', r.revision === shown.revision ? 'bg-white text-ink-950' : 'bg-white/[0.05] text-ink-300')}>
                v{r.revision} · {formatNaira(r.total)}{r.revision === q.currentRevision ? ' (current)' : ''}
              </button>
            ))}
          </div>
        </section>
      )}

      {accepting && (
        <AcceptDialog
          quote={q}
          onClose={() => setAccepting(false)}
          onAccepted={(orderId) => router.push(`/orders/${orderId}`)}
        />
      )}
      {revising && (
        <QuoteBuilder
          organizationId={q.organization.id}
          quotationId={q.id}
          initial={{ ...current, title: q.title }}
          onClose={() => setRevising(false)}
          onSaved={() => {
            setRevising(false);
            setShowRev(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function AcceptDialog({ quote, onClose, onAccepted }: { quote: QuoteDetail; onClose: () => void; onAccepted: (orderId: string) => void }) {
  const states = useStates();
  const [a, setA] = useState({ recipientName: `${quote.customer.firstName} ${quote.customer.lastName}`, phone: '', addressLine: '', city: '', state: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const total = quote.revisions.find((r) => r.revision === quote.currentRevision)!.total;

  async function accept() {
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const r = await api<{ orderId: string }>(`/quotations/${quote.id}/accept`, {
        method: 'POST',
        body: { revision: quote.currentRevision, deliveryAddress: { ...a, notes: a.notes || undefined } },
      });
      onAccepted(r.data.orderId);
    } catch (e) {
      if (e instanceof ApiError && e.issues.length) setErrors(Object.fromEntries(e.issues.map((i) => [i.path.replace('deliveryAddress.', ''), i.message])));
      setError(e instanceof ApiError ? (e.issues.length ? 'Please complete the delivery details.' : e.message) : 'Could not accept');
      setBusy(false);
    }
  }

  const field = (k: keyof typeof a, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="label">{label}</span>
      <input className={cn('field', errors[k] && 'border-red-400/60')} value={a[k]} onChange={(e) => setA({ ...a, [k]: e.target.value })} {...props} />
      {errors[k] && <span className="mt-1 block text-xs text-red-300">{errors[k]}</span>}
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Accept quotation" className="card max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-b-none p-6 sm:rounded-[var(--brand-radius)]" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white">Accept quotation {quote.reference}</h2>
        <p className="mt-1 text-sm text-ink-400">Total <strong className="text-sun-300">{formatNaira(total)}</strong>. Where should {quote.organization.name} deliver or install?</p>
        <fieldset disabled={busy} className="mt-5 grid gap-3 sm:grid-cols-2">
          {field('recipientName', 'Recipient name')}
          {field('phone', 'Phone', { type: 'tel', placeholder: '0803 000 0000' })}
          <div className="sm:col-span-2">{field('addressLine', 'Address', { placeholder: 'House number, street, estate' })}</div>
          {field('city', 'City / area')}
          <label className="block">
            <span className="label">State</span>
            <select className={cn('field', errors.state && 'border-red-400/60')} value={a.state} onChange={(e) => setA({ ...a, state: e.target.value })}>
              <option value="">Select…</option>
              {states.map((s) => <option key={s.stateCode} value={s.state}>{stateLabel(s.state)}</option>)}
            </select>
          </label>
          <div className="sm:col-span-2">{field('notes', 'Delivery notes (optional)', { placeholder: 'Landmark, gate code, best time…' })}</div>
        </fieldset>
        <p className="mt-4 text-xs text-ink-400">Your address is shared only with {quote.organization.name} for this order.</p>
        {error && <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={accept} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Accept & create order</button>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</p>
      <p className="mt-0.5 text-ink-100">{value}</p>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-ink-300">
      <span>{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
