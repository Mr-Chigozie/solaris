import { CalendarCheck, Globe, MapPin, Phone, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OrgAvatar, ProductCard, ServiceRow, VerifiedBadge } from '@/features/marketplace/cards';
import type { Storefront } from '@/features/marketplace/types';
import { MessageButton } from '@/features/messaging/message-button';
import { formatDate } from '@/lib/format';
import { serverGet } from '@/lib/server-api';

type Params = { params: Promise<{ slug: string }> };

const load = (slug: string) => serverGet<Storefront>(`/marketplace/businesses/${encodeURIComponent(slug)}`);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const s = await load((await params).slug);
  if (!s) return { title: 'Business not found' };
  return {
    title: s.name,
    description: (s.tagline ?? s.description ?? `${s.name} on SOLARIS`).slice(0, 160),
    openGraph: s.coverUrl || s.logoUrl ? { images: [{ url: (s.coverUrl || s.logoUrl)! }] } : undefined,
  };
}

export default async function StorefrontPage({ params }: Params) {
  const s = await load((await params).slug);
  if (!s) notFound();
  const location = [s.city, s.state].filter(Boolean).join(', ');

  return (
    <div>
      {/* Cover */}
      <div className="glow-grid relative h-44 overflow-hidden border-b border-white/[0.06] sm:h-64">
        {s.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-transparent" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <header className="relative z-10 -mt-14 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <div className="rounded-2xl border-4 border-ink-950 bg-ink-950"><OrgAvatar org={s} size={88} /></div>
            <div className="pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{s.name}</h1>
                <VerifiedBadge org={s} />
              </div>
              {s.tagline && <p className="mt-1 text-ink-300">{s.tagline}</p>}
            </div>
          </div>
          <MessageButton organization={{ id: s.id, name: s.name }} subject={`Enquiry for ${s.name}`} label={`Message ${s.types.includes('INSTALLER') && !s.types.includes('VENDOR') ? 'installer' : 'business'}`} className="py-3 sm:self-end" />
        </header>

        <div className="mt-10 grid gap-8 pb-20 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="card space-y-3 p-5 text-sm">
              {location && <Info icon={MapPin}>{location}{s.address ? ` · ${s.address}` : ''}</Info>}
              {s.phone && <Info icon={Phone}><a href={`tel:${s.phone}`} className="hover:text-white">{s.phone}</a></Info>}
              {s.website && <Info icon={Globe}><a href={s.website} target="_blank" rel="noopener noreferrer nofollow" className="truncate hover:text-white">{s.website.replace(/^https?:\/\//, '')}</a></Info>}
              {s.yearsInBusiness !== null && <Info icon={CalendarCheck}>{s.yearsInBusiness} years in business</Info>}
              {s.verification === 'VERIFIED' && (
                <Info icon={ShieldCheck}>
                  Verified{s.verifiedAt ? ` ${formatDate(s.verifiedAt)}` : ''}{s.cacNumber ? ` · CAC ${s.cacNumber}` : ''}
                </Info>
              )}
            </div>
            {s.serviceStates.length > 0 && (
              <div className="card p-5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400">Serves</h2>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.serviceStates.map((st) => <span key={st} className="pill py-0.5 text-[11px]">{st}</span>)}
                </div>
              </div>
            )}
            <p className="px-1 text-xs leading-relaxed text-ink-400">
              “Verified” means SOLARIS reviewed this business’s registration, credentials and evidence of past work. Always confirm warranties and terms before paying.
            </p>
          </aside>

          <main className="min-w-0 space-y-10">
            {s.description && (
              <section>
                <h2 className="text-lg font-bold text-white">About</h2>
                <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-300">{s.description}</p>
              </section>
            )}

            {s.services.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-white">Services</h2>
                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {s.services.map((sv) => (
                    <div key={sv.id} className="space-y-2">
                      <ServiceRow s={sv} showOrg={false} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {s.products.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-white">Products <span className="text-sm font-medium text-ink-400">({s.products.length})</span></h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {s.products.map((p) => <ProductCard key={p.id} p={{ ...p, organization: s }} />)}
                </div>
              </section>
            )}

            {s.products.length === 0 && s.services.length === 0 && (
              <p className="card p-8 text-center text-ink-400">This business hasn’t published any listings yet. You can still send them a message.</p>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function Info({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 text-ink-300">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
