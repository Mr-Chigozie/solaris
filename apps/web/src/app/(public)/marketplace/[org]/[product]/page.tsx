import { PRODUCT_CATEGORY_LABEL, SPEC_FIELDS } from '@solaris/validation';
import { ArrowLeft, MapPin, ShieldCheck, Store, Truck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OrgAvatar, VerifiedBadge } from '@/features/marketplace/cards';
import { ProductGallery } from '@/features/marketplace/product-gallery';
import { productPrice, stockLabel, type ProductDetail } from '@/features/marketplace/types';
import { MessageButton } from '@/features/messaging/message-button';
import { cn } from '@/lib/format';
import { getSiteConfig } from '@/lib/site-config';
import { serverGet } from '@/lib/server-api';

type Params = { params: Promise<{ org: string; product: string }> };

async function load(org: string, product: string) {
  return serverGet<ProductDetail>(`/marketplace/products/${encodeURIComponent(org)}/${encodeURIComponent(product)}`);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { org, product } = await params;
  const p = await load(org, product);
  if (!p) return { title: 'Product not found' };
  return {
    title: `${p.name} — ${p.organization.name}`,
    description: (p.description ?? `${p.name} from ${p.organization.name}. ${productPrice(p)}.`).slice(0, 160),
    openGraph: p.images[0] ? { images: [{ url: p.images[0] }] } : undefined,
  };
}

export default async function ProductPage({ params }: Params) {
  if (!(await getSiteConfig()).features.marketplace) notFound();
  const { org, product } = await params;
  const p = await load(org, product);
  if (!p) notFound();

  const stock = stockLabel(p);
  const known = SPEC_FIELDS[p.category] ?? [];
  const specRows: Array<[string, string]> = [
    ...known.filter((f) => p.specifications[f.key] !== undefined && p.specifications[f.key] !== '').map((f) => [f.label, `${p.specifications[f.key]}${f.unit ? ` ${f.unit}` : ''}`] as [string, string]),
    ...Object.entries(p.specifications).filter(([k]) => !known.some((f) => f.key === k)).map(([k, v]) => [k, String(v)] as [string, string]),
    ...(p.brand ? [['Brand', p.brand] as [string, string]] : []),
    ...(p.model ? [['Model', p.model] as [string, string]] : []),
    ...(p.sku ? [['SKU', p.sku] as [string, string]] : []),
  ];
  const o = p.organization;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
      <Link href={`/marketplace?category=${p.category}`} className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> {PRODUCT_CATEGORY_LABEL[p.category]}
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <ProductGallery images={p.images} name={p.name} />

        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wider text-ink-400">{p.brand ?? PRODUCT_CATEGORY_LABEL[p.category]}</p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight text-white">{p.name}</h1>
          <div className="mt-5 flex flex-wrap items-baseline gap-4">
            <span className="text-3xl font-extrabold text-sun-300">{productPrice(p)}</span>
            <span className={cn('text-sm font-semibold', stock.tone === 'out' ? 'text-red-300' : stock.tone === 'low' ? 'text-sun-300' : 'text-volt-300')}>{stock.text}</span>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <MessageButton
              organization={{ id: o.id, name: o.name }}
              contextType="PRODUCT"
              contextId={p.id}
              subject={p.name}
              label="Message seller"
              className="flex-1 py-3"
              placeholder={`Hi, is the ${p.name} available? I'd like delivery to…`}
            />
            <Link href={`/store/${o.slug}`} className="btn btn-secondary flex-1 py-3"><Store className="h-4 w-4" /> Visit storefront</Link>
          </div>
          <p className="mt-3 text-xs text-ink-400">Ordering and secure payment inside SOLARIS are coming soon. For now, agree details with the seller in chat.</p>

          <div className="card mt-6 flex items-center gap-4 p-4">
            <OrgAvatar org={o} size={48} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/store/${o.slug}`} className="font-bold text-white hover:text-sun-200">{o.name}</Link>
                <VerifiedBadge org={o} />
              </div>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-400"><MapPin className="h-3 w-3" /> {[o.city, o.state].filter(Boolean).join(', ') || 'Nigeria'}</p>
            </div>
          </div>
          {o.serviceStates.length > 0 && (
            <p className="mt-3 flex items-start gap-2 text-xs text-ink-400">
              <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Delivers to: {o.serviceStates.slice(0, 8).join(', ')}{o.serviceStates.length > 8 ? ` +${o.serviceStates.length - 8} more` : ''}
            </p>
          )}

          {specRows.length > 0 && (
            <section className="card mt-6 p-5">
              <h2 className="font-bold text-white">Specifications</h2>
              <dl className="mt-3 divide-y divide-white/[0.06] text-sm">
                {specRows.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2.5">
                    <dt className="text-ink-400">{k}</dt>
                    <dd className="text-right font-medium text-ink-100">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {p.description && (
            <section className="mt-6">
              <h2 className="font-bold text-white">About this product</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-300">{p.description}</p>
            </section>
          )}

          <p className="mt-6 flex items-start gap-2 rounded-2xl bg-white/[0.03] p-3 text-xs text-ink-400">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-volt-400" />
            Specifications are provided by the seller. Check the manufacturer datasheet and warranty terms before buying.
          </p>
        </div>
      </div>
    </div>
  );
}
