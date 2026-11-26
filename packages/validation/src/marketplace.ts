import { z } from 'zod';

/* Shared vocabularies --------------------------------------------------- */

export const PRODUCT_CATEGORIES = ['SOLAR_PANEL', 'INVERTER', 'BATTERY', 'CHARGE_CONTROLLER', 'MOUNTING', 'CABLE_AND_PROTECTION', 'ACCESSORY'] as const;
export const SERVICE_CATEGORIES = ['SITE_SURVEY', 'SYSTEM_DESIGN', 'INSTALLATION', 'MAINTENANCE', 'REPAIR', 'BATTERY_REPLACEMENT', 'ELECTRICAL_WORKS', 'CONSULTATION'] as const;

export const productCategory = z.enum(PRODUCT_CATEGORIES);
export const serviceCategory = z.enum(SERVICE_CATEGORIES);
export const listingStatus = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

export const PRODUCT_CATEGORY_LABEL: Record<(typeof PRODUCT_CATEGORIES)[number], string> = {
  SOLAR_PANEL: 'Solar panels',
  INVERTER: 'Inverters',
  BATTERY: 'Batteries',
  CHARGE_CONTROLLER: 'Charge controllers',
  MOUNTING: 'Mounting',
  CABLE_AND_PROTECTION: 'Cables & protection',
  ACCESSORY: 'Accessories',
};

export const SERVICE_CATEGORY_LABEL: Record<(typeof SERVICE_CATEGORIES)[number], string> = {
  SITE_SURVEY: 'Site survey',
  SYSTEM_DESIGN: 'System design',
  INSTALLATION: 'Installation',
  MAINTENANCE: 'Maintenance',
  REPAIR: 'Repair',
  BATTERY_REPLACEMENT: 'Battery replacement',
  ELECTRICAL_WORKS: 'Electrical works',
  CONSULTATION: 'Consultation',
};

/** Suggested datasheet fields per category (shown as form fields; free-form keys also allowed). */
export const SPEC_FIELDS: Record<(typeof PRODUCT_CATEGORIES)[number], Array<{ key: string; label: string; unit?: string; type: 'number' | 'text' }>> = {
  SOLAR_PANEL: [
    { key: 'watts', label: 'Rated power', unit: 'W', type: 'number' },
    { key: 'cellType', label: 'Cell type', type: 'text' },
    { key: 'efficiency', label: 'Efficiency', unit: '%', type: 'number' },
    { key: 'warrantyYears', label: 'Warranty', unit: 'years', type: 'number' },
  ],
  INVERTER: [
    { key: 'kva', label: 'Rating', unit: 'kVA', type: 'number' },
    { key: 'batteryVoltage', label: 'Battery voltage', unit: 'V', type: 'number' },
    { key: 'inverterType', label: 'Type (hybrid, off-grid…)', type: 'text' },
    { key: 'mpptAmps', label: 'Built-in MPPT', unit: 'A', type: 'number' },
    { key: 'warrantyYears', label: 'Warranty', unit: 'years', type: 'number' },
  ],
  BATTERY: [
    { key: 'kwh', label: 'Capacity', unit: 'kWh', type: 'number' },
    { key: 'voltage', label: 'Voltage', unit: 'V', type: 'number' },
    { key: 'ah', label: 'Capacity', unit: 'Ah', type: 'number' },
    { key: 'chemistry', label: 'Chemistry', type: 'text' },
    { key: 'cycles', label: 'Cycle life', unit: 'cycles', type: 'number' },
    { key: 'warrantyYears', label: 'Warranty', unit: 'years', type: 'number' },
  ],
  CHARGE_CONTROLLER: [
    { key: 'amps', label: 'Current', unit: 'A', type: 'number' },
    { key: 'voltage', label: 'System voltage', unit: 'V', type: 'number' },
    { key: 'controllerType', label: 'Type (MPPT/PWM)', type: 'text' },
  ],
  MOUNTING: [{ key: 'material', label: 'Material', type: 'text' }],
  CABLE_AND_PROTECTION: [{ key: 'rating', label: 'Rating', type: 'text' }],
  ACCESSORY: [],
};

const imageUrl = z.url().max(500);
const specValue = z.union([z.string().trim().max(120), z.number().finite()]);

/* Business profile ------------------------------------------------------ */

export const businessProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    tagline: z.string().trim().max(140),
    description: z.string().trim().max(4000),
    logoUrl: z.union([z.literal(''), imageUrl]),
    coverUrl: z.union([z.literal(''), imageUrl]),
    website: z.union([z.literal(''), z.url().max(300)]),
    email: z.union([z.literal(''), z.email().max(254)]),
    phone: z.string().trim().max(20),
    whatsapp: z.string().trim().max(20),
    state: z.string().trim().max(60),
    city: z.string().trim().max(80),
    address: z.string().trim().max(300),
    serviceStates: z.array(z.string().trim().max(60)).max(37),
    yearsInBusiness: z.number().int().min(0).max(100).nullable(),
    cacNumber: z.string().trim().max(20),
  })
  .partial();
export type BusinessProfileDto = z.infer<typeof businessProfileSchema>;

/* Listings -------------------------------------------------------------- */

export const productInputSchema = z.object({
  name: z.string().trim().min(2).max(140),
  category: productCategory,
  brand: z.string().trim().max(80).optional(),
  model: z.string().trim().max(80).optional(),
  sku: z.string().trim().max(60).optional(),
  description: z.string().trim().max(5000).optional(),
  price: z.number().min(0).max(1_000_000_000).nullable().optional(),
  specifications: z.record(z.string().max(40), specValue).refine((o) => Object.keys(o).length <= 30, 'Up to 30 specifications').default({}),
  images: z.array(imageUrl).max(8).default([]),
  stockQuantity: z.number().int().min(0).max(1_000_000).default(0),
  trackInventory: z.boolean().default(true),
  status: listingStatus.default('DRAFT'),
});
export const productUpdateSchema = productInputSchema.partial();
export type ProductInputDto = z.infer<typeof productInputSchema>;

export const stockUpdateSchema = z.object({ stockQuantity: z.number().int().min(0).max(1_000_000) });

export const serviceInputSchema = z
  .object({
    title: z.string().trim().min(2).max(140),
    category: serviceCategory,
    description: z.string().trim().max(5000).optional(),
    priceType: z.enum(['FIXED', 'FROM', 'ON_QUOTE']).default('ON_QUOTE'),
    price: z.number().min(0).max(1_000_000_000).nullable().optional(),
    status: listingStatus.default('DRAFT'),
  })
  .refine((s) => s.priceType === 'ON_QUOTE' || (s.price !== null && s.price !== undefined), {
    message: 'Enter a price, or choose "price on quote"',
    path: ['price'],
  });
export const serviceUpdateSchema = z.object({
  title: z.string().trim().min(2).max(140),
  category: serviceCategory,
  description: z.string().trim().max(5000),
  priceType: z.enum(['FIXED', 'FROM', 'ON_QUOTE']),
  price: z.number().min(0).max(1_000_000_000).nullable(),
  status: listingStatus,
}).partial();
export type ServiceInputDto = z.infer<typeof serviceInputSchema>;

/* Public marketplace queries -------------------------------------------- */

const page = { page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(60).default(24) };

export const productSearchSchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: productCategory.optional(),
  state: z.string().trim().max(60).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStock: z.enum(['true', 'false']).optional(),
  seller: z.string().trim().max(80).optional(),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'newest']).default('relevance'),
  ...page,
});

export const serviceSearchSchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: serviceCategory.optional(),
  state: z.string().trim().max(60).optional(),
  ...page,
});

export const businessSearchSchema = z.object({
  q: z.string().trim().max(80).optional(),
  type: z.enum(['VENDOR', 'INSTALLER']).optional(),
  state: z.string().trim().max(60).optional(),
  ...page,
});

/* Messaging ------------------------------------------------------------- */

export const conversationContext = z.enum(['GENERAL', 'PRODUCT', 'SERVICE', 'DESIGN']);

export const startConversationSchema = z
  .object({
    organizationId: z.uuid(),
    subject: z.string().trim().max(140).optional(),
    contextType: conversationContext.default('GENERAL'),
    contextId: z.uuid().optional(),
    message: z.string().trim().min(1, 'Write a message').max(4000),
  })
  .refine((v) => v.contextType === 'GENERAL' || Boolean(v.contextId), { message: 'Missing context reference', path: ['contextId'] });
export type StartConversationDto = z.infer<typeof startConversationSchema>;

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1, 'Write a message').max(4000),
});

export const conversationListSchema = z.object({
  /** "customer": threads I started; or a business id I belong to. */
  inbox: z.union([z.literal('customer'), z.uuid()]).default('customer'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(30),
});
