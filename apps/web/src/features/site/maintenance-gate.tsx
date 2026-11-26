'use client';

import { Wrench } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandMark } from '@/components/brand';
import { useAuth } from '@/features/auth/auth-context';
import { useSiteConfig } from './site-config-context';

/** Paths that stay reachable during maintenance so staff can sign in and switch it off. */
const ALWAYS_OPEN = ['/login', '/admin'];

export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { features, branding } = useSiteConfig();
  const { status, hasRole } = useAuth();
  const pathname = usePathname();

  if (!features.maintenanceMode) return <>{children}</>;
  if (ALWAYS_OPEN.some((p) => pathname.startsWith(p))) return <>{children}</>;
  if (status === 'loading') return null;
  if (hasRole('ADMIN')) {
    return (
      <>
        <div className="no-print sticky top-0 z-50 bg-sun-400 px-4 py-1.5 text-center text-xs font-bold text-ink-950">
          Maintenance mode is ON — the public sees a maintenance page. <Link href="/admin/features" className="underline">Turn it off</Link>
        </div>
        {children}
      </>
    );
  }

  return (
    <main className="glow-grid grid min-h-dvh place-items-center px-4">
      <div className="card max-w-md p-10 text-center">
        <BrandMark className="mx-auto h-12 w-12" />
        <Wrench className="mx-auto mt-6 h-6 w-6 text-sun-400" />
        <h1 className="mt-4 text-2xl font-extrabold text-white">{branding.siteName} will be back soon</h1>
        <p className="mt-3 text-ink-300">{features.maintenanceMessage}</p>
      </div>
    </main>
  );
}
