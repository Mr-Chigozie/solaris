'use client';

import type { SiteSettings } from '@solaris/validation';
import { useState } from 'react';
import { BrandMark } from '@/components/brand';
import { RingGauge } from '@/components/ui/ring-gauge';
import { SegmentedBar } from '@/components/ui/segmented-bar';
import { SettingsEditor } from '@/features/admin/settings-editor';
import { brandCss } from '@/features/site/theme';
import { SectionTabs } from '@/features/admin/section-tabs';

export default function AdminBrandingPage() {
  const [active, setActive] = useState<'branding' | 'seo'>('branding');
  return (
    <div>
      <SectionTabs items={[['branding', 'Brand & theme'], ['seo', 'Search & social (SEO)']]} active={active} onChange={(k) => setActive(k as typeof active)} />
      {active === 'branding' ? (
        <SettingsEditor
          key="branding"
          settingKey="branding"
          title="Brand & theme"
          description="Name, logo, colours, typography and corner style used across the whole platform. The preview updates as you edit."
          preview={(draft) => <BrandPreview branding={draft as unknown as SiteSettings['branding']} />}
        />
      ) : (
        <SettingsEditor
          key="seo"
          settingKey="seo"
          title="Search & social"
          description="How SOLARIS appears in Google results and when links are shared on WhatsApp, X or LinkedIn."
          preview={(draft) => <SeoPreview seo={draft as unknown as SiteSettings['seo']} />}
        />
      )}
    </div>
  );
}

/** Scoped preview: re-declares the brand CSS variables on this subtree only. */
function BrandPreview({ branding }: { branding: SiteSettings['branding'] }) {
  const scoped = brandCss(branding).replace(':root', '#brand-preview');
  return (
    <div id="brand-preview" className="card overflow-hidden p-0" style={{ fontFamily: 'var(--brand-font)', background: 'var(--brand-bg)' }}>
      <style dangerouslySetInnerHTML={{ __html: scoped }} />
      <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-5 py-4">
        {branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logoUrl} alt="" className="h-7 w-auto max-w-[100px] object-contain" />
        ) : (
          <BrandMark className="h-7 w-7" />
        )}
        <span className="font-extrabold tracking-[0.14em] text-white">{branding.siteName || 'SOLARIS'}</span>
      </div>
      <div className="space-y-5 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-volt-400">Live preview</p>
          <p className="mt-2 text-2xl font-extrabold leading-tight text-white">
            Reliable power, <span className="bg-gradient-to-r from-sun-300 via-sun-400 to-volt-400 bg-clip-text text-transparent">engineered for you.</span>
          </p>
          <p className="mt-2 text-sm text-ink-300">{branding.tagline}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="btn btn-primary">Primary button</span>
          <span className="btn btn-secondary">Secondary</span>
        </div>
        <div className="card flex items-center gap-4 p-4">
          <RingGauge value={0.72} size={96} stroke={8}>
            <span className="text-lg font-extrabold text-white">5 kVA</span>
          </RingGauge>
          <div className="flex-1">
            <p className="text-xs text-ink-400">Battery</p>
            <SegmentedBar value={0.7} segments={10} className="mt-2 h-6" />
          </div>
        </div>
        <input className="field" placeholder="Form field" readOnly />
      </div>
    </div>
  );
}

function SeoPreview({ seo }: { seo: SiteSettings['seo'] }) {
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Google result</p>
        <div className="mt-3 rounded-xl bg-white p-4 font-[Arial,sans-serif]">
          <p className="text-xs text-[#202124]">solaris.ng</p>
          <p className="mt-1 truncate text-lg text-[#1a0dab]">{seo.title}</p>
          <p className="mt-1 line-clamp-2 text-sm text-[#4d5156]">{seo.description}</p>
        </div>
        <p className="mt-3 text-xs text-ink-400">Title {seo.title.length}/70 · description {seo.description.length}/170</p>
        {!seo.allowIndexing && <p className="mt-2 rounded-lg bg-sun-400/10 p-2 text-xs text-sun-200">Indexing is off — search engines are asked not to list the site.</p>}
      </div>
      <div className="card overflow-hidden p-0">
        <p className="px-5 pt-4 text-xs font-semibold uppercase tracking-wider text-ink-400">Link preview</p>
        <div className="m-5 overflow-hidden rounded-xl border border-white/10">
          {seo.ogImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={seo.ogImageUrl} alt="" className="aspect-[1.91/1] w-full object-cover" />
          ) : (
            <div className="glow-grid grid aspect-[1.91/1] place-items-center text-sm text-ink-400">No share image set</div>
          )}
          <div className="bg-ink-850 p-3">
            <p className="truncate text-sm font-bold text-white">{seo.title}</p>
            <p className="line-clamp-2 text-xs text-ink-400">{seo.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
