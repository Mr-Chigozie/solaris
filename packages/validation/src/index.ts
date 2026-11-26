import { z } from 'zod';

/* ---------------------------------------------------------------- common */

/** Nigerian mobile numbers: 080…, +23480…, 23480… → normalised to E.164 (+234…). */
export const nigerianPhone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()-]/g, ''))
  .refine((v) => /^(\+?234|0)[789][01]\d{8}$/.test(v), 'Enter a valid Nigerian mobile number')
  .transform((v) => (v.startsWith('0') ? `+234${v.slice(1)}` : v.startsWith('234') ? `+${v}` : v));

export const uuid = z.uuid();

/* ------------------------------------------------------------ calculator */

export const batteryChemistry = z.enum(['LIFEPO4', 'LEAD_ACID_AGM', 'LEAD_ACID_TUBULAR']);

export const applianceLoadSchema = z
  .object({
    catalogId: z.string().max(64).optional(),
    name: z.string().trim().min(1).max(80),
    quantity: z.number().int().min(1).max(500),
    watts: z.number().positive().max(100_000),
    hoursPerDay: z.number().gt(0).max(24),
    nightHoursPerDay: z.number().min(0).max(24).optional(),
    simultaneousUse: z.boolean().optional(),
    surgeFactor: z.number().min(1).max(8).optional(),
  })
  .refine((a) => a.nightHoursPerDay === undefined || a.nightHoursPerDay <= a.hoursPerDay, {
    message: 'Night hours cannot exceed total hours per day',
    path: ['nightHoursPerDay'],
  });

export const assumptionOverridesSchema = z
  .object({
    peakSunHours: z.number().min(1).max(8),
    solarDesignBasis: z.enum(['ANNUAL_AVERAGE', 'WORST_MONTH']),
    solarDerating: z.number().min(0.5).max(1),
    targetSolarFraction: z.number().min(0).max(1.5),
    panelWatts: z.number().int().min(50).max(800),
    batteryDepthOfDischarge: z.number().min(0.2).max(1),
    batteryRoundTripEfficiency: z.number().min(0.5).max(1),
    inverterEfficiency: z.number().min(0.7).max(1),
    powerFactor: z.number().min(0.5).max(1),
    inverterDesignMargin: z.number().min(1).max(2),
    inverterSurgeMultiplier: z.number().min(1).max(4),
    defaultNightFraction: z.number().min(0).max(1),
  })
  .partial()
  .strict();

export const sizingInputSchema = z.object({
  location: z.object({
    state: z.string().trim().min(2).max(60),
    city: z.string().trim().max(80).optional(),
  }),
  appliances: z.array(applianceLoadSchema).min(1, 'Add at least one appliance').max(100),
  gridAvailable: z.boolean(),
  backupHours: z.number().min(0).max(24),
  autonomyDays: z.number().min(0).max(5),
  batteryChemistry: batteryChemistry.optional(),
  assumptions: assumptionOverridesSchema.optional(),
});
export type SizingInputDto = z.infer<typeof sizingInputSchema>;

export const energyEstimateSchema = z.object({
  appliances: z.array(applianceLoadSchema).min(1).max(100),
  backupHours: z.number().min(0).max(24).default(0),
});

export const saveDesignSchema = sizingInputSchema.extend({
  title: z.string().trim().min(1).max(120).default('My solar design'),
});
export type SaveDesignDto = z.infer<typeof saveDesignSchema>;

/* ------------------------------------------------------------------ auth */

export const accountType = z.enum(['CONSUMER', 'INSTALLER', 'VENDOR']);
export type AccountType = z.infer<typeof accountType>;

export const password = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Include at least one letter and one number');

export const registerSchema = z
  .object({
    email: z.email().trim().toLowerCase().max(254),
    password,
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    phone: nigerianPhone.optional(),
    accountType: accountType.default('CONSUMER'),
    businessName: z.string().trim().min(2).max(120).optional(),
    state: z.string().trim().max(60).optional(),
    acceptTerms: z.literal(true, { error: 'You must accept the terms and privacy policy' }),
  })
  .refine((v) => v.accountType === 'CONSUMER' || Boolean(v.businessName), {
    message: 'Business name is required for installer and vendor accounts',
    path: ['businessName'],
  });
export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(128),
});
export type LoginDto = z.infer<typeof loginSchema>;

/* --------------------------------------------------------- organisations */

export const organizationType = z.enum(['VENDOR', 'INSTALLER']);

/** Any signed-in person can open a business; it starts PENDING verification. */
export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  types: z.array(organizationType).min(1, 'Choose at least one: sell products and/or offer services').max(2),
  state: z.string().trim().max(60).optional(),
  city: z.string().trim().max(80).optional(),
  phone: nigerianPhone.optional(),
  email: z.email().trim().toLowerCase().optional(),
  cacNumber: z.string().trim().max(20).optional(),
  description: z.string().trim().max(2000).optional(),
  serviceStates: z.array(z.string().trim().max(60)).max(37).optional(),
});
export type CreateOrganizationDto = z.infer<typeof createOrganizationSchema>;

/* ----------------------------------------------------------------- admin */

export const verificationDecisionSchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED', 'SUSPENDED']),
  note: z.string().trim().max(500).optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export * from './site-settings';
export { z };
