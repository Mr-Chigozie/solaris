'use client';

import { ORDER_STATUS_LABEL, type OrderStatusName } from '@solaris/validation';
import { ArrowLeft, CheckCircle2, Circle, CreditCard, Loader2, Lock, MapPin, MessageSquare, PackageCheck, Printer, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ORDER_STATUS_STYLE, type OrderDetail } from '@/features/commerce/types';
import { OrgAvatar } from '@/features/marketplace/cards';
import { api, ApiError } from '@/lib/api';
import { cn, formatDate, formatNaira } from '@/lib/format';

const TRACK: OrderStatusName[] = ['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'];

export default function OrderPage() {
  return (
    <Suspense>
      <OrderView />
    </Suspense>
  );
}

function OrderView() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const [o, setO] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const verified = useRef(false);

  const load = useCallback(() => {
    api<OrderDetail>(`/orders/${id}`)
      .then((r) => setO(r.data))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load order'));
  }, [id]);

  // Returning from checkout: confirm the payment (the webhook will also do this).
  useEffect(() => {
    const reference = params.get('reference');
    if (!reference || verified.current) {
      load();
      return;
    }
    verified.current = true;
    setBusy('verify');
    api<{ orderStatus: string; paymentStatus: string }>(`/orders/${id}/verify-payment`, { method: 'POST', body: { reference } })
      .then((r) => setNotice(r.data.paymentStatus === 'SUCCEEDED' ? 'Payment received — thank you! The seller has been notified.' : r.data.paymentStatus === 'FAILED' ? 'The payment did not go through. You can try again.' : 'We are confirming your payment. This page will update shortly.'))
      .catch(() => setNotice('We could not confirm the payment yet. If you were charged, it will update automatically.'))
      .finally(() => {
        setBusy(null);
        router.replace(`/orders/${id}`, { scroll: false });
        load();
      });
  }, [id, params, load, router]);

  if (error && !o) return <p className="mx-auto max-w-3xl rounded-2xl bg-red-500/10 p-4 text-sm text-red-200">{error}</p>;
  if (!o) return <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-ink-400" /></div>;

  async function act(key: string, fn: () => Promise<unknown>, done?: string) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      if (done) setNotice(done);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  async function pay() {
    setBusy('pay');
    setError(null);
    try {
      const r = await api<{ authorizationUrl: string }>(`/orders/${id}/pay`, { method: 'POST' });
      window.location.href = r.data.authorizationUrl;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not start payment');
      setBusy(null);
    }
  }

  const stepIndex = TRACK.indexOf(o.status === 'READY' ? 'PROCESSING' : o.status);
  const terminal = ['CANCELLED', 'REFUNDED', 'DISPUTED'].includes(o.status);
  const chatHref = o.quotation?.conversationId ? `/messages?c=${o.quotation.conversationId}${o.side === 'business' ? `&inbox=${o.organization.id}` : ''}` : null;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href={o.side === 'customer' ? '/orders' : `/business/${o.organization.id}/orders`} className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Orders</Link>
        <div className="flex gap-2">
          {chatHref && <Link href={chatHref} className="btn btn-ghost"><MessageSquare className="h-4 w-4" /> Chat</Link>}
          <button type="button" onClick={() => window.print()} className="btn btn-ghost" aria-label="Print"><Printer className="h-4 w-4" /></button>
        </div>
      </div>

      <header className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-400">Order</p>
          <h1 className="font-mono text-2xl font-extrabold text-white">{o.reference}</h1>
          <p className="mt-1 text-sm text-ink-400">Placed {formatDate(o.createdAt)}{o.quotation ? <> from quotation <Link href={`/quotes/${o.quotation.id}`} className="text-sun-300 hover:underline">{o.quotation.reference}</Link></> : null}</p>
        </div>
        <span className={cn('self-start rounded-full px-3 py-1.5 text-sm font-semibold sm:self-auto', ORDER_STATUS_STYLE[o.status])}>{ORDER_STATUS_LABEL[o.status]}</span>
      </header>

      {notice && <p className="mt-5 rounded-2xl border border-volt-400/25 bg-volt-500/[0.08] p-4 text-sm text-volt-200">{notice}</p>}
      {error && <p className="mt-5 rounded-2xl bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
      {busy === 'verify' && <p className="mt-5 flex items-center gap-2 text-sm text-ink-300"><Loader2 className="h-4 w-4 animate-spin" /> Confirming your payment…</p>}

      {/* Progress */}
      {!terminal ? (
        <ol className="card mt-6 grid grid-cols-3 gap-y-4 p-5 sm:grid-cols-6">
          {TRACK.map((s, i) => (
            <li key={s} className="flex flex-col items-center gap-1.5 text-center">
              {i <= stepIndex ? <CheckCircle2 className="h-6 w-6 text-volt-400" /> : <Circle className="h-6 w-6 text-ink-600" />}
              <span className={cn('text-[11px] font-semibold', i <= stepIndex ? 'text-ink-100' : 'text-ink-400')}>{ORDER_STATUS_LABEL[s]}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-6 flex items-center gap-2 rounded-2xl bg-white/[0.04] p-4 text-sm text-ink-300">
          <XCircle className="h-5 w-5 text-red-300" /> {ORDER_STATUS_LABEL[o.status]}{o.cancelReason ? ` — ${o.cancelReason}` : ''}
          {o.status === 'DISPUTED' && ' · SOLARIS support will contact both parties.'}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section className="card p-5 sm:p-6">
            <h2 className="font-bold text-white">Items</h2>
            <ul className="mt-4 divide-y divide-white/[0.06]">
              {o.items.map((it) => (
                <li key={it.id} className="flex items-center gap-3 py-3">
                  {it.snapshot?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.snapshot.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  ) : <span className="grid h-12 w-12 place-items-center rounded-lg bg-white/[0.04] text-xs text-ink-400">×{it.quantity}</span>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{it.description}</p>
                    <p className="text-xs text-ink-400">{it.quantity} × {formatNaira(it.unitPrice)}</p>
                  </div>
                  <span className="text-sm font-semibold text-white">{formatNaira(it.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <div className="ml-auto mt-4 max-w-xs space-y-1.5 border-t border-white/[0.08] pt-4 text-sm">
              <Row label="Subtotal" value={formatNaira(o.subtotal)} />
              {o.discount > 0 && <Row label="Discount" value={`− ${formatNaira(o.discount)}`} />}
              {o.tax > 0 && <Row label="VAT" value={formatNaira(o.tax)} />}
              <div className="flex justify-between pt-2 text-lg font-extrabold text-white"><span>Total</span><span className="text-sun-300">{formatNaira(o.total)}</span></div>
              {o.side === 'business' && o.sellerReceives !== undefined && (
                <p className="pt-1 text-xs text-ink-400">You receive {formatNaira(o.sellerReceives)} after SOLARIS’s {(o.commissionRate * 100).toFixed(1)}% commission ({formatNaira(o.commissionAmount)}), less Paystack fees.</p>
              )}
            </div>
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="font-bold text-white">Timeline</h2>
            <ol className="mt-4 space-y-4 border-l border-white/[0.08] pl-5">
              {o.events.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full bg-volt-400" />
                  <p className="text-sm font-semibold text-white">{ORDER_STATUS_LABEL[e.status]}</p>
                  <p className="text-xs text-ink-400">{new Date(e.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}{e.note ? ` · ${e.note}` : ''}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4">
          {/* Customer: pay */}
          {o.side === 'customer' && o.status === 'PENDING_PAYMENT' && (
            <section className="card p-5">
              <h2 className="font-bold text-white">Payment</h2>
              {o.organization.acceptsOnlinePayment ? (
                <>
                  <button type="button" onClick={pay} disabled={busy !== null} className="btn btn-primary mt-4 w-full py-3">
                    {busy === 'pay' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Pay {formatNaira(o.total)}
                  </button>
                  <p className="mt-3 flex items-start gap-2 text-xs text-ink-400">
                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Secured by Paystack — card, bank transfer or USSD. Your money goes directly to {o.organization.name}; SOLARIS never stores card details.
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-ink-300">{o.organization.name} hasn’t enabled online payment yet. Agree payment details with them in the chat.</p>
              )}
              <button type="button" disabled={busy !== null} onClick={() => window.confirm('Cancel this order?') && act('cancel', () => api(`/orders/${id}/cancel`, { method: 'POST', body: {} }), 'Order cancelled.')} className="btn btn-ghost mt-2 w-full text-xs">Cancel order</button>
            </section>
          )}

          {/* Customer: confirm receipt */}
          {o.side === 'customer' && ['SHIPPED', 'DELIVERED', 'READY'].includes(o.status) && (
            <section className="card p-5">
              <h2 className="font-bold text-white">Received your order?</h2>
              <p className="mt-1 text-sm text-ink-400">Confirm once everything has arrived (and is installed, if included).</p>
              <button type="button" disabled={busy !== null} onClick={() => act('confirm', () => api(`/orders/${id}/confirm-delivery`, { method: 'POST' }), 'Thanks for confirming!')} className="btn btn-primary mt-4 w-full">
                <PackageCheck className="h-4 w-4" /> Confirm receipt
              </button>
            </section>
          )}

          {/* Seller: fulfilment */}
          {o.side === 'business' && o.canManage && o.allowedTransitions.length > 0 && (
            <section className="card p-5">
              <h2 className="font-bold text-white">Update order</h2>
              <div className="mt-4 grid gap-2">
                {o.allowedTransitions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={busy !== null}
                    onClick={() => {
                      const note = window.prompt(`Optional note for the customer (${ORDER_STATUS_LABEL[s]}):`);
                      if (note === null) return;
                      void act(s, () => api(`/organizations/${o.organization.id}/orders/${id}/status`, { method: 'PATCH', body: { status: s, ...(note ? { note } : {}) } }));
                    }}
                    className={cn('btn', s === 'CANCELLED' ? 'btn-ghost text-red-300' : 'btn-secondary')}
                  >
                    {busy === s && <Loader2 className="h-4 w-4 animate-spin" />} Mark as {ORDER_STATUS_LABEL[s].toLowerCase()}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="card p-5 text-sm">
            <h2 className="flex items-center gap-2 font-bold text-white"><MapPin className="h-4 w-4 text-ink-400" /> Delivery</h2>
            {o.deliveryAddress ? (
              <div className="mt-3 space-y-0.5 text-ink-300">
                <p className="font-semibold text-ink-100">{o.deliveryAddress.recipientName}</p>
                <p>{o.deliveryAddress.addressLine}</p>
                <p>{o.deliveryAddress.city}, {o.deliveryAddress.state}</p>
                <p>{o.deliveryAddress.phone}</p>
                {o.deliveryAddress.notes && <p className="pt-1 text-xs text-ink-400">{o.deliveryAddress.notes}</p>}
              </div>
            ) : <p className="mt-2 text-ink-400">No address provided.</p>}
          </section>

          <section className="card flex items-center gap-3 p-5">
            <OrgAvatar org={o.organization} size={40} />
            <div className="min-w-0 text-sm">
              <p className="text-xs text-ink-400">{o.side === 'customer' ? 'Seller' : 'Customer'}</p>
              <p className="truncate font-semibold text-white">{o.side === 'customer' ? o.organization.name : `${o.customer.firstName} ${o.customer.lastName}`}</p>
            </div>
          </section>

          {o.payments.length > 0 && (
            <section className="card p-5 text-xs text-ink-400">
              <h2 className="text-sm font-bold text-white">Payments</h2>
              <ul className="mt-2 space-y-1.5">
                {o.payments.map((p) => (
                  <li key={p.providerRef} className="flex justify-between gap-2">
                    <span className="truncate font-mono">{p.providerRef}</span>
                    <span className={p.status === 'SUCCEEDED' ? 'text-volt-300' : p.status === 'FAILED' ? 'text-red-300' : ''}>{p.status.toLowerCase()}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-ink-300">
      <span>{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
