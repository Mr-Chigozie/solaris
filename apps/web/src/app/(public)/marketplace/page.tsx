import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { MarketplaceBrowser } from '@/features/marketplace/marketplace-browser';
import { getSiteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Marketplace',
  description: 'Solar panels, inverters and batteries from verified Nigerian sellers. Compare and message sellers directly.',
};

export default async function MarketplacePage() {
  if (!(await getSiteConfig()).features.marketplace) notFound();
  return (
    <Suspense>
      <MarketplaceBrowser />
    </Suspense>
  );
}
