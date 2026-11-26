'use client';

import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABEL } from '@solaris/validation';
import { ChevronLeft, ChevronRight, Loader2, PackageSearch, Search, SlidersHorizontal, Store } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/format';
import { BusinessCard, ProductCard } from './cards';
import { stateLabel, useStates } from './states';
import type { OrgCard, ProductCardData } from './types';

const PAGE_SIZE = 24;

export function MarketplaceBrowser() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const states = useStates();
  const view = params.get('view') === 'businesses' ? 'businesses' : 'products';
  const [q, setQ] = useState(params.get('q') ?? '');
  const [products, setProducts] = useState<ProductCardData[] | null>(null);
  const [businesses, setBusinesses] = useState<OrgCard[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const page = Number(params.get('page') ?? 1);

  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (!('page' in patch)) next.delete('page');
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  // Debounced free-text search
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get('q') ?? '') !== q) setParam({ q });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    setError(false);
    const qs = new URLSearchParams(params.toString());
    qs.delete('view');
    qs.set('pageSize', String(PAGE_SIZE));
    if (view === 'products') {
      setProducts(null);
      api<ProductCardData[]>(`/marketplace/products?${qs}`)
        .then((r) => {
          setProducts(r.data);
          setTotal(Number(r.meta?.total ?? 0));
        })
        .catch(() => setError(true));
    } else {
      setBusinesses(null);
      const b = new URLSearchParams();
      for (const k of ['q', 'state', 'page']) if (params.get(k)) b.set(k, params.get(k)!);
      b.set('type', 'VENDOR');
      b.set('pageSize', String(PAGE_SIZE));
      api<OrgCard[]>(`/marketplace/businesses?${b}`)
        .then((r) => {
          setBusinesses(r.data);
          setTotal(Number(r.meta?.total ?? 0));
        })
        .catch(() => setError(true));
    }
  }, [params, view]);

  const category = params.get('category');
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const loading = view === 'products' ? products === null : businesses === null;
  const empty = !loading && (view === 'products' ? products?.length === 0 : businesses?.length === 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-volt-400">Marketplace</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Solar equipment from verified sellers</h1>
          <p className="mt-2 max-w-2xl text-ink-300">Compare panels, inverters and batteries, then message sellers directly inside SOLARIS.</p>
        </div>
        <div className="flex gap-1 self-start rounded-full border border-white/[0.07] bg-white/[0.03] p-1">
          {(['products', 'businesses'] as const).map((v) => (
            <button key={v} type="button" onClick={() => setParam({ view: v === 'products' ? null : v, category: null })} className={cn('rounded-full px-4 py-1.5 text-sm font-semibold', view === v ? 'bg-white text-ink-950' : 'text-ink-300')}>
              {v === 'products' ? 'Products' : 'Sellers'}
            </button>
          ))}
        </div>
      </header>

      {/* Search + filters */}
      <div className="mt-8 flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input className="field py-3 pl-10" placeholder={view === 'products' ? 'Search brand, model or product…' : 'Search sellers…'} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        </div>
        <select className="field lg:w-56" value={params.get('state') ?? ''} onChange={(e) => setParam({ state: e.target.value })} aria-label="Delivers to state">
          <option value="">All states</option>
          {states.map((s) => <option key={s.stateCode} value={s.state}>{stateLabel(s.state)}</option>)}
        </select>
        {view === 'products' && (
          <>
            <select className="field lg:w-48" value={params.get('sort') ?? 'relevance'} onChange={(e) => setParam({ sort: e.target.value === 'relevance' ? null : e.target.value })} aria-label="Sort">
              <option value="relevance">Featured first</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="newest">Newest</option>
            </select>
            <button type="button" className="btn btn-secondary lg:hidden" onClick={() => setShowFilters((s) => !s)}>
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </button>
          </>
        )}
      </div>

      {view === 'products' && (
        <>
          <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
            <Chip active={!category} onClick={() => setParam({ category: null })}>All equipment</Chip>
            {PRODUCT_CATEGORIES.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setParam({ category: c })}>{PRODUCT_CATEGORY_LABEL[c]}</Chip>
            ))}
          </div>
          <div className={cn('mt-3 grid gap-3 sm:grid-cols-3 lg:flex lg:items-center', !showFilters && 'hidden lg:flex')}>
            <input className="field lg:w-40" type="number" min={0} placeholder="Min ₦" defaultValue={params.get('minPrice') ?? ''} onBlur={(e) => setParam({ minPrice: e.target.value })} aria-label="Minimum price" />
            <input className="field lg:w-40" type="number" min={0} placeholder="Max ₦" defaultValue={params.get('maxPrice') ?? ''} onBlur={(e) => setParam({ maxPrice: e.target.value })} aria-label="Maximum price" />
            <label className="flex items-center gap-2 text-sm text-ink-300">
              <input type="checkbox" className="h-4 w-4 accent-sun-400" checked={params.get('inStock') === 'true'} onChange={(e) => setParam({ inStock: e.target.checked ? 'true' : null })} />
              In stock only
            </label>
          </div>
        </>
      )}

      {/* Results */}
      <p className="mt-6 text-sm text-ink-400">{loading ? 'Loading…' : `${total} ${view === 'products' ? 'product' : 'seller'}${total === 1 ? '' : 's'}`}</p>
      {error && <p className="mt-4 rounded-2xl bg-red-500/10 p-4 text-sm text-red-200">Could not load the marketplace. Check your connection and try again.</p>}

      {loading && !error && <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-ink-400" /></div>}

      {view === 'products' && products && products.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}
      {view === 'businesses' && businesses && businesses.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((o) => <BusinessCard key={o.id} org={o} />)}
        </div>
      )}

      {empty && (
        <div className="card mt-4 p-10 text-center">
          <PackageSearch className="mx-auto h-10 w-10 text-ink-400" />
          <p className="mt-4 font-semibold text-white">Nothing matches yet</p>
          <p className="mt-1 text-sm text-ink-400">Try fewer filters — or, if you sell solar equipment, list it here.</p>
          <Link href="/register?type=VENDOR" className="btn btn-secondary mt-6"><Store className="h-4 w-4" /> Open a storefront</Link>
        </div>
      )}

      {pages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3 text-sm text-ink-300">
          <button type="button" className="btn btn-secondary px-3" disabled={page <= 1} onClick={() => setParam({ page: String(page - 1) })} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
          Page {page} of {pages}
          <button type="button" className="btn btn-secondary px-3" disabled={page >= pages} onClick={() => setParam({ page: String(page + 1) })} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition', active ? 'bg-white text-ink-950' : 'bg-white/[0.05] text-ink-300 hover:bg-white/[0.09]')}>
      {children}
    </button>
  );
}
