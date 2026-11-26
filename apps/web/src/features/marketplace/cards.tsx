import { PRODUCT_CATEGORY_LABEL, SERVICE_CATEGORY_LABEL } from '@solaris/validation';
import { BadgeCheck, MapPin, Package, Star, Wrench } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/format';
import { headlineSpec, productPrice, servicePrice, stockLabel, type OrgCard, type ProductCardData, type ServiceData } from './types';

export function VerifiedBadge({ org, className }: { org: Pick<OrgCard, 'isPlatformOwned' | 'verification'>; className?: string }) {
  if (org.isPlatformOwned) {
    return <span className={cn('inline-flex items-center gap-1 rounded-full bg-sun-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sun-200', className)}>Official</span>;
  }
  if (org.verification !== 'VERIFIED') return null;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold text-volt-300', className)} title="Business registration, credentials and past work reviewed by SOLARIS">
      <BadgeCheck className="h-3.5 w-3.5" /> Verified
    </span>
  );
}

export function OrgAvatar({ org, size = 40 }: { org: Pick<OrgCard, 'name' | 'logoUrl'>; size?: number }) {
  return org.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={org.logoUrl} alt="" width={size} height={size} className="shrink-0 rounded-xl bg-white/5 object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sun-400/25 to-volt-500/25 font-extrabold text-white" style={{ width: size, height: size, fontSize: size / 2.6 }}>
      {org.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function ProductCard({ p }: { p: ProductCardData }) {
  const stock = stockLabel(p);
  const spec = headlineSpec(p);
  const org = p.organization;
  const href = org ? `/marketplace/${org.slug}/${p.slug}` : '#';
  return (
    <Link href={href} className="card group flex flex-col overflow-hidden p-0 transition hover:border-white/15">
      <div className="relative aspect-[4/3] bg-ink-900/70">
        {p.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.images[0]} alt={p.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="grid h-full place-items-center"><Package className="h-10 w-10 text-ink-600" /></div>
        )}
        {p.isFeatured && <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-sun-400 px-2 py-0.5 text-[10px] font-bold text-ink-950"><Star className="h-3 w-3 fill-current" /> Featured</span>}
        {spec && <span className="absolute bottom-3 left-3 rounded-full bg-ink-950/80 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">{spec}</span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{p.brand ?? PRODUCT_CATEGORY_LABEL[p.category]}</p>
        <h3 className="mt-1 line-clamp-2 font-bold leading-snug text-white group-hover:text-sun-200">{p.name}</h3>
        <div className="mt-auto pt-4">
          <div className="flex items-end justify-between gap-2">
            <span className="text-lg font-extrabold text-sun-300">{productPrice(p)}</span>
            <span className={cn('text-[11px] font-semibold', stock.tone === 'out' ? 'text-red-300' : stock.tone === 'low' ? 'text-sun-300' : 'text-volt-300')}>{stock.text}</span>
          </div>
          {org && (
            <div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-3 text-xs text-ink-400">
              <span className="truncate">{org.name}</span>
              <VerifiedBadge org={org} />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export function BusinessCard({ org }: { org: OrgCard }) {
  return (
    <Link href={`/store/${org.slug}`} className="card group flex flex-col p-5 transition hover:border-white/15">
      <div className="flex items-start gap-3">
        <OrgAvatar org={org} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-bold text-white group-hover:text-sun-200">{org.name}</h3>
            <VerifiedBadge org={org} />
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-400"><MapPin className="h-3 w-3" /> {[org.city, org.state].filter(Boolean).join(', ') || 'Nigeria'}</p>
        </div>
        {org.isFeatured && <Star className="h-4 w-4 shrink-0 fill-sun-400 text-sun-400" />}
      </div>
      {org.tagline && <p className="mt-3 line-clamp-2 text-sm text-ink-300">{org.tagline}</p>}
      <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
        {org.types.map((t) => <span key={t} className="pill py-0.5 text-[10px] uppercase tracking-wider">{t === 'VENDOR' ? 'Sells equipment' : t === 'INSTALLER' ? 'Installs' : t}</span>)}
        {org._count && <span className="pill py-0.5 text-[10px]">{org._count.products} products · {org._count.services} services</span>}
      </div>
    </Link>
  );
}

export function ServiceRow({ s, showOrg = true }: { s: ServiceData; showOrg?: boolean }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-white/[0.06] bg-ink-900/50 p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-volt-500/15 text-volt-300"><Wrench className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-bold text-white">{s.title}</h4>
          <span className="text-sm font-bold text-sun-300">{servicePrice(s)}</span>
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">{SERVICE_CATEGORY_LABEL[s.category]}</p>
        {s.description && <p className="mt-2 line-clamp-3 text-sm text-ink-300">{s.description}</p>}
        {showOrg && s.organization && (
          <Link href={`/store/${s.organization.slug}`} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-ink-300 hover:text-white">
            {s.organization.name} <VerifiedBadge org={s.organization} />
          </Link>
        )}
      </div>
    </div>
  );
}
