import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { InstallerDirectory } from '@/features/marketplace/installer-directory';
import { getSiteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Find installers',
  description: 'Verified solar installers across Nigeria. Compare services and message installers directly on SOLARIS.',
};

export default async function InstallersPage() {
  if (!(await getSiteConfig()).features.installerDirectory) notFound();
  return <InstallerDirectory />;
}
