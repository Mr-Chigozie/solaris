import { PRODUCT_CATEGORY_LABEL, SERVICE_CATEGORY_LABEL } from '@solaris/validation';
import { formatNaira } from '@/lib/format';

export type ProductCategory = keyof typeof PRODUCT_CATEGORY_LABEL;
export type ServiceCategory = keyof typeof SERVICE_CATEGORY_LABEL;

export interface OrgCard {
  id: string;
  name: string;
  slug: string;
  types: Array<'VENDOR' | 'INSTALLER' | 'ENERGY_COMPANY'>;
  isPlatformOwned: boolean;
  isFeatured: boolean;
  verification: string;
  tagline: string | null;
  logoUrl: string | null;
  state: string | null;
  city: string | null;
  serviceStates: string[];
  ratingAverage: number | null;
  ratingCount: number;
  _count?: { products: number; services: number };
}

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  brand: string | null;
  model: string | null;
  price: number | null;
  currency: string;
  images: string[];
  stockQuantity: number;
  trackInventory: boolean;
  isFeatured: boolean;
  specifications?: Record<string, string | number>;
  organization?: OrgCard;
}

export interface ProductDetail extends ProductCardData {
  description: string | null;
  sku: string | null;
  specifications: Record<string, string | number>;
  organization: OrgCard & { phone: string | null; whatsapp: string | null; website: string | null };
}

export interface ServiceData {
  id: string;
  title: string;
  category: ServiceCategory;
  description: string | null;
  priceType: 'FIXED' | 'FROM' | 'ON_QUOTE';
  price: number | null;
  currency: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  organization?: OrgCard;
}

export interface Storefront extends OrgCard {
  description: string | null;
  coverUrl: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  yearsInBusiness: number | null;
  cacNumber: string | null;
  verifiedAt: string | null;
  createdAt: string;
  products: ProductCardData[];
  services: ServiceData[];
}

export const productPrice = (p: { price: number | null }) => (p.price === null ? 'Price on request' : formatNaira(p.price));

export function servicePrice(s: Pick<ServiceData, 'priceType' | 'price'>) {
  if (s.priceType === 'ON_QUOTE' || s.price === null) return 'Price on quote';
  return s.priceType === 'FROM' ? `From ${formatNaira(s.price)}` : formatNaira(s.price);
}

export function stockLabel(p: Pick<ProductCardData, 'trackInventory' | 'stockQuantity'>) {
  if (!p.trackInventory) return { text: 'Available', tone: 'ok' as const };
  if (p.stockQuantity <= 0) return { text: 'Out of stock', tone: 'out' as const };
  if (p.stockQuantity <= 5) return { text: `Only ${p.stockQuantity} left`, tone: 'low' as const };
  return { text: 'In stock', tone: 'ok' as const };
}

/** The one spec worth showing on a card, by category. */
export function headlineSpec(p: Pick<ProductCardData, 'category' | 'specifications'>): string | null {
  const s = p.specifications ?? {};
  switch (p.category) {
    case 'SOLAR_PANEL': return s.watts ? `${s.watts} W` : null;
    case 'INVERTER': return s.kva ? `${s.kva} kVA${s.batteryVoltage ? ` · ${s.batteryVoltage} V` : ''}` : null;
    case 'BATTERY': return s.kwh ? `${s.kwh} kWh${s.chemistry ? ` · ${s.chemistry}` : ''}` : s.ah ? `${s.ah} Ah` : null;
    case 'CHARGE_CONTROLLER': return s.amps ? `${s.amps} A${s.controllerType ? ` ${s.controllerType}` : ''}` : null;
    default: return null;
  }
}
