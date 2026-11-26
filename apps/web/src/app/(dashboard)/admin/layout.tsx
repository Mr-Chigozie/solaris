'use client';

import { BadgeCheck, Flag, LayoutDashboard, Megaphone, Palette, ScrollText, Store, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ADMIN_ROLE_LABEL, useAdminAccess, type AdminRole } from '@/features/admin/use-admin';
import { cn } from '@/lib/format';

const TABS: Array<{ href: string; label: string; icon: typeof Flag; roles: AdminRole[] }> = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, roles: [] },
  { href: '/admin/content', label: 'Site content', icon: Megaphone, roles: ['CONTENT_EDITOR'] },
  { href: '/admin/branding', label: 'Branding & SEO', icon: Palette, roles: ['CONTENT_EDITOR'] },
  { href: '/admin/features', label: 'Features', icon: Flag, roles: ['SUPER_ADMIN'] },
  { href: '/admin/curation', label: 'Marketplace', icon: Store, roles: ['MARKETPLACE_CURATOR'] },
  { href: '/admin/verification', label: 'Verification', icon: BadgeCheck, roles: ['OPERATIONS'] },
  { href: '/admin/team', label: 'Admin team', icon: UsersRound, roles: ['SUPER_ADMIN'] },
  { href: '/admin/audit', label: 'Audit log', icon: ScrollText, roles: ['OPERATIONS'] },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAdmin, roles, can } = useAdminAccess();

  if (!isAdmin) return <p className="text-ink-400">You do not have access to administration.</p>;

  const tabs = TABS.filter((t) => can(...t.roles));
  const active = (href: string) => (href === '/admin' ? pathname === href : pathname.startsWith(href));

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Administration</h1>
          <p className="mt-1 text-sm text-ink-400">Every change is versioned and recorded in the audit log.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {roles.map((r) => (
            <span key={r} className="rounded-full bg-sun-400/10 px-2.5 py-1 text-[11px] font-semibold text-sun-200">{ADMIN_ROLE_LABEL[r].label}</span>
          ))}
          {roles.length === 0 && <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-ink-300">No admin role assigned</span>}
        </div>
      </header>

      <nav className="no-print mt-6 flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1 [scrollbar-width:none]" aria-label="Administration">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition',
              active(t.href) ? 'bg-white text-ink-950' : 'text-ink-300 hover:bg-white/[0.05] hover:text-white',
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </Link>
        ))}
      </nav>

      <div className="mt-8">{children}</div>
    </div>
  );
}
