'use client';

import { ArrowLeft, BatteryFull, ChevronRight, Cpu, FilePlus2, FileText, Inbox as InboxIcon, Loader2, MessageSquare, Package, Receipt, Send, SunMedium, Wrench } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { QuoteBuilder } from '@/features/commerce/quote-builder';
import { OrgAvatar, VerifiedBadge } from '@/features/marketplace/cards';
import { api, ApiError } from '@/lib/api';
import { cn, formatNaira, formatNumber } from '@/lib/format';

interface ThreadSummary {
  id: string;
  subject: string | null;
  contextType: string;
  lastMessageAt: string;
  lastMessage: { body: string; fromBusiness: boolean; createdAt: string } | null;
  unread: boolean;
  organization: { id: string; name: string; slug: string; logoUrl: string | null; isPlatformOwned: boolean };
  customer?: { firstName: string; lastName: string };
}

interface Thread {
  id: string;
  subject: string | null;
  side: 'customer' | 'business';
  organization: { id: string; name: string; slug: string; logoUrl: string | null; isPlatformOwned: boolean; verification: string };
  customer: { firstName: string; lastName: string };
  context: Record<string, unknown> & { type: 'PRODUCT' | 'SERVICE' | 'DESIGN' } | null;
  messages: Array<{ id: string; body: string; fromBusiness: boolean; kind: 'TEXT' | 'QUOTATION' | 'ORDER' | 'SYSTEM'; refId: string | null; createdAt: string; senderName: string; mine: boolean }>;
}

const POLL_MS = 6000;

function when(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

export function Inbox() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = params.get('c');
  const inbox = params.get('inbox') ?? 'customer';
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const businesses = user?.memberships ?? [];

  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) (v === null ? next.delete(k) : next.set(k, v));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const loadThreads = useCallback(() => {
    api<ThreadSummary[]>(`/conversations?inbox=${inbox}`)
      .then((r) => {
        setThreads(r.data);
        setListError(null);
      })
      .catch((e) => setListError(e instanceof ApiError && e.status === 403 ? 'You don’t have permission to read this business’s messages.' : 'Could not load messages.'));
  }, [inbox]);

  useEffect(() => {
    setThreads(null);
    loadThreads();
    const id = setInterval(loadThreads, POLL_MS * 2);
    return () => clearInterval(id);
  }, [loadThreads]);

  return (
    <div className="mx-auto max-w-6xl">
      <header className={cn('mb-6', selected && 'hidden lg:block')}>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Messages</h1>
        <p className="mt-1 text-sm text-ink-400">Talk to sellers and installers — and your customers — without leaving SOLARIS.</p>
      </header>

      <div className="card grid h-[calc(100dvh-14rem)] min-h-[480px] overflow-hidden p-0 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Thread list */}
        <aside className={cn('flex min-h-0 flex-col border-white/[0.06] lg:border-r', selected && 'hidden lg:flex')}>
          {businesses.length > 0 && (
            <div className="border-b border-white/[0.06] p-3">
              <select className="field" value={inbox} onChange={(e) => go({ inbox: e.target.value === 'customer' ? null : e.target.value, c: null })} aria-label="Inbox">
                <option value="customer">My conversations</option>
                {businesses.map((m) => <option key={m.organization.id} value={m.organization.id}>{m.organization.name} — customer inbox</option>)}
              </select>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {listError && <p className="m-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{listError}</p>}
            {threads === null && !listError && <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-ink-400" /></div>}
            {threads?.length === 0 && (
              <div className="p-8 text-center text-sm text-ink-400">
                <InboxIcon className="mx-auto mb-3 h-8 w-8" />
                {inbox === 'customer' ? (
                  <>
                    No conversations yet. Message a seller from the <Link href="/marketplace" className="text-sun-300 underline">marketplace</Link> or an <Link href="/installers" className="text-sun-300 underline">installer</Link>.
                  </>
                ) : 'No customer messages yet. They will appear here when customers contact your business.'}
              </div>
            )}
            {threads?.map((t) => {
              const title = t.customer ? `${t.customer.firstName} ${t.customer.lastName}` : t.organization.name;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => go({ c: t.id })}
                  className={cn('flex w-full gap-3 border-b border-white/[0.04] px-4 py-3.5 text-left transition hover:bg-white/[0.03]', selected === t.id && 'bg-white/[0.06]')}
                >
                  {t.customer ? (
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-sm font-bold text-white">{t.customer.firstName[0]}{t.customer.lastName[0]}</span>
                  ) : (
                    <OrgAvatar org={t.organization} size={40} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={cn('truncate text-sm', t.unread ? 'font-extrabold text-white' : 'font-semibold text-ink-100')}>{title}</span>
                      <span className="shrink-0 text-[11px] text-ink-400">{when(t.lastMessageAt)}</span>
                    </div>
                    {t.subject && <p className="truncate text-xs text-ink-300">{t.subject}</p>}
                    <p className={cn('mt-0.5 truncate text-xs', t.unread ? 'text-ink-100' : 'text-ink-400')}>
                      {t.lastMessage ? `${t.lastMessage.fromBusiness === Boolean(t.customer) ? 'You: ' : ''}${t.lastMessage.body}` : ''}
                    </p>
                  </div>
                  {t.unread && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-sun-400" aria-label="Unread" />}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Thread */}
        <section className={cn('min-h-0', !selected && 'hidden lg:block')}>
          {selected ? (
            <ThreadView key={selected} id={selected} onBack={() => go({ c: null })} onActivity={loadThreads} />
          ) : (
            <div className="grid h-full place-items-center p-8 text-center text-ink-400">
              <div>
                <MessageSquare className="mx-auto h-10 w-10" />
                <p className="mt-3">Select a conversation</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ThreadView({ id, onBack, onActivity }: { id: string; onBack: () => void; onActivity: () => void }) {
  const router = useRouter();
  const [thread, setThread] = useState<Thread | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  const load = useCallback(() => {
    api<Thread>(`/conversations/${id}`)
      .then((r) => {
        setThread(r.data);
        if (r.data.messages.length !== lastCount.current) {
          lastCount.current = r.data.messages.length;
          void api(`/conversations/${id}/read`, { method: 'POST' }).then(onActivity).catch(() => undefined);
        }
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load conversation'));
  }, [id, onActivity]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [thread?.messages.length]);

  async function send() {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      await api(`/conversations/${id}/messages`, { method: 'POST', body: { body: text } });
      setBody('');
      load();
      onActivity();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Message not sent');
    } finally {
      setSending(false);
    }
  }

  if (error && !thread) return <p className="m-6 rounded-xl bg-red-500/10 p-4 text-sm text-red-200">{error}</p>;
  if (!thread) return <div className="grid h-full place-items-center"><Loader2 className="h-5 w-5 animate-spin text-ink-400" /></div>;

  const counterpart = thread.side === 'customer' ? thread.organization.name : `${thread.customer.firstName} ${thread.customer.lastName}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
        <button type="button" onClick={onBack} className="btn btn-ghost px-2 lg:hidden" aria-label="Back to conversations"><ArrowLeft className="h-5 w-5" /></button>
        {thread.side === 'customer' && <OrgAvatar org={thread.organization} size={36} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {thread.side === 'customer' ? (
              <Link href={`/store/${thread.organization.slug}`} className="truncate font-bold text-white hover:text-sun-200">{counterpart}</Link>
            ) : (
              <span className="truncate font-bold text-white">{counterpart}</span>
            )}
            {thread.side === 'customer' && <VerifiedBadge org={thread.organization} />}
          </div>
          {thread.subject && <p className="truncate text-xs text-ink-400">{thread.subject}</p>}
        </div>
        {thread.side === 'business' && (
          <button type="button" onClick={() => setQuoting(true)} className="btn btn-primary shrink-0 px-3 py-2 text-xs sm:px-4 sm:text-sm">
            <FilePlus2 className="h-4 w-4" /> <span className="hidden sm:inline">Create quotation</span><span className="sm:hidden">Quote</span>
          </button>
        )}
      </header>
      {quoting && (
        <QuoteBuilder
          organizationId={thread.organization.id}
          conversationId={thread.id}
          onClose={() => setQuoting(false)}
          onSaved={(quoteId) => {
            setQuoting(false);
            router.push(`/quotes/${quoteId}`);
          }}
        />
      )}

      {thread.context && <ContextCard context={thread.context} />}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-5">
        {thread.messages.map((m, i) => {
          const showName = i === 0 || thread.messages[i - 1]!.fromBusiness !== m.fromBusiness;
          if (m.kind === 'SYSTEM') {
            return (
              <p key={m.id} className="mx-auto max-w-md rounded-full bg-white/[0.04] px-4 py-1.5 text-center text-xs text-ink-400">
                {m.body} · {when(m.createdAt)}
              </p>
            );
          }
          if ((m.kind === 'QUOTATION' || m.kind === 'ORDER') && m.refId) {
            const isQuote = m.kind === 'QUOTATION';
            return (
              <div key={m.id} className={cn('flex flex-col', m.mine ? 'items-end' : 'items-start')}>
                {showName && <span className="mb-1 px-1 text-[11px] text-ink-400">{m.mine ? 'You' : m.senderName}</span>}
                <Link
                  href={isQuote ? `/quotes/${m.refId}` : `/orders/${m.refId}`}
                  className="group flex w-full max-w-sm items-center gap-3 rounded-2xl border border-sun-400/30 bg-gradient-to-br from-sun-400/[0.12] to-volt-500/[0.06] p-4 transition hover:border-sun-400/60"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sun-400 text-ink-950">
                    {isQuote ? <FileText className="h-5 w-5" /> : <Receipt className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-sun-300">{isQuote ? 'Quotation' : 'Order update'}</span>
                    <span className="block text-sm font-semibold text-white">{m.body}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-400 transition group-hover:translate-x-0.5" />
                </Link>
                <span className="mt-1 px-1 text-[10px] text-ink-400">{when(m.createdAt)}</span>
              </div>
            );
          }
          return (
            <div key={m.id} className={cn('flex flex-col', m.mine ? 'items-end' : 'items-start')}>
              {showName && <span className="mb-1 px-1 text-[11px] text-ink-400">{m.mine ? 'You' : m.senderName}</span>}
              <div className={cn('max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[70%]', m.mine ? 'rounded-br-md bg-sun-400 text-ink-950' : 'rounded-bl-md bg-white/[0.07] text-ink-100')}>
                {m.body}
              </div>
              <span className="mt-1 px-1 text-[10px] text-ink-400">{when(m.createdAt)}</span>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      <footer className="border-t border-white/[0.06] p-3">
        {error && <p className="mb-2 text-xs text-red-300">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            className="field max-h-40 min-h-[46px] flex-1 resize-none"
            rows={1}
            placeholder={`Message ${counterpart}…`}
            value={body}
            maxLength={4000}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button type="button" onClick={send} disabled={sending || !body.trim()} className="btn btn-primary h-[46px] px-4" aria-label="Send">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-1.5 hidden text-[10px] text-ink-400 sm:block">Enter to send · Shift+Enter for a new line</p>
      </footer>
    </div>
  );
}

function ContextCard({ context: c }: { context: NonNullable<Thread['context']> }) {
  if (c.type === 'PRODUCT') {
    const images = c.images as string[];
    return (
      <Link href={`/marketplace/${String(c.orgSlug)}/${String(c.slug)}`} className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 hover:bg-white/[0.05]">
        {images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={images[0]} alt="" className="h-12 w-12 rounded-lg object-cover" />
        ) : <Package className="h-8 w-8 text-ink-400" />}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{String(c.name)}</p>
          <p className="text-xs text-sun-300">{c.price === null ? 'Price on request' : formatNaira(Number(c.price))}</p>
        </div>
      </Link>
    );
  }
  if (c.type === 'SERVICE') {
    return (
      <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
        <Wrench className="h-6 w-6 text-volt-300" />
        <p className="text-sm font-semibold text-white">{String(c.title)}</p>
      </div>
    );
  }
  return (
    <div className="mx-4 mt-3 rounded-2xl border border-volt-400/20 bg-volt-500/[0.06] p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-volt-300">Shared solar design · {String(c.state)}</p>
      <p className="mt-1 text-sm font-bold text-white">{String(c.title)}</p>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-300">
        <span className="flex items-center gap-1"><SunMedium className="h-3.5 w-3.5 text-sun-400" /> {formatNumber(Number(c.arrayKw), 2)} kWp ({String(c.panelCount)} panels)</span>
        <span className="flex items-center gap-1"><BatteryFull className="h-3.5 w-3.5 text-volt-400" /> {formatNumber(Number(c.batteryKwh), 1)} kWh</span>
        <span className="flex items-center gap-1"><Cpu className="h-3.5 w-3.5" /> {String(c.inverterKva)} kVA</span>
        <span>{formatNumber(Number(c.dailyKwh), 2)} kWh/day · est. {formatNaira(Number(c.estimatedCost))}</span>
      </div>
    </div>
  );
}
