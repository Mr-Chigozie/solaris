'use client';

import {
  Briefcase,
  Calculator,
  FileText,
  FolderKanban,
  Gauge,
  LayoutGrid,
  LogOut,
  MessageSquare,
  ShieldCheck,
  ShoppingBag,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Brand } from '@/components/brand';
import { useAuth } from '@/features/auth/auth-context';
import { api, type CurrentUser } from '@/lib/api';
import { cn } from '@/lib/format';

type Role = CurrentUser['roles'][number];

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[] | 'all';
  soon?: boolean;
  mobile?: boolean;
  badge?: 'messages';
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutGrid, roles: 'all', mobile: true },
  { href: '/designs', label: 'My solar designs', icon: Sun, roles: 'all', mobile: true },
  { href: '/messages', label: 'Messages', icon: MessageSquare, roles: 'all', mobile: true, badge: 'messages' },
  { href: '/business', label: 'My business', icon: Briefcase, roles: 'all', mobile: true },
  { href: '/marketplace', label: 'Marketplace', icon: ShoppingBag, roles: 'all' },
  { href: '/calculator', label: 'Calculator', icon: Calculator, roles: 'all' },
  { href: '#quotations', label: 'Quotations', icon: FileText, roles: 'all', soon: true },
  { href: '#projects', label: 'Projects & orders', icon: FolderKanban, roles: 'all', soon: true },
  { href: '#monitoring', label: 'My solar systems', icon: Gauge, roles: ['CONSUMER'], soon: true },
  { href: '/admin', label: 'Administration', icon: ShieldCheck, roles: ['ADMIN'], mobile: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status, user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, pathname, router]);

  // Unread message badge (polled; real-time push comes later).
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (status !== 'authenticated') return;
    const tick = () => api<{ total: number }>('/conversations/unread-count').then((r) => setUnread(r.data.total)).catch(() => undefined);
    void tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, [status, pathname]);

  if (status !== 'authenticated' || !user) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-sun-400" aria-label="Loading" />
      </div>
    );
  }

  const items = NAV.filter((i) => i.roles === 'all' || i.roles.some((r) => user.roles.includes(r)));
  const isActive = (href: string) => (href === '/dashboard' ? pathname === href : pathname.startsWith(href));
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r border-white/[0.06] bg-ink-900/60 px-4 py-6 lg:flex">
        <Brand href="/dashboard" className="px-2" />
        <nav className="mt-10 flex-1 space-y-1" aria-label="Dashboard">
          {items.map((i) =>
            i.soon ? (
              <span key={i.href} className="flex cursor-default items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-400/70">
                <i.icon className="h-4.5 w-4.5" /> {i.label}
                <span className="ml-auto rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">Soon</span>
              </span>
            ) : (
              <Link
                key={i.href}
                href={i.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isActive(i.href) ? 'bg-white/[0.08] text-white' : 'text-ink-300 hover:bg-white/[0.04] hover:text-white',
                )}
              >
                <i.icon className={cn('h-4.5 w-4.5', isActive(i.href) && 'text-sun-400')} /> {i.label === 'My business' && user.memberships.length === 0 ? 'Sell or install' : i.label}
                {i.badge === 'messages' && unread > 0 && <span className="ml-auto rounded-full bg-sun-400 px-2 py-0.5 text-[10px] font-bold text-ink-950">{unread}</span>}
              </Link>
            ),
          )}
        </nav>
        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-sun-400 to-volt-500 text-xs font-extrabold text-ink-950">{initials}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{user.firstName} {user.lastName}</div>
            <div className="truncate text-xs text-ink-400">{user.email}</div>
          </div>
          <button
            type="button"
            onClick={async () => {
              await logout();
              router.replace('/');
            }}
            className="btn btn-ghost px-2"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.06] bg-ink-950/80 px-4 backdrop-blur-xl lg:hidden">
        <Brand href="/dashboard" />
        <button type="button" onClick={async () => { await logout(); router.replace('/'); }} className="btn btn-ghost px-2" aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <main className="min-w-0 px-4 pb-28 pt-6 sm:px-8 lg:pb-12 lg:pt-10">{children}</main>

      {/* Mobile bottom navigation */}
      <nav className="no-print fixed inset-x-0 bottom-4 z-30 mx-auto flex w-fit gap-1 rounded-full border border-white/10 bg-ink-850/95 p-1.5 shadow-2xl backdrop-blur-xl lg:hidden" aria-label="Dashboard mobile">
        {items.filter((i) => i.mobile).map((i) => (
          <Link
            key={i.href}
            href={i.href}
            aria-label={i.label}
            className={cn('relative grid h-12 w-14 place-items-center rounded-full transition', isActive(i.href) ? 'bg-sun-400 text-ink-950' : 'text-ink-300')}
          >
            <i.icon className="h-5 w-5" />
            {i.badge === 'messages' && unread > 0 && <span className="absolute right-2.5 top-2 h-2.5 w-2.5 rounded-full bg-sun-400 ring-2 ring-ink-850" aria-label={`${unread} unread`} />}
          </Link>
        ))}
      </nav>
    </div>
  );
}
