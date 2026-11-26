'use client';

import { ArrowRight, BadgeCheck, Building2, EyeOff, FileStack, Flag, Megaphone, Palette, ShieldQuestion, Star, Store, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAdminAccess, type AdminRole } from '@/features/admin/use-admin';
import { useSiteConfig } from '@/features/site/site-config-context';
import { api } from '@/lib/api';
import { cn } from '@/lib/format';

interface Overview { users: number; organizations: number; pendingVerifications: number; designs: number; featured: number; hidden: number }

const SHORTCUTS: Array<{ href: string; title: string; body: string; icon: typeof Flag; roles: AdminRole[] }> = [
  { href: '/admin/content', title: 'Edit site content', body: 'Homepage copy, footer, announcement banner.', icon: Megaphone, roles: ['CONTENT_EDITOR'] },
  { href: '/admin/branding', title: 'Branding & SEO', body: 'Name, logo, colours, font, corners, search metadata.', icon: Palette, roles: ['CONTENT_EDITOR'] },
  { href: '/admin/features', title: 'Feature toggles', body: 'Switch modules and sign-ups on/off, maintenance mode.', icon: Flag, roles: ['SUPER_ADMIN'] },
  { href: '/admin/curation', title: 'Marketplace curation', body: 'Feature or hide businesses, appliances, reference prices.', icon: Store, roles: ['MARKETPLACE_CURATOR'] },
  { href: '/admin/verification', title: 'Verify businesses', body: 'Review installers and vendors waiting for approval.', icon: BadgeCheck, roles: ['OPERATIONS'] },
];

export default function AdminOverviewPage() {
  const { can } = useAdminAccess();
  const { features, announcement } = useSiteConfig();
  const [o, setO] = useState<Overview | null>(null);

  useEffect(() => {
    api<Overview>('/admin/overview').then((r) => setO(r.data)).catch(() => undefined);
  }, []);

  const status = [
    { label: 'Maintenance mode', on: features.maintenanceMode, bad: true },
    { label: 'Calculator', on: features.calculator },
    { label: 'Marketplace', on: features.marketplace },
    { label: 'Customer sign-up', on: features.consumerRegistration },
    { label: 'Announcement banner', on: announcement.enabled },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat icon={Users} label="Users" value={o?.users} />
        <Stat icon={Building2} label="Businesses" value={o?.organizations} />
        <Stat icon={ShieldQuestion} label="Pending verification" value={o?.pendingVerifications} highlight={Boolean(o?.pendingVerifications)} />
        <Stat icon={FileStack} label="Saved designs" value={o?.designs} />
        <Stat icon={Star} label="Featured businesses" value={o?.featured} />
        <Stat icon={EyeOff} label="Hidden businesses" value={o?.hidden} />
      </div>

      <section className="card p-5 sm:p-6">
        <h2 className="text-base font-bold text-white">Live site status</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {status.map((s) => (
            <span
              key={s.label}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold',
                s.on ? (s.bad ? 'bg-red-500/15 text-red-200' : 'bg-volt-500/15 text-volt-200') : 'bg-white/[0.05] text-ink-400',
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', s.on ? (s.bad ? 'bg-red-400' : 'bg-volt-400') : 'bg-ink-400')} />
              {s.label}: {s.on ? 'On' : 'Off'}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SHORTCUTS.filter((s) => can(...s.roles)).map((s) => (
          <Link key={s.href} href={s.href} className="card group p-5 transition hover:border-white/15">
            <s.icon className="h-5 w-5 text-sun-400" />
            <h3 className="mt-4 flex items-center gap-1.5 font-bold text-white">
              {s.title} <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
            </h3>
            <p className="mt-1 text-sm text-ink-400">{s.body}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value, highlight }: { icon: typeof Users; label: string; value?: number; highlight?: boolean }) {
  return (
    <div className="card p-5">
      <Icon className={cn('h-5 w-5', highlight ? 'text-sun-400' : 'text-ink-400')} />
      <div className="mt-3 text-3xl font-extrabold text-white">{value ?? '—'}</div>
      <div className="text-xs text-ink-400">{label}</div>
    </div>
  );
}
