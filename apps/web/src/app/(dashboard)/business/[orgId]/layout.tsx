'use client';

import { BadgeCheck, Clock, ExternalLink, LayoutGrid, MessageSquare, Package, ShieldAlert, Store, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useWorkspace, WorkspaceProvider } from '@/features/business/workspace-context';
import { cn } from '@/lib/format';

export default function BusinessWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { orgId } = useParams<{ orgId: string }>();
  return (
    <WorkspaceProvider orgId={orgId}>
      <Shell>{children}</Shell>
    </WorkspaceProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { ws } = useWorkspace();
  const pathname = usePathname();
  const o = ws.organization;
  const base = `/business/${o.id}`;
  const tabs = [
    { href: base, label: 'Overview', icon: LayoutGrid },
    { href: `${base}/profile`, label: 'Storefront', icon: Store },
    ...(o.types.includes('VENDOR') || ws.counts.productsPublished + ws.counts.productsDraft > 0 ? [{ href: `${base}/products`, label: 'Products', icon: Package }] : []),
    ...(o.types.includes('INSTALLER') || ws.counts.servicesPublished + ws.counts.servicesDraft > 0 ? [{ href: `${base}/services`, label: 'Services', icon: Wrench }] : []),
    { href: `/messages?inbox=${o.id}`, label: 'Customer messages', icon: MessageSquare },
  ];
  const active = (href: string) => (href === base ? pathname === base : pathname.startsWith(href));

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Business workspace · {ws.role.toLowerCase()}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white">{o.name}</h1>
        </div>
        {ws.publiclyVisible && (
          <Link href={`/store/${o.slug}`} target="_blank" className="btn btn-secondary self-start">
            View public storefront <ExternalLink className="h-4 w-4" />
          </Link>
        )}
      </header>

      <VisibilityBanner />

      <nav className="no-print mt-6 flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1 [scrollbar-width:none]" aria-label="Business workspace">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className={cn('flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition', active(t.href) ? 'bg-white text-ink-950' : 'text-ink-300 hover:bg-white/[0.05] hover:text-white')}>
            <t.icon className="h-4 w-4" /> {t.label}
          </Link>
        ))}
      </nav>

      <div className="mt-8">{children}</div>
    </div>
  );
}

function VisibilityBanner() {
  const { ws } = useWorkspace();
  const o = ws.organization;
  if (ws.publiclyVisible) {
    return (
      <p className="mt-5 flex items-center gap-2 rounded-2xl border border-volt-400/25 bg-volt-500/[0.07] p-3 text-sm text-volt-200">
        <BadgeCheck className="h-4 w-4 shrink-0" /> Verified — your published listings are live in the marketplace and customers can message you.
      </p>
    );
  }
  const text =
    o.hiddenAt ? 'Your storefront is currently hidden from the marketplace by SOLARIS. Contact support for details.'
    : o.verification === 'PENDING' ? 'Verification pending. Build your storefront and listings now — they go live automatically once SOLARIS verifies your business.'
    : `Verification status: ${o.verification.toLowerCase()}.${o.verificationNote ? ` Note: ${o.verificationNote}` : ''} Contact support to resolve.`;
  return (
    <p className="mt-5 flex items-start gap-2 rounded-2xl border border-sun-400/25 bg-sun-400/[0.06] p-3 text-sm text-sun-100">
      {o.verification === 'PENDING' ? <Clock className="mt-0.5 h-4 w-4 shrink-0 text-sun-400" /> : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-sun-400" />}
      {text}
    </p>
  );
}
