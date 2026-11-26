import type { PublicSiteConfig } from '@solaris/validation';

const FONT_VARS: Record<PublicSiteConfig['branding']['font'], string> = {
  Manrope: 'var(--font-manrope)',
  Inter: 'var(--font-inter)',
  'Plus Jakarta Sans': 'var(--font-jakarta)',
  'Space Grotesk': 'var(--font-grotesk)',
};

const CORNERS = {
  rounded: { card: '1.5rem', field: '0.75rem', pill: '9999px' },
  soft: { card: '0.875rem', field: '0.5rem', pill: '0.625rem' },
  sharp: { card: '0.25rem', field: '0.125rem', pill: '0.25rem' },
} as const;

/**
 * CSS custom properties for the admin-selected brand. Values come from the API
 * but are schema-validated (hex colours, enum font/corner) so they are safe to
 * inline into a <style> tag.
 */
export function brandCss(branding: PublicSiteConfig['branding']): string {
  const hex = (v: string, fallback: string) => (/^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback);
  const c = CORNERS[branding.cornerStyle] ?? CORNERS.rounded;
  return `:root{--brand-primary:${hex(branding.primaryColor, '#F8D531')};--brand-secondary:${hex(branding.secondaryColor, '#34D399')};--brand-bg:${hex(branding.backgroundColor, '#04070D')};--brand-font:${FONT_VARS[branding.font] ?? FONT_VARS.Manrope};--brand-radius:${c.card};--brand-field:${c.field};--brand-pill:${c.pill};}`;
}
