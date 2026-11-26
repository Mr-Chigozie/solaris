import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ComingSoon } from '@/components/coming-soon';
import { getSiteConfig } from '@/lib/site-config';

export const metadata: Metadata = { title: 'Find installers' };

export default async function InstallersPage() {
  if (!(await getSiteConfig()).features.installerDirectory) notFound();
  return (
    <ComingSoon
      release="Release 2 · Commercial platform"
      title="Find a verified installer"
      body="Installers are reviewed for business registration, technical credentials and evidence of completed work before they are listed. Installer registration is already open."
    />
  );
}
