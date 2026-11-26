'use client';

import { ArrowRight, BadgeCheck, Clock, Plus, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PowerFlow } from '@/components/power-flow';
import { SegmentedBar } from '@/components/ui/segmented-bar';
import { useAuth } from '@/features/auth/auth-context';
import { useSiteConfig } from '@/features/site/site-config-context';
import { DesignCard } from '@/features/designs/design-card';
import type { DesignSummary } from '@/features/designs/types';
import { api } from '@/lib/api';
import { cn } from '@/lib/format';

/** Clearly labelled sample profile — never presented as measured data. */
const DEMO_HOURLY = [0, 0, 0, 0, 0, 0.05, 0.2, 0.45, 0.8, 1.15, 1.45, 1.6, 1.65, 1.55, 1.35, 1.05, 0.7, 0.35, 0.1, 0, 0, 0, 0, 0];

export default function DashboardPage() {
  const { user } = useAuth();
  const { features } = useSiteConfig();
  const [designs, setDesigns] = useState<DesignSummary[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api<DesignSummary[]>('/solar/designs?pageSize=4')
      .then((r) => {
        setDesigns(r.data);
        setTotal(Number(r.meta?.total ?? r.data.length));
      })
      .catch(() => setDesigns([]));
  }, []);

  if (!user) return null;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-ink-400">{greeting},</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{user.firstName}.</h1>
        </div>
        <Link href="/calculator" className="btn btn-primary self-start sm:self-auto">
          <Plus className="h-4 w-4" /> New solar design
        </Link>
      </header>

      {user.memberships.map(({ organization: org, role }) => (
        <VerificationBanner key={org.id} name={org.name} type={org.types.join(' + ')} status={org.verification} role={role} />
      ))}

      <section className={cn('grid gap-5', features.demoMonitoring && 'lg:grid-cols-[1.3fr_1fr]')}>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Solar designs</p>
              <p className="mt-1 text-4xl font-extrabold text-white">{designs === null ? '—' : total}</p>
            </div>
            <Link href="/designs" className="inline-flex items-center gap-1 text-sm font-semibold text-sun-300 hover:text-sun-200">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {designs?.slice(0, 2).map((d) => <DesignCard key={d.id} d={d} />)}
            {designs?.length === 0 && (
              <Link href="/calculator" className="grid place-items-center rounded-3xl border border-dashed border-white/12 p-8 text-center text-sm text-ink-400 transition hover:border-sun-400/40 hover:text-ink-100 sm:col-span-2">
                <span>
                  <Plus className="mx-auto mb-2 h-6 w-6 text-sun-400" />
                  Run the calculator and save your first design.
                </span>
              </Link>
            )}
          </div>
        </div>

        {features.demoMonitoring && <div className="card p-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Energy monitoring</p>
            <span className="rounded-full bg-sun-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-sun-200">Demo data</span>
          </div>
          <div className="mt-4 px-2">
            <PowerFlow solarLabel="1.6 kW" homeLabel="0.9 kW" batteryLabel="7.8 kWh" gridLabel="Off" batteryLevel={0.76} />
          </div>
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-xs">
              <span className="text-ink-400">Sample generation · 24 h</span>
              <span className="font-semibold text-white">13.0 kWh</span>
            </div>
            <div className="flex h-20 items-end gap-[3px]" aria-hidden>
              {DEMO_HOURLY.map((v, i) => (
                <span
                  key={i}
                  className={cn('flex-1 rounded-t-sm', i === 12 ? 'bg-sun-400' : 'bg-sun-400/35')}
                  style={{ height: `${Math.max(4, (v / 1.65) * 100)}%` }}
                />
              ))}
            </div>
            <div className="mt-5">
              <SegmentedBar value={0.76} segments={16} label="Sample battery level" />
            </div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-ink-400">
            Live monitoring arrives in Release 3, once your installed system and compatible inverter are connected. Figures here are illustrative.
          </p>
        </div>}
      </section>

      <section>
        <h2 className="text-lg font-bold text-white">Coming next</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {nextModules(user.roles).map(([title, body]) => (
            <div key={title} className="card p-5">
              <Clock className="h-5 w-5 text-ink-400" />
              <h3 className="mt-3 font-bold text-white">{title}</h3>
              <p className="mt-1 text-sm text-ink-400">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function nextModules(roles: string[]): Array<[string, string]> {
  if (roles.includes('INSTALLER'))
    return [
      ['Customer leads', 'Receive review requests from customers in your service area.'],
      ['Quotations', 'Turn a customer design into a revision-tracked quotation.'],
      ['Projects', 'Track installation milestones, payments and handover.'],
    ];
  if (roles.includes('VENDOR'))
    return [
      ['Product listings', 'List panels, inverters and batteries with full specifications.'],
      ['Buyer enquiries', 'Respond to buyers who matched your products to their designs.'],
      ['Demand analytics', 'See which system sizes customers are designing by state.'],
    ];
  return [
    ['Installer reviews', 'Send your design to verified installers near you.'],
    ['Quotations', 'Compare quotations side by side with locked-in prices.'],
    ['Installation tracking', 'Follow your project from survey to commissioning.'],
  ];
}

function VerificationBanner({ name, type, status, role }: { name: string; type: string; status: string; role: string }) {
  const verified = status === 'VERIFIED';
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-3xl border p-5 sm:flex-row sm:items-center',
        verified ? 'border-volt-400/25 bg-volt-500/[0.07]' : 'border-sun-400/25 bg-sun-400/[0.06]',
      )}
    >
      {verified ? <BadgeCheck className="h-6 w-6 shrink-0 text-volt-400" /> : <ShieldAlert className="h-6 w-6 shrink-0 text-sun-400" />}
      <div className="flex-1">
        <p className="font-bold text-white">
          {name} <span className="font-medium text-ink-400">· {type.toLowerCase()} · {role.toLowerCase()}</span>
        </p>
        <p className="mt-0.5 text-sm text-ink-300">
          {verified
            ? 'Verified business. You will appear in public listings when the marketplace opens.'
            : status === 'PENDING'
              ? 'Verification pending. Our team will review your CAC registration, credentials and evidence of past work before your business is listed.'
              : `Verification status: ${status.toLowerCase()}. Contact support for details.`}
        </p>
      </div>
    </div>
  );
}
