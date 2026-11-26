import { z } from 'zod';

/**
 * Admin-controlled platform settings. Each key has a strict schema (validated by
 * the API before saving) and a default that the web app falls back to when the
 * API is unreachable — so the site always renders.
 */

const text = (max: number) => z.string().trim().max(max);
const hex = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour, e.g. #F8D531');
const optionalUrl = z.union([z.literal(''), z.url().max(500)]);
/** Internal path (/calculator) or https URL — never javascript: etc. */
const link = z.string().trim().max(300).refine((v) => v === '' || v.startsWith('/') || /^https:\/\//.test(v), 'Use a path like /calculator or an https:// link');

/* ---------------------------------------------------------------- branding */

export const FONT_CHOICES = ['Manrope', 'Inter', 'Plus Jakarta Sans', 'Space Grotesk'] as const;

export const brandingSchema = z.object({
  siteName: text(40).min(2),
  tagline: text(120),
  logoUrl: optionalUrl,
  primaryColor: hex,
  secondaryColor: hex,
  backgroundColor: hex,
  font: z.enum(FONT_CHOICES),
  cornerStyle: z.enum(['rounded', 'soft', 'sharp']),
});

/* --------------------------------------------------------------------- SEO */

export const seoSchema = z.object({
  title: text(70).min(5),
  description: text(170).min(20),
  ogImageUrl: optionalUrl,
  keywords: z.array(text(40)).max(15),
  allowIndexing: z.boolean(),
});

/* ---------------------------------------------------------------- features */

export const featuresSchema = z.object({
  calculator: z.boolean(),
  marketplace: z.boolean(),
  installerDirectory: z.boolean(),
  consumerRegistration: z.boolean(),
  installerRegistration: z.boolean(),
  vendorRegistration: z.boolean(),
  demoMonitoring: z.boolean(),
  maintenanceMode: z.boolean(),
  maintenanceMessage: text(300),
});

/* ------------------------------------------------------------ announcement */

export const announcementSchema = z.object({
  enabled: z.boolean(),
  message: text(200),
  linkLabel: text(40),
  linkUrl: link,
  tone: z.enum(['info', 'success', 'warning']),
});

/* ------------------------------------------------------------ home content */

const titled = z.object({ title: text(80).min(1), body: text(300) });

export const homeContentSchema = z.object({
  hero: z.object({
    eyebrow: text(80),
    titleLine1: text(60).min(1),
    titleHighlight: text(80),
    subtitle: text(400),
    primaryCtaLabel: text(40).min(1),
    secondaryCtaLabel: text(40),
    trustPoints: z.array(text(60)).length(3),
  }),
  stats: z.array(z.object({ value: text(12).min(1), label: text(80).min(1) })).length(4),
  howItWorks: z.object({ eyebrow: text(40), title: text(120).min(1), steps: z.array(titled).length(4) }),
  audiences: z.object({
    eyebrow: text(40),
    title: text(120).min(1),
    items: z.array(titled.extend({ points: z.array(text(60)).max(5), ctaLabel: text(40) })).length(3),
  }),
  honestNumbers: z.object({ eyebrow: text(40), title: text(120).min(1), items: z.array(titled).length(3) }),
  finalCta: z.object({ title: text(120).min(1), body: text(300), ctaLabel: text(40).min(1) }),
});

export const footerContentSchema = z.object({
  about: text(300),
  disclaimer: text(400),
});

/* ---------------------------------------------------------- reference prices */

export const pricingSchema = z.object({
  pricesReviewed: z.string().regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM'),
  panelPricePerWatt: z.number().min(1).max(10_000),
  batteryPricePerKwh: z.object({
    LIFEPO4: z.number().min(1).max(10_000_000),
    LEAD_ACID_AGM: z.number().min(1).max(10_000_000),
    LEAD_ACID_TUBULAR: z.number().min(1).max(10_000_000),
  }),
  inverterPricePerKva: z.number().min(1).max(10_000_000),
  balanceOfSystemFraction: z.number().min(0).max(1),
  installationFraction: z.number().min(0).max(1),
  logisticsFlat: z.number().min(0).max(10_000_000),
  contingencyFraction: z.number().min(0).max(0.5),
});

/* ----------------------------------------------------------------- registry */

export const SITE_SETTING_SCHEMAS = {
  branding: brandingSchema,
  seo: seoSchema,
  features: featuresSchema,
  announcement: announcementSchema,
  'content.home': homeContentSchema,
  'content.footer': footerContentSchema,
  pricing: pricingSchema,
} as const;

export type SiteSettingKey = keyof typeof SITE_SETTING_SCHEMAS;
export const SITE_SETTING_KEYS = Object.keys(SITE_SETTING_SCHEMAS) as SiteSettingKey[];

export type AdminRoleName = 'SUPER_ADMIN' | 'CONTENT_EDITOR' | 'OPERATIONS' | 'MARKETPLACE_CURATOR';

/** Which admin role may edit each setting (SUPER_ADMIN may edit all). */
export const SETTING_EDITOR_ROLE: Record<SiteSettingKey, AdminRoleName> = {
  branding: 'CONTENT_EDITOR',
  seo: 'CONTENT_EDITOR',
  announcement: 'CONTENT_EDITOR',
  'content.home': 'CONTENT_EDITOR',
  'content.footer': 'CONTENT_EDITOR',
  features: 'SUPER_ADMIN',
  pricing: 'MARKETPLACE_CURATOR',
};

/** Settings safe to expose publicly (pricing is applied server-side only). */
export const PUBLIC_SETTING_KEYS = ['branding', 'seo', 'features', 'announcement', 'content.home', 'content.footer'] as const;

export type SiteSettings = { [K in SiteSettingKey]: z.infer<(typeof SITE_SETTING_SCHEMAS)[K]> };
export type PublicSiteConfig = Pick<SiteSettings, (typeof PUBLIC_SETTING_KEYS)[number]>;

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  branding: {
    siteName: 'SOLARIS',
    tagline: 'Solar intelligence for Nigeria',
    logoUrl: '',
    primaryColor: '#F8D531',
    secondaryColor: '#34D399',
    backgroundColor: '#04070D',
    font: 'Manrope',
    cornerStyle: 'rounded',
  },
  seo: {
    title: 'SOLARIS — Solar intelligence for Nigeria',
    description:
      'Size a solar system for your home or business in minutes, compare equipment, find verified installers and manage your solar assets. Built for Nigeria.',
    ogImageUrl: '',
    keywords: ['solar Nigeria', 'solar calculator', 'inverter', 'solar installers', 'lithium battery'],
    allowIndexing: true,
  },
  features: {
    calculator: true,
    marketplace: true,
    installerDirectory: true,
    consumerRegistration: true,
    installerRegistration: true,
    vendorRegistration: true,
    demoMonitoring: true,
    maintenanceMode: false,
    maintenanceMessage: 'SOLARIS is undergoing scheduled maintenance. We will be back shortly.',
  },
  announcement: {
    enabled: false,
    message: 'Installer registration is now open across all 36 states and the FCT.',
    linkLabel: 'Register your business',
    linkUrl: '/register?type=INSTALLER',
    tone: 'info',
  },
  'content.home': {
    hero: {
      eyebrow: 'Built for Nigeria · all 36 states + FCT',
      titleLine1: 'Reliable power,',
      titleHighlight: 'engineered for your home.',
      subtitle:
        'Tell us what you power. SOLARIS sizes your panels, batteries and inverter using sunshine data for your state, then shows a clear equipment list and an estimated cost in naira.',
      primaryCtaLabel: 'Size my solar system',
      secondaryCtaLabel: "I'm an installer",
      trustPoints: ['No sign-up to calculate', 'Sun data for your state', 'Every assumption shown'],
    },
    stats: [
      { value: '37', label: 'locations with solar resource profiles' },
      { value: '30+', label: 'common Nigerian appliances pre-loaded' },
      { value: '3', label: 'battery chemistries compared' },
      { value: '100%', label: 'of assumptions visible & editable' },
    ],
    howItWorks: {
      eyebrow: 'How it works',
      title: 'From your appliance list to a working system',
      steps: [
        { title: 'List your appliances', body: 'Pick from common Nigerian appliances or add your own, with hours of use.' },
        { title: 'Get a sized system', body: 'Panels, battery and inverter matched to your load and your state’s sunshine.' },
        { title: 'Save & compare', body: 'Create a free account to save designs and request a professional review.' },
        { title: 'Install with confidence', body: 'Connect with installers who have been through verification.' },
      ],
    },
    audiences: {
      eyebrow: 'One platform',
      title: 'Built for everyone in the solar value chain',
      items: [
        {
          title: 'Homes & businesses',
          body: 'Understand what you actually need before you spend. Compare designs, get quotations and track your installation.',
          points: ['Free energy assessment', 'Transparent system sizing', 'Quotations & project tracking'],
          ctaLabel: 'Start calculating',
        },
        {
          title: 'Installers',
          body: 'Receive qualified customer leads with energy data already captured, and run quotations and projects in one place.',
          points: ['Qualified leads', 'Design & quotation tools', 'Project milestones'],
          ctaLabel: 'Register your business',
        },
        {
          title: 'Vendors',
          body: 'List panels, inverters and batteries where buyers are already sizing systems, and see what the market demands.',
          points: ['Product listings', 'Buyer enquiries', 'Demand analytics'],
          ctaLabel: 'List your products',
        },
      ],
    },
    honestNumbers: {
      eyebrow: 'Honest numbers',
      title: 'We never blur estimates, approvals and measurements',
      items: [
        { title: 'Calculated estimate', body: 'What our engine recommends from your inputs — always labelled, with every assumption shown.' },
        { title: 'Installer-approved design', body: 'A qualified installer reviews the site and equipment datasheets before anything is quoted as final.' },
        { title: 'Measured performance', body: 'Real readings from your installed system — never mixed with estimates or demo data.' },
      ],
    },
    finalCta: {
      title: 'Find out what your home really needs',
      body: 'It takes about three minutes. No account, no phone number, no sales call.',
      ctaLabel: 'Open the calculator',
    },
  },
  'content.footer': {
    about: 'Solar intelligence for Nigeria. Assess your energy needs, design the right system, and connect with vendors and installers.',
    disclaimer:
      'Calculator results are estimates for planning only. Final system designs must be confirmed by a qualified installer after a site survey.',
  },
  pricing: {
    pricesReviewed: '2026-11',
    panelPricePerWatt: 280,
    batteryPricePerKwh: { LIFEPO4: 380_000, LEAD_ACID_AGM: 150_000, LEAD_ACID_TUBULAR: 135_000 },
    inverterPricePerKva: 180_000,
    balanceOfSystemFraction: 0.12,
    installationFraction: 0.1,
    logisticsFlat: 50_000,
    contingencyFraction: 0.05,
  },
};

/* ------------------------------------------------------- admin curation DTOs */

export const curationSchema = z.object({
  isFeatured: z.boolean().optional(),
  hidden: z.boolean().optional(),
  hiddenReason: z.string().trim().max(300).optional(),
});

export const applianceAdminSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9-]{2,48}$/, 'Lowercase letters, numbers and dashes'),
  name: z.string().trim().min(2).max(80),
  category: z.enum(['LIGHTING', 'COOLING', 'REFRIGERATION', 'ENTERTAINMENT', 'OFFICE', 'KITCHEN', 'LAUNDRY', 'WATER', 'SECURITY', 'OTHER']),
  defaultWatts: z.number().positive().max(100_000),
  surgeFactor: z.number().min(1).max(8),
  typicalHoursPerDay: z.number().gt(0).max(24),
  typicalNightFraction: z.number().min(0).max(1),
  note: z.string().trim().max(200).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});
export const applianceAdminUpdateSchema = applianceAdminSchema.omit({ id: true }).partial();

export const adminTeamUpdateSchema = z.object({
  adminRoles: z.array(z.enum(['SUPER_ADMIN', 'CONTENT_EDITOR', 'OPERATIONS', 'MARKETPLACE_CURATOR'])).max(4),
});
export const adminTeamInviteSchema = adminTeamUpdateSchema.extend({
  email: z.email().trim().toLowerCase(),
});
