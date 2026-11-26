'use client';

import Link from 'next/link';
import { useSiteConfig } from '@/features/site/site-config-context';
import { cn } from '@/lib/format';

/** Default mark: a sun arc over a horizon with a charge notch, in brand colours. */
export function BrandMark({ className }: { className?: string }) {
  const p = { stroke: 'var(--brand-primary)' };
  const s = { stroke: 'var(--brand-secondary)' };
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('h-8 w-8', className)}>
      <defs>
        <linearGradient id="sx-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--brand-primary)' }} />
          <stop offset="1" style={{ stopColor: 'var(--brand-secondary)' }} />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="#0f1829" />
      <path d="M7 20a9 9 0 0 1 18 0" fill="none" stroke="url(#sx-g)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M16 8v2.5M9.2 10.6l1.6 1.8M22.8 10.6l-1.6 1.8" style={p} strokeWidth="2" strokeLinecap="round" />
      <path d="M5.5 23.5h21" style={s} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M17 13.5l-3 4.2h3.2l-1.6 3.8" fill="none" stroke="#fef3a3" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Logo + name from the admin Branding settings. */
export function Brand({ href = '/', className }: { href?: string; className?: string }) {
  const { branding } = useSiteConfig();
  return (
    <Link href={href} className={cn('flex items-center gap-2.5', className)} aria-label={`${branding.siteName} home`}>
      {branding.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={branding.logoUrl} alt="" className="h-8 w-auto max-w-[120px] object-contain" />
      ) : (
        <BrandMark />
      )}
      <span className="text-[17px] font-extrabold tracking-[0.14em] text-white">{branding.siteName}</span>
    </Link>
  );
}
