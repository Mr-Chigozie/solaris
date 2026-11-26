'use client';

import Link from 'next/link';
import { Brand } from '@/components/brand';
import { useSiteConfig } from '@/features/site/site-config-context';

export function SiteFooter() {
  const { branding, features, 'content.footer': footer } = useSiteConfig();
  const platform: Array<[string, string]> = [
    ...(features.calculator ? [['Solar Calculator', '/calculator'] as [string, string]] : []),
    ...(features.marketplace ? [['Marketplace', '/marketplace'] as [string, string]] : []),
    ...(features.installerDirectory ? [['Find Installers', '/installers'] as [string, string]] : []),
  ];
  const business: Array<[string, string]> = [
    ...(features.installerRegistration ? [['Become an installer', '/register?type=INSTALLER'] as [string, string]] : []),
    ...(features.vendorRegistration ? [['Sell equipment', '/register?type=VENDOR'] as [string, string]] : []),
    ['Log in', '/login'],
  ];

  return (
    <footer className="no-print border-t border-white/[0.06] bg-ink-950">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Brand />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-400">{footer.about}</p>
        </div>
        {platform.length > 0 && <FooterCol title="Platform" links={platform} />}
        <FooterCol title="For business" links={business} />
      </div>
      <div className="border-t border-white/[0.05]">
        <p className="mx-auto max-w-7xl px-4 py-6 text-xs leading-relaxed text-ink-400 sm:px-6">
          © {new Date().getFullYear()} {branding.siteName}. {footer.disclaimer}
        </p>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-300">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="text-sm text-ink-400 transition hover:text-white">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
