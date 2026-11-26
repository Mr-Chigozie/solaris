'use client';

import { ArrowRight, CheckCircle2, Circle, MessageSquare, Package, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useWorkspace } from '@/features/business/workspace-context';
import { cn } from '@/lib/format';

export default function BusinessOverviewPage() {
  const { ws } = useWorkspace();
  const o = ws.organization;
  const base = `/business/${o.id}`;
  const sells = o.types.includes('VENDOR');
  const installs = o.types.includes('INSTALLER');

  const checklist = [
    { done: Boolean(o.logoUrl), label: 'Add your logo', href: `${base}/profile` },
    { done: Boolean(o.description && o.description.length > 40), label: 'Describe your business', href: `${base}/profile` },
    { done: o.serviceStates.length > 0, label: 'Choose the states you serve', href: `${base}/profile` },
    ...(sells ? [{ done: ws.counts.productsPublished > 0, label: 'Publish your first product', href: `${base}/products/new` }] : []),
    ...(installs ? [{ done: ws.counts.servicesPublished > 0, label: 'Publish your first service', href: `${base}/services` }] : []),
    { done: o.verification === 'VERIFIED', label: 'Get verified by SOLARIS', href: `${base}/profile` },
  ];
  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {sells && <Stat icon={Package} label="Products live" value={ws.counts.productsPublished} sub={`${ws.counts.productsDraft} draft`} href={`${base}/products`} />}
          {installs && <Stat icon={Wrench} label="Services live" value={ws.counts.servicesPublished} sub={`${ws.counts.servicesDraft} draft`} href={`${base}/services`} />}
          <Stat icon={MessageSquare} label="Customer conversations" value={ws.counts.conversations} sub="Open inbox" href={`/messages?inbox=${o.id}`} />
        </div>

        <section className="card p-6">
          <h2 className="text-lg font-bold text-white">Run your solar business on SOLARIS</h2>
          <p className="mt-2 text-sm text-ink-300">
            Customers find you in the marketplace{installs ? ' and installer directory' : ''}, message you directly, and soon request quotations, place orders and track installations — all in one place.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {sells && <Link href={`${base}/products/new`} className="btn btn-primary">Add a product</Link>}
            {installs && <Link href={`${base}/services`} className={cn('btn', sells ? 'btn-secondary' : 'btn-primary')}>Add a service</Link>}
            <Link href={`${base}/profile`} className="btn btn-secondary">Edit storefront</Link>
          </div>
        </section>
      </div>

      <aside className="card h-fit p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold text-white">Get ready to sell</h2>
          <span className="text-sm font-semibold text-sun-300">{doneCount}/{checklist.length}</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <div className="h-full rounded-full bg-gradient-to-r from-sun-400 to-volt-400 transition-all" style={{ width: `${(doneCount / checklist.length) * 100}%` }} />
        </div>
        <ul className="mt-5 space-y-1">
          {checklist.map((c) => (
            <li key={c.label}>
              <Link href={c.href} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-white/[0.04]">
                {c.done ? <CheckCircle2 className="h-5 w-5 text-volt-400" /> : <Circle className="h-5 w-5 text-ink-600" />}
                <span className={c.done ? 'text-ink-400 line-through' : 'text-ink-100'}>{c.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, href }: { icon: typeof Package; label: string; value: number; sub: string; href: string }) {
  return (
    <Link href={href} className="card group p-5 hover:border-white/15">
      <Icon className="h-5 w-5 text-sun-400" />
      <div className="mt-3 text-3xl font-extrabold text-white">{value}</div>
      <div className="text-xs text-ink-400">{label}</div>
      <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-ink-300 group-hover:text-white">{sub} <ArrowRight className="h-3 w-3" /></div>
    </Link>
  );
}
