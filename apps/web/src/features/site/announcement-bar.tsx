'use client';

import { ArrowRight, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/format';
import { useSiteConfig } from './site-config-context';

const TONES = {
  info: 'bg-sky-500/15 text-sky-100 border-sky-400/20',
  success: 'bg-volt-500/15 text-volt-200 border-volt-400/20',
  warning: 'bg-sun-400/15 text-sun-100 border-sun-400/25',
};

/** Admin-managed site-wide announcement. Dismissal is remembered per message on this device. */
export function AnnouncementBar() {
  const { announcement } = useSiteConfig();
  const [dismissed, setDismissed] = useState(true);
  const key = `solaris:announcement:${announcement.message}`;

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(key) === '1');
    } catch {
      setDismissed(false);
    }
  }, [key]);

  if (!announcement.enabled || !announcement.message || dismissed) return null;

  return (
    <div className={cn('no-print border-b', TONES[announcement.tone])}>
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-sm sm:px-6">
        <p className="flex-1 text-center">
          {announcement.message}
          {announcement.linkUrl && announcement.linkLabel && (
            <Link href={announcement.linkUrl} className="ml-2 inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline">
              {announcement.linkLabel} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </p>
        <button
          type="button"
          aria-label="Dismiss announcement"
          className="rounded-full p-1 opacity-70 hover:opacity-100"
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem(key, '1');
            } catch {
              /* ignore */
            }
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
