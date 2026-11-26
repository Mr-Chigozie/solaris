'use client';

import type { PublicSiteConfig } from '@solaris/validation';
import { createContext, useContext } from 'react';

const SiteConfigContext = createContext<PublicSiteConfig | null>(null);

export function SiteConfigProvider({ value, children }: { value: PublicSiteConfig; children: React.ReactNode }) {
  return <SiteConfigContext.Provider value={value}>{children}</SiteConfigContext.Provider>;
}

export function useSiteConfig(): PublicSiteConfig {
  const ctx = useContext(SiteConfigContext);
  if (!ctx) throw new Error('useSiteConfig must be used inside <SiteConfigProvider>');
  return ctx;
}
