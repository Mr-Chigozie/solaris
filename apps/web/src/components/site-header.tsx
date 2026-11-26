'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Brand } from '@/components/brand';
import { useAuth } from '@/features/auth/auth-context';
import { useSiteConfig } from '@/features/site/site-config-context';
import { cn } from '@/lib/format';

const NAV = [
  { href: '/calculator', label: 'Solar Calculator', flag: 'calculator' },
  { href: '/marketplace', label: 'Marketplace', flag: 'marketplace' },
  { href: '/installers', label: 'Find Installers', flag: 'installerDirectory' },
  { href: '/#how-it-works', label: 'How It Works' },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const { status } = useAuth();
  const [open, setOpen] = useState(false);
  const { features } = useSiteConfig();
  const nav = NAV.filter((item) => !('flag' in item) || features[item.flag]);

  return (
    <header className="no-print sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Brand />

        <nav className="hidden items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.03] p-1 lg:flex" aria-label="Main">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition',
                pathname === item.href ? 'bg-white/[0.09] text-white' : 'text-ink-300 hover:text-white',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {status === 'authenticated' ? (
            <Link href="/dashboard" className="btn btn-primary">Dashboard</Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost">Log in</Link>
              <Link href="/register" className="btn btn-primary">Get started</Link>
            </>
          )}
        </div>

        <button className="btn btn-ghost px-2.5 lg:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Toggle menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/[0.06] px-4 pb-5 pt-2 lg:hidden">
          <nav className="flex flex-col" aria-label="Mobile">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-[15px] font-medium text-ink-100 hover:bg-white/[0.05]">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {status === 'authenticated' ? (
              <Link href="/dashboard" className="btn btn-primary col-span-2">Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-secondary">Log in</Link>
                <Link href="/register" className="btn btn-primary">Get started</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
