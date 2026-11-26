'use client';

import { ORDER_STATUS_LABEL } from '@solaris/validation';
import { FileText, Loader2, Receipt } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ORDER_STATUS_STYLE, QUOTE_STATUS_STYLE, type OrderSummary, type QuoteSummary } from '@/features/commerce/types';
import { OrgAvatar } from '@/features/marketplace/cards';
import { api } from '@/lib/api';
import { cn, formatDate, formatNaira } from '@/lib/format';

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersView />
    </Suspense>
  );
}

function OrdersView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = params.get('tab') === 'quotes' ? 'quotes' : 'orders';
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [quotes, setQuotes] = useState<QuoteSummary[] | null>(null);

  useEffect(() => {
    api<OrderSummary[]>('/orders').then((r) => setOrders(r.data)).catch(() => setOrders([]));
    api<QuoteSummary[]>('/quotations').then((r) => setQuotes(r.data)).catch(() => setQuotes([]));
  }, []);

  const pendingQuotes = quotes?.filter((q) => q.status === 'SENT').length ?? 0;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-extrabold tracking-tight text-white">Quotes & orders</h1>
      <p className="mt-1 text-ink-400">Quotations from sellers and installers, and everything you’ve ordered on SOLARIS.</p>

      <div className="mt-6 flex gap-1 self-start rounded-full border border-white/[0.07] bg-white/[0.03] p-1 sm:w-fit">
        {(['orders', 'quotes'] as const).map((t) => (
          <button key={t} type="button" onClick={() => router.replace(`${pathname}${t === 'quotes' ? '?tab=quotes' : ''}`)} className={cn('flex-1 rounded-full px-5 py-1.5 text-sm font-semibold sm:flex-none', tab === t ? 'bg-white text-ink-950' : 'text-ink-300')}>
            {t === 'orders' ? 'Orders' : 'Quotations'}
            {t === 'quotes' && pendingQuotes > 0 && <span className="ml-2 rounded-full bg-sun-400 px-1.5 text-[10px] font-bold text-ink-950">{pendingQuotes}</span>}
          </button>
        ))}
      </div>

      <div className="card mt-6 divide-y divide-white/[0.06] p-0">
        {tab === 'orders' && (
          <>
            {orders === null && <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-ink-400" /></div>}
            {orders?.length === 0 && <Empty icon={Receipt} text="No orders yet. Accept a quotation from a seller or installer to create one." />}
            {orders?.map((o) => (
              <Link key={o.id} href={`/orders/${o.id}`} className="flex items-center gap-4 p-4 hover:bg-white/[0.03] sm:p-5">
                {o.organization && <OrgAvatar org={o.organization} size={40} />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{o.organization?.name}</p>
                  <p className="text-xs text-ink-400"><span className="font-mono">{o.reference}</span> · {formatDate(o.createdAt)} · {o._count.items} item{o._count.items === 1 ? '' : 's'}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-white">{formatNaira(o.total)}</p>
                  <span className={cn('mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold', ORDER_STATUS_STYLE[o.status])}>{ORDER_STATUS_LABEL[o.status]}</span>
                </div>
              </Link>
            ))}
          </>
        )}
        {tab === 'quotes' && (
          <>
            {quotes === null && <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-ink-400" /></div>}
            {quotes?.length === 0 && <Empty icon={FileText} text="No quotations yet. Message a seller or send your design to an installer to request one." />}
            {quotes?.map((q) => (
              <Link key={q.id} href={`/quotes/${q.id}`} className="flex items-center gap-4 p-4 hover:bg-white/[0.03] sm:p-5">
                {q.organization && <OrgAvatar org={q.organization} size={40} />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{q.title ?? q.organization?.name}</p>
                  <p className="text-xs text-ink-400"><span className="font-mono">{q.reference}</span> · {q.organization?.name}{q.expiresAt && q.status === 'SENT' ? ` · valid until ${formatDate(q.expiresAt)}` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-white">{q.total !== null ? formatNaira(q.total) : '—'}</p>
                  <span className={cn('mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold', QUOTE_STATUS_STYLE[q.status].className)}>{QUOTE_STATUS_STYLE[q.status].label}</span>
                </div>
              </Link>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function Empty({ icon: Icon, text }: { icon: typeof Receipt; text: string }) {
  return (
    <div className="p-10 text-center text-sm text-ink-400">
      <Icon className="mx-auto mb-3 h-8 w-8" />
      {text}
    </div>
  );
}
