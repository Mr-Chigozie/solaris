'use client';

import { ORDER_STATUS_LABEL, type OrderStatusName } from '@solaris/validation';
import { Loader2, Receipt } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useWorkspace } from '@/features/business/workspace-context';
import { ORDER_STATUS_STYLE, type OrderSummary } from '@/features/commerce/types';
import { api, ApiError } from '@/lib/api';
import { cn, formatDate, formatNaira } from '@/lib/format';

const FILTERS: Array<OrderStatusName | ''> = ['', 'PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'];

export default function BusinessOrdersPage() {
  const { ws } = useWorkspace();
  const [filter, setFilter] = useState<OrderStatusName | ''>('');
  const [items, setItems] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(null);
    api<OrderSummary[]>(`/organizations/${ws.organization.id}/orders${filter ? `?status=${filter}` : ''}`)
      .then((r) => setItems(r.data))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load orders'));
  }, [ws.organization.id, filter]);

  const toFulfil = items?.filter((o) => ['PAID', 'PROCESSING', 'READY'].includes(o.status)).length ?? 0;

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Orders</h2>
          <p className="mt-1 text-sm text-ink-400">Orders are created when customers accept your quotations. Paid orders need fulfilling.</p>
        </div>
        {toFulfil > 0 && !filter && <span className="self-start rounded-full bg-sun-400/15 px-3 py-1 text-xs font-bold text-sun-200">{toFulfil} to fulfil</span>}
      </div>
      <div className="mt-5 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f || 'all'} type="button" onClick={() => setFilter(f)} className={cn('rounded-full px-3 py-1.5 text-xs font-semibold', filter === f ? 'bg-white text-ink-950' : 'bg-white/[0.05] text-ink-300')}>
            {f ? ORDER_STATUS_LABEL[f] : 'All'}
          </button>
        ))}
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      {items === null && !error && <div className="grid h-32 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-ink-400" /></div>}
      {items?.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-ink-400">
          <Receipt className="mx-auto mb-3 h-8 w-8" /> No orders here yet.
        </div>
      )}
      <div className="mt-4 divide-y divide-white/[0.06]">
        {items?.map((o) => (
          <Link key={o.id} href={`/orders/${o.id}`} className="flex items-center gap-4 py-4 hover:bg-white/[0.02]">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white">{o.customer?.firstName} {o.customer?.lastName}</p>
              <p className="text-xs text-ink-400"><span className="font-mono">{o.reference}</span> · {formatDate(o.createdAt)} · {o._count.items} item{o._count.items === 1 ? '' : 's'}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-white">{formatNaira(o.total)}</p>
              <span className={cn('mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold', ORDER_STATUS_STYLE[o.status])}>{ORDER_STATUS_LABEL[o.status]}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
