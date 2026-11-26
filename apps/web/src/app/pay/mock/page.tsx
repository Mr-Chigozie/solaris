'use client';

import { CreditCard, FlaskConical, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { formatNaira } from '@/lib/format';

/**
 * DEVELOPMENT-ONLY simulated checkout (PAYMENTS_PROVIDER=mock). The API refuses
 * the mock provider in production, so this page has nothing to call there.
 */
export default function MockCheckoutPage() {
  return (
    <Suspense>
      <MockCheckout />
    </Suspense>
  );
}

function MockCheckout() {
  const params = useSearchParams();
  const reference = params.get('reference') ?? '';
  const amount = Number(params.get('amount') ?? 0) / 100;
  const callback = params.get('callback') ?? '/';
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Only allow returning to our own web origin (evaluated in the browser, not during SSR). */
  function safeCallback() {
    try {
      const u = new URL(callback, window.location.origin);
      return u.origin === window.location.origin ? u.toString() : '/';
    } catch {
      return '/';
    }
  }

  async function complete(outcome: 'success' | 'failed') {
    setBusy(outcome);
    setError(null);
    try {
      await api(`/payments/mock/${encodeURIComponent(reference)}/complete`, { method: 'POST', body: { outcome } });
      window.location.href = safeCallback();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Mock payment failed');
      setBusy(null);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[#0b1220] px-4">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white p-7 text-[#0b1220] shadow-2xl">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-800">
          <FlaskConical className="h-3.5 w-3.5" /> Test checkout — no real money
        </p>
        <p className="mt-6 text-sm text-slate-500">Amount to pay</p>
        <p className="text-3xl font-extrabold">{formatNaira(amount)}</p>
        <p className="mt-1 break-all font-mono text-xs text-slate-400">{reference}</p>
        <div className="mt-7 space-y-2">
          <button type="button" disabled={busy !== null} onClick={() => complete('success')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
            {busy === 'success' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Simulate successful payment
          </button>
          <button type="button" disabled={busy !== null} onClick={() => complete('failed')} className="w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
            Simulate failed payment
          </button>
        </div>
        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <p className="mt-6 text-center text-[11px] text-slate-400">With a Paystack key configured, customers see Paystack’s real checkout here instead.</p>
      </div>
    </main>
  );
}
