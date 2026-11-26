/** Prisma Decimals → plain numbers for JSON consumers. */
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export function productOut<T extends { price: unknown }>(p: T) {
  return { ...p, price: num(p.price) };
}

export function serviceOut<T extends { price: unknown }>(s: T) {
  return { ...s, price: num(s.price) };
}

export function orgCardOut<T extends { ratingAverage?: unknown }>(o: T) {
  return { ...o, ratingAverage: num(o.ratingAverage) };
}

/** Public-safe business fields (no internal verification notes, curation reasons, etc.). */
export const publicOrgSelect = {
  id: true,
  name: true,
  slug: true,
  types: true,
  isPlatformOwned: true,
  isFeatured: true,
  verification: true,
  tagline: true,
  logoUrl: true,
  state: true,
  city: true,
  serviceStates: true,
  ratingAverage: true,
  ratingCount: true,
} as const;
