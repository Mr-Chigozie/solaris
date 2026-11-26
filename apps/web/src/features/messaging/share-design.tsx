'use client';

import { HardHat, Loader2, Search, Send, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { OrgAvatar, VerifiedBadge } from '@/features/marketplace/cards';
import type { OrgCard } from '@/features/marketplace/types';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/format';

/**
 * Share a saved design with a verified installer and ask for a quote — the
 * bridge from SOLARIS Intelligence (the design) to Operations (the job).
 */
export function ShareDesignButton({ design }: { design: { id: string; title: string; state: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [installers, setInstallers] = useState<OrgCard[] | null>(null);
  const [picked, setPicked] = useState<OrgCard | null>(null);
  const [body, setBody] = useState(`Hello, I designed a solar system on SOLARIS (“${design.title}”). Could you review it and send me a quotation for supply and installation?`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setInstallers(null);
      const qs = new URLSearchParams({ type: 'INSTALLER', pageSize: '20', state: design.state, ...(q ? { q } : {}) });
      api<OrgCard[]>(`/marketplace/businesses?${qs}`)
        .then((r) => setInstallers(r.data))
        .catch(() => setInstallers([]));
    }, 250);
    return () => clearTimeout(t);
  }, [open, q, design.state]);

  async function send() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ id: string }>('/conversations', {
        method: 'POST',
        body: { organizationId: picked.id, contextType: 'DESIGN', contextId: design.id, subject: `Quote request: ${design.title}`, message: body },
      });
      router.push(`/messages?c=${r.data.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? (e.issues[0]?.message ?? e.message) : 'Could not send');
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary"><HardHat className="h-4 w-4" /> Send to an installer</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => !busy && setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Send design to an installer" className="card flex max-h-[90dvh] w-full max-w-xl flex-col rounded-b-none p-0 sm:rounded-[var(--brand-radius)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] p-5">
              <div>
                <h2 className="text-lg font-bold text-white">Get a quote from a verified installer</h2>
                <p className="mt-0.5 text-sm text-ink-400">They’ll see this design’s system size and estimate — not your contact details.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost px-2" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>

            {!picked ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input className="field pl-9" placeholder="Search installers" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
                </div>
                <p className="mt-3 text-xs text-ink-400">Showing installers serving {design.state}.</p>
                <div className="mt-3 space-y-2">
                  {installers === null && <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-ink-400" />}
                  {installers?.length === 0 && (
                    <p className="rounded-2xl bg-white/[0.03] p-5 text-center text-sm text-ink-400">
                      No verified installers serve {design.state} yet. <Link href="/installers" className="text-sun-300 underline">Browse all installers</Link>
                    </p>
                  )}
                  {installers?.map((o) => (
                    <button key={o.id} type="button" onClick={() => setPicked(o)} className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] p-3 text-left hover:border-white/20">
                      <OrgAvatar org={o} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2"><span className="truncate font-semibold text-white">{o.name}</span><VerifiedBadge org={o} /></div>
                        <p className="truncate text-xs text-ink-400">{o.tagline ?? [o.city, o.state].filter(Boolean).join(', ')}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-5">
                <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3">
                  <OrgAvatar org={picked} size={36} />
                  <span className="flex-1 font-semibold text-white">{picked.name}</span>
                  <button type="button" className="text-xs text-sun-300 hover:underline" onClick={() => setPicked(null)}>Change</button>
                </div>
                <textarea className="field mt-4 min-h-[130px]" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />
                {error && <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
                <div className="mt-4 flex justify-end">
                  <button type="button" className={cn('btn btn-primary')} onClick={send} disabled={busy || !body.trim()}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send design & request quote
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
