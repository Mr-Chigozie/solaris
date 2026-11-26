import { DEFAULT_SITE_SETTINGS, PUBLIC_SETTING_KEYS, type PublicSiteConfig } from '@solaris/validation';

/** Server-side API base (can be a private network URL in production). */
const SERVER_API_URL = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

export const DEFAULT_PUBLIC_CONFIG = Object.fromEntries(
  PUBLIC_SETTING_KEYS.map((k) => [k, DEFAULT_SITE_SETTINGS[k]]),
) as PublicSiteConfig;

/**
 * Admin-managed site configuration, fetched on the server and revalidated every
 * few seconds, so admin changes go live without a redeploy. Falls back to the
 * built-in defaults if the API is unreachable — the site always renders.
 */
export async function getSiteConfig(): Promise<PublicSiteConfig> {
  try {
    const res = await fetch(`${SERVER_API_URL}/site/config`, { next: { revalidate: 5, tags: ['site-config'] } });
    if (!res.ok) return DEFAULT_PUBLIC_CONFIG;
    const json = await res.json();
    return { ...DEFAULT_PUBLIC_CONFIG, ...(json?.data ?? {}) };
  } catch {
    return DEFAULT_PUBLIC_CONFIG;
  }
}
