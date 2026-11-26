import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';
import { Calculator } from '@/features/calculator/calculator';
import { getSiteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Solar calculator',
  description: 'Free solar sizing for Nigerian homes and businesses: panels, batteries, inverter and estimated cost in naira.',
};

export default async function CalculatorPage() {
  const { features } = await getSiteConfig();
  if (!features.calculator) {
    return (
      <ComingSoon
        release="Temporarily unavailable"
        title="The solar calculator is offline"
        body="We are making improvements to the calculator. Please check back shortly — your saved designs are safe."
      />
    );
  }
  return <Calculator />;
}
