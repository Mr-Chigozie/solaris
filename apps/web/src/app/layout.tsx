import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Manrope, Plus_Jakarta_Sans, Space_Grotesk } from 'next/font/google';
import { AuthProvider } from '@/features/auth/auth-context';
import { MaintenanceGate } from '@/features/site/maintenance-gate';
import { SiteConfigProvider } from '@/features/site/site-config-context';
import { brandCss } from '@/features/site/theme';
import { getSiteConfig } from '@/lib/site-config';
import './globals.css';

// All selectable brand fonts are declared; browsers only download the one in use.
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });
const grotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-grotesk', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const { seo, branding } = await getSiteConfig();
  return {
    title: { default: seo.title, template: `%s · ${branding.siteName}` },
    description: seo.description,
    applicationName: branding.siteName,
    keywords: seo.keywords,
    robots: seo.allowIndexing ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      title: seo.title,
      description: seo.description,
      siteName: branding.siteName,
      locale: 'en_NG',
      type: 'website',
      ...(seo.ogImageUrl ? { images: [{ url: seo.ogImageUrl }] } : {}),
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const { branding } = await getSiteConfig();
  return { themeColor: branding.backgroundColor, width: 'device-width', initialScale: 1 };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const config = await getSiteConfig();
  const fonts = [manrope, inter, jakarta, grotesk, jetbrains].map((f) => f.variable).join(' ');

  return (
    <html lang="en-NG" className={fonts}>
      <head>
        {/* Values are schema-validated (hex colours / enums) before reaching here. */}
        <style id="brand-theme" dangerouslySetInnerHTML={{ __html: brandCss(config.branding) }} />
      </head>
      <body className="min-h-dvh font-sans">
        <SiteConfigProvider value={config}>
          <AuthProvider>
            <MaintenanceGate>{children}</MaintenanceGate>
          </AuthProvider>
        </SiteConfigProvider>
      </body>
    </html>
  );
}
