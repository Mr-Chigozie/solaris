'use client';

import { BadgeCheck, Banknote, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useWorkspace } from '@/features/business/workspace-context';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';

interface Payouts { enabled: boolean; bankName: string | null; accountName: string | null; accountLast4: string | null; enabledAt: string | null; commissionRate: number; provider: 'PAYSTACK' | 'MOCK' | null }
interface Bank { name: string; code: string }

export default function PayoutsPage() {
  const { ws, reload } = useWorkspace();
  const orgId = ws.organization.id;
  const [p, setP] = useState<Payouts | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [resolved, setResolved] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<'resolve' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(() => {
    api<Payouts>(`/organizations/${orgId}/payouts`)
      .then((r) => setP(r.data))
      .catch((e) => (e instanceof ApiError && e.status === 403 ? setForbidden(true) : setError('Could not load payout settings')));
  }, [orgId]);
  useEffect(load, [load]);
  useEffect(() => {
    if (editing || (p && !p.enabled)) api<Bank[]>('/payments/banks').then((r) => setBanks(r.data)).catch(() => undefined);
  }, [editing, p]);

  // Look up the account holder's name as soon as 10 digits are entered.
  useEffect(() => {
    setResolved(null);
    if (!bankCode || !/^\d{10}$/.test(accountNumber)) return;
    setBusy('resolve');
    setError(null);
    api<{ accountName: string }>(`/organizations/${orgId}/payouts/resolve`, { method: 'POST', body: { bankCode, accountNumber } })
      .then((r) => setResolved(r.data.accountName))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not verify account'))
      .finally(() => setBusy(null));
  }, [bankCode, accountNumber, orgId]);

  async function save() {
    setBusy('save');
    setError(null);
    try {
      await api(`/organizations/${orgId}/payouts`, { method: 'PUT', body: { bankCode, accountNumber } });
      setEditing(false);
      setAccountNumber('');
      load();
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not connect account');
    } finally {
      setBusy(null);
    }
  }

  if (forbidden) return <p className="flex items-center gap-2 rounded-2xl bg-white/[0.04] p-4 text-sm text-ink-300"><Lock className="h-4 w-4" /> Only the business owner or staff with billing permission can manage payouts.</p>;
  if (!p) return <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-ink-400" /></div>;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="card p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white"><Banknote className="h-5 w-5 text-sun-400" /> Payouts</h2>
        <p className="mt-1 text-sm text-ink-400">Connect the bank account where customer payments should settle. Once connected, customers can pay you online with Paystack.</p>

        {p.enabled && !editing ? (
          <div className="mt-6 rounded-2xl border border-volt-400/25 bg-volt-500/[0.07] p-5">
            <p className="flex items-center gap-2 font-bold text-volt-200"><BadgeCheck className="h-5 w-5" /> Online payments enabled</p>
            <p className="mt-2 text-sm text-ink-100">{p.accountName}</p>
            <p className="text-sm text-ink-300">{p.bankName} · ••••{p.accountLast4}</p>
            {p.enabledAt && <p className="mt-1 text-xs text-ink-400">Connected {formatDate(p.enabledAt)}</p>}
            <button type="button" onClick={() => setEditing(true)} className="btn btn-secondary mt-4">Change account</button>
          </div>
        ) : (
          <fieldset disabled={busy === 'save'} className="mt-6 space-y-4">
            <label className="block">
              <span className="label">Bank</span>
              <select className="field" value={bankCode} onChange={(e) => setBankCode(e.target.value)}>
                <option value="">Select your bank…</option>
                {banks.map((b) => <option key={`${b.code}-${b.name}`} value={b.code}>{b.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label">Account number (NUBAN)</span>
              <input className="field font-mono tracking-wider" inputMode="numeric" maxLength={10} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))} placeholder="0123456789" />
            </label>
            {busy === 'resolve' && <p className="flex items-center gap-2 text-sm text-ink-400"><Loader2 className="h-4 w-4 animate-spin" /> Verifying account…</p>}
            {resolved && (
              <p className="rounded-xl bg-white/[0.05] p-3 text-sm text-ink-100">
                Account name: <strong>{resolved}</strong>
                <span className="mt-1 block text-xs text-ink-400">Make sure this matches your business or your name as owner.</span>
              </p>
            )}
            {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
            <div className="flex gap-2">
              {p.enabled && <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>}
              <button type="button" className="btn btn-primary" onClick={save} disabled={!resolved || busy !== null}>
                {busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />} Connect account
              </button>
            </div>
          </fieldset>
        )}
      </section>

      <aside className="card h-fit space-y-4 p-6 text-sm text-ink-300">
        <h3 className="font-bold text-white">How payouts work</h3>
        <p>Customers pay through Paystack. The money settles <strong className="text-ink-100">directly to your bank account</strong> on Paystack’s schedule — SOLARIS never holds it.</p>
        <p>SOLARIS’s marketplace commission of <strong className="text-ink-100">{(p.commissionRate * 100).toFixed(1)}%</strong> (on the pre-VAT order value) and Paystack’s processing fee are deducted automatically from each payment.</p>
        <p className="flex items-start gap-2 text-xs text-ink-400"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-volt-400" /> We store only your bank name, account name and the last 4 digits.</p>
        {p.provider === 'MOCK' && <p className="rounded-xl bg-sun-400/10 p-3 text-xs text-sun-200">Test mode: payments are simulated. No real bank account is contacted.</p>}
      </aside>
    </div>
  );
}
