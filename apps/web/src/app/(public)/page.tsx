import {
  ArrowRight,
  BadgeCheck,
  Calculator,
  ClipboardCheck,
  CreditCard,
  FileText,
  Gauge,
  MessageSquare,
  ShoppingBag,
  HardHat,
  House,
  ListPlus,
  MapPin,
  PackageSearch,
  ShieldCheck,
  Sparkles,
  Store,
} from 'lucide-react';
import Link from 'next/link';
import { PowerFlow } from '@/components/power-flow';
import { SegmentedBar } from '@/components/ui/segmented-bar';
import { getSiteConfig } from '@/lib/site-config';

// Layout and icons are fixed by design; all copy comes from Admin → Site content.
const TRUST_ICONS = [ShieldCheck, MapPin, Sparkles];
const STEP_ICONS = [ListPlus, Calculator, ClipboardCheck, BadgeCheck];
const PLATFORM_ICONS = [Calculator, ShoppingBag, MessageSquare, FileText, CreditCard, Gauge];
const HONEST_ICONS = [
  [Calculator, 'text-sun-400'],
  [BadgeCheck, 'text-volt-400'],
  [Gauge, 'text-ink-100'],
] as const;

export default async function HomePage() {
  const { 'content.home': c, features } = await getSiteConfig();
  const primaryHref = features.calculator ? '/calculator' : '/register';
  const audienceMeta = [
    { icon: House, tone: 'sun' as const, href: primaryHref, show: true },
    { icon: HardHat, tone: 'volt' as const, href: '/register?type=INSTALLER', show: features.installerRegistration },
    { icon: Store, tone: 'volt' as const, href: '/register?type=VENDOR', show: features.vendorRegistration },
  ];

  return (
    <>
      {/* Hero */}
      <section className="glow-grid relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pb-28 lg:pt-20">
          <div>
            {c.hero.eyebrow && (
              <span className="pill">
                <MapPin className="h-3.5 w-3.5 text-volt-400" /> {c.hero.eyebrow}
              </span>
            )}
            <h1 className="mt-6 text-[2.6rem] font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl">
              {c.hero.titleLine1}
              {c.hero.titleHighlight && (
                <>
                  <br />
                  <span className="bg-gradient-to-r from-sun-300 via-sun-400 to-volt-400 bg-clip-text text-transparent">{c.hero.titleHighlight}</span>
                </>
              )}
            </h1>
            {c.hero.subtitle && <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-300">{c.hero.subtitle}</p>}
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href={primaryHref} className="btn btn-primary px-7 py-3.5 text-base">
                {c.hero.primaryCtaLabel} <ArrowRight className="h-4 w-4" />
              </Link>
              {c.hero.secondaryCtaLabel && features.installerRegistration && (
                <Link href="/register?type=INSTALLER" className="btn btn-secondary px-7 py-3.5 text-base">
                  {c.hero.secondaryCtaLabel}
                </Link>
              )}
            </div>
            <ul className="mt-9 grid gap-3 text-sm text-ink-300 sm:grid-cols-3">
              {c.hero.trustPoints.filter(Boolean).map((text, i) => {
                const I = TRUST_ICONS[i] ?? Sparkles;
                return (
                  <li key={i} className="flex items-center gap-2">
                    <I className="h-4 w-4 shrink-0 text-volt-400" /> {text}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="card relative p-5 sm:p-7">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-ink-400">Example system · Abuja</p>
                <p className="mt-1 text-2xl font-bold text-white">
                  5 kVA <span className="text-base font-medium text-ink-400">hybrid</span>
                </p>
              </div>
              <span className="pill border-sun-400/30 text-sun-300">Illustrative</span>
            </div>
            <PowerFlow solarLabel="3.3 kWp" homeLabel="1.4 kW" batteryLabel="10.2 kWh" gridLabel="Standby" batteryLevel={0.82} />
            <div className="mt-6 rounded-2xl border border-white/[0.06] bg-ink-900/60 p-4">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-ink-300">Battery reserve</span>
                <span className="font-semibold text-volt-300">82%</span>
              </div>
              <SegmentedBar value={0.82} label="Battery reserve" />
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities strip */}
      <section className="border-y border-white/[0.06] bg-ink-900/50">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-y-8 px-4 py-10 sm:px-6 md:grid-cols-4">
          {c.stats.map((s, i) => (
            <div key={i} className="px-2">
              <div className="text-3xl font-extrabold text-white">{s.value}</div>
              <div className="mt-1 text-sm text-ink-400">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Everything in one app */}
      <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
        <div className="card relative overflow-hidden p-6 sm:p-10">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-secondary)_22%,transparent),transparent_70%)]" />
          <div className="relative grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
            <div>
              {c.platform.eyebrow && <p className="text-sm font-semibold uppercase tracking-[0.18em] text-volt-400">{c.platform.eyebrow}</p>}
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{c.platform.title}</h2>
              {c.platform.body && <p className="mt-4 leading-relaxed text-ink-300">{c.platform.body}</p>}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className="btn btn-primary px-6 py-3">{c.platform.primaryCtaLabel} <ArrowRight className="h-4 w-4" /></Link>
                {c.platform.secondaryCtaLabel && features.marketplace && (
                  <Link href="/marketplace" className="btn btn-secondary px-6 py-3">{c.platform.secondaryCtaLabel}</Link>
                )}
              </div>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {c.platform.items.map((item, i) => {
                const I = PLATFORM_ICONS[i] ?? Sparkles;
                return (
                  <li key={i} className="rounded-2xl border border-white/[0.06] bg-ink-900/60 p-4">
                    <div className="flex items-center justify-between">
                      <span className={`grid h-9 w-9 place-items-center rounded-xl ${item.live ? 'bg-sun-400/15 text-sun-400' : 'bg-white/[0.05] text-ink-400'}`}>
                        <I className="h-4.5 w-4.5" />
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${item.live ? 'bg-volt-500/15 text-volt-300' : 'bg-white/[0.06] text-ink-400'}`}>
                        {item.live ? 'Live' : 'Coming soon'}
                      </span>
                    </div>
                    <h3 className="mt-3 font-bold text-white">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-400">{item.body}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6">
        <SectionHeading eyebrow={c.howItWorks.eyebrow} title={c.howItWorks.title} />
        <ol className="mt-14 grid gap-5 md:grid-cols-4">
          {c.howItWorks.steps.map((step, i) => {
            const I = STEP_ICONS[i] ?? ListPlus;
            return (
              <li key={i} className="card p-6">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-sun-400/10 text-sun-400">
                    <I className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-xs text-ink-400">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-bold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-400">{step.body}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Audiences */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <SectionHeading eyebrow={c.audiences.eyebrow} title={c.audiences.title} />
        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {c.audiences.items.map((a, i) => {
            const meta = audienceMeta[i]!;
            const Icon = meta.icon;
            return (
              <div key={i} className="card flex flex-col p-7">
                <span className={`grid h-12 w-12 place-items-center rounded-2xl ${meta.tone === 'sun' ? 'bg-sun-400 text-ink-950' : 'bg-volt-500/15 text-volt-300'}`}>
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-6 text-xl font-bold text-white">{a.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-400">{a.body}</p>
                <ul className="mt-6 space-y-2.5 text-sm text-ink-300">
                  {a.points.filter(Boolean).map((p) => (
                    <li key={p} className="flex items-center gap-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-volt-400" /> {p}
                    </li>
                  ))}
                </ul>
                {a.ctaLabel && meta.show && (
                  <Link href={meta.href} className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-sun-300 hover:text-sun-200">
                    {a.ctaLabel} <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Trust: estimate vs approved vs measured */}
      <section className="border-t border-white/[0.06] bg-ink-900/40">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <SectionHeading eyebrow={c.honestNumbers.eyebrow} title={c.honestNumbers.title} />
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {c.honestNumbers.items.map((item, i) => {
              const [I, color] = HONEST_ICONS[i] ?? HONEST_ICONS[0];
              return (
                <div key={i} className="card p-7">
                  <I className={`h-6 w-6 ${color}`} />
                  <h3 className="mt-5 text-lg font-bold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-400">{item.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="card relative overflow-hidden p-10 text-center sm:p-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--brand-primary)_16%,transparent),transparent_60%)]" />
          <PackageSearch className="relative mx-auto h-10 w-10 text-sun-400" />
          <h2 className="relative mt-6 text-3xl font-extrabold text-white sm:text-4xl">{c.finalCta.title}</h2>
          {c.finalCta.body && <p className="relative mx-auto mt-4 max-w-xl text-ink-300">{c.finalCta.body}</p>}
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={primaryHref} className="btn btn-primary px-8 py-3.5 text-base">
              {c.finalCta.ctaLabel} <ArrowRight className="h-4 w-4" />
            </Link>
            {c.finalCta.secondaryCtaLabel && features.marketplace && (
              <Link href="/marketplace" className="btn btn-secondary px-8 py-3.5 text-base">{c.finalCta.secondaryCtaLabel}</Link>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="max-w-2xl">
      {eyebrow && <p className="text-sm font-semibold uppercase tracking-[0.18em] text-volt-400">{eyebrow}</p>}
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{title}</h2>
    </div>
  );
}
