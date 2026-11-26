import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ComingSoon } from '@/components/coming-soon';
import { getSiteConfig } from '@/lib/site-config';

export const metadata: Metadata = { title: 'Marketplace' };

export default async function MarketplacePage() {
  if (!(await getSiteConfig()).features.marketplace) notFound();
  return (
    <ComingSoon
      release="Release 2 · Commercial platform"
      title="Solar equipment marketplace"
      body="Panels, inverters and batteries from verified Nigerian distributors, matched to the system you designed. Vendor onboarding opens soon."
    />
  );
}
