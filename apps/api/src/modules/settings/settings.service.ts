import {
  DEFAULT_SITE_SETTINGS,
  PUBLIC_SETTING_KEYS,
  SITE_SETTING_SCHEMAS,
  type PublicSiteConfig,
  type SiteSettingKey,
  type SiteSettings,
} from '@solaris/validation';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../shared/errors';

/**
 * Admin-managed platform settings.
 * - Reads are cached in-process for a few seconds (settings are read on hot
 *   paths like the calculator) and invalidated on every write.
 * - Stored values are re-validated on read; if a schema has evolved since a
 *   value was saved, missing fields are filled from defaults.
 * - If the database is unavailable, defaults are served so the public site keeps working.
 */
const TTL_MS = 5_000;
let cache: { at: number; values: SiteSettings } | null = null;

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Deep-merge stored values over defaults (objects merge, arrays/primitives replace). */
function deepMerge(defaults: unknown, stored: unknown): unknown {
  if (!isPlainObject(defaults) || !isPlainObject(stored)) return stored === undefined ? defaults : stored;
  const out: Record<string, unknown> = { ...defaults };
  for (const [k, v] of Object.entries(stored)) out[k] = k in defaults ? deepMerge(defaults[k], v) : v;
  return out;
}

function coerce<K extends SiteSettingKey>(key: K, stored: unknown): SiteSettings[K] {
  const schema = SITE_SETTING_SCHEMAS[key];
  const direct = schema.safeParse(stored);
  if (direct.success) return direct.data as SiteSettings[K];
  // Schema evolved since this was saved: keep the admin's edits, fill new fields from defaults.
  const merged = schema.safeParse(deepMerge(DEFAULT_SITE_SETTINGS[key], stored));
  if (merged.success) return merged.data as SiteSettings[K];
  logger.warn({ key }, 'Stored setting failed validation — serving defaults');
  return DEFAULT_SITE_SETTINGS[key];
}

export async function getAllSettings(): Promise<SiteSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.values;
  try {
    const rows = await prisma.siteSetting.findMany();
    const values = { ...DEFAULT_SITE_SETTINGS } as Record<SiteSettingKey, unknown>;
    for (const row of rows) {
      if (row.key in SITE_SETTING_SCHEMAS) values[row.key as SiteSettingKey] = coerce(row.key as SiteSettingKey, row.value);
    }
    cache = { at: Date.now(), values: values as SiteSettings };
    return cache.values;
  } catch (err) {
    logger.warn({ err }, 'Settings unavailable — serving defaults');
    return DEFAULT_SITE_SETTINGS;
  }
}

export async function getSetting<K extends SiteSettingKey>(key: K): Promise<SiteSettings[K]> {
  return (await getAllSettings())[key];
}

export async function getPublicConfig(): Promise<PublicSiteConfig> {
  const all = await getAllSettings();
  return Object.fromEntries(PUBLIC_SETTING_KEYS.map((k) => [k, all[k]])) as PublicSiteConfig;
}

export function invalidateSettingsCache() {
  cache = null;
}

export function assertSettingKey(key: string): asserts key is SiteSettingKey {
  if (!(key in SITE_SETTING_SCHEMAS)) throw AppError.notFound(`Unknown setting "${key}"`);
}

/** Validate, store, and append an immutable revision — all in one transaction. */
export async function updateSetting(key: SiteSettingKey, rawValue: unknown, actorId: string, note?: string, ip?: string) {
  const value = SITE_SETTING_SCHEMAS[key].parse(rawValue);
  const saved = await prisma.$transaction(async (tx) => {
    const existing = await tx.siteSetting.findUnique({ where: { key }, select: { version: true } });
    const version = (existing?.version ?? 0) + 1;
    const setting = await tx.siteSetting.upsert({
      where: { key },
      create: { key, value: value as object, version, updatedById: actorId },
      update: { value: value as object, version, updatedById: actorId },
    });
    await tx.siteSettingRevision.create({ data: { key, version, value: value as object, authorId: actorId, note } });
    await tx.auditLog.create({
      data: { actorId, action: 'settings.update', entityType: 'SiteSetting', entityId: key, metadata: { version, note }, ip },
    });
    return setting;
  });
  invalidateSettingsCache();
  return { key, version: saved.version, value, updatedAt: saved.updatedAt };
}

export async function listRevisions(key: SiteSettingKey) {
  return prisma.siteSettingRevision.findMany({
    where: { key },
    orderBy: { version: 'desc' },
    take: 50,
    select: { id: true, version: true, note: true, createdAt: true, value: true, author: { select: { firstName: true, lastName: true, email: true } } },
  });
}

/** Restoring creates a NEW revision with the old value — history is never rewritten. */
export async function restoreRevision(key: SiteSettingKey, revisionId: string, actorId: string, ip?: string) {
  const rev = await prisma.siteSettingRevision.findFirst({ where: { id: revisionId, key } });
  if (!rev) throw AppError.notFound('Revision not found');
  return updateSetting(key, coerce(key, rev.value), actorId, `Restored version ${rev.version}`, ip);
}

/** Reset to built-in defaults (also recorded as a new revision). */
export async function resetSetting(key: SiteSettingKey, actorId: string, ip?: string) {
  return updateSetting(key, DEFAULT_SITE_SETTINGS[key], actorId, 'Reset to defaults', ip);
}
