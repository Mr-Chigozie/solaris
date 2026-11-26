'use client';

import { Loader2, MessageSquare, Send, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/format';

interface Props {
  organization: { id: string; name: string };
  contextType?: 'GENERAL' | 'PRODUCT' | 'SERVICE' | 'DESIGN';
  contextId?: string;
  subject?: string;
  placeholder?: string;
  label?: string;
  className?: string;
  variant?: 'primary' | 'secondary';
}

/**
 * "Message this business" — opens an in-app composer. Signed-out visitors are
 * sent to sign in and brought back. Sending lands the user in the thread.
 */
export function MessageButton({ organization, contextType = 'GENERAL', contextId, subject, placeholder, label = 'Message', className, variant = 'primary' }: Props) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwnBusiness = Boolean(user?.memberships.some((m) => m.organization.id === organization.id));

  function openComposer() {
    if (status !== 'authenticated') {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setOpen(true);
  }

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ id: string }>('/conversations', {
        method: 'POST',
        body: { organizationId: organization.id, contextType, ...(contextId ? { contextId } : {}), ...(subject ? { subject } : {}), message: body },
      });
      router.push(`/messages?c=${r.data.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? (e.issues[0]?.message ?? e.message) : 'Could not send message');
      setBusy(false);
    }
  }

  if (isOwnBusiness) return null;

  return (
    <>
      <button type="button" onClick={openComposer} className={cn('btn', variant === 'primary' ? 'btn-primary' : 'btn-secondary', className)}>
        <MessageSquare className="h-4 w-4" /> {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => !busy && setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={`Message ${organization.name}`} className="card w-full max-w-lg rounded-b-none p-6 sm:rounded-[var(--brand-radius)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Message {organization.name}</h2>
                {subject && <p className="mt-0.5 text-sm text-ink-400">About: {subject}</p>}
              </div>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost px-2" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <textarea
              autoFocus
              className="field mt-5 min-h-[140px] resize-y"
              placeholder={placeholder ?? 'Ask about price, availability, delivery or installation…'}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={4000}
            />
            <p className="mt-2 text-xs text-ink-400">Your name is shared with the business. Your email and phone are not — share them in the chat only if you want to.</p>
            {error && <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={send} disabled={busy || !body.trim()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send message
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
