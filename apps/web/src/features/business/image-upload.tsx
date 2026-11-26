'use client';

import { ImagePlus, Loader2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { ApiError, uploadImage } from '@/lib/api';
import { cn } from '@/lib/format';

const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX = 5 * 1024 * 1024;

async function uploadChecked(file: File) {
  if (!ACCEPT.split(',').includes(file.type)) throw new Error('Use a JPEG, PNG or WebP image');
  if (file.size > MAX) throw new Error('Images must be 5 MB or smaller');
  return uploadImage(file);
}

/** Single image (logo / cover). */
export function SingleImageUpload({ value, onChange, label, aspect = 'square' }: { value: string; onChange: (url: string) => void; label: string; aspect?: 'square' | 'wide' }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadChecked(file));
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div>
      <span className="label">{label}</span>
      <div className={cn('relative overflow-hidden rounded-2xl border border-dashed border-white/15 bg-ink-900/60', aspect === 'square' ? 'h-28 w-28' : 'aspect-[3/1] w-full')}>
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="h-full w-full object-cover" />
            <button type="button" onClick={() => onChange('')} className="absolute right-1.5 top-1.5 rounded-full bg-ink-950/80 p-1 text-white" aria-label={`Remove ${label}`}><X className="h-3.5 w-3.5" /></button>
          </>
        ) : (
          <button type="button" onClick={() => input.current?.click()} className="grid h-full w-full place-items-center text-ink-400 hover:text-white" disabled={busy}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="flex flex-col items-center gap-1 text-xs"><ImagePlus className="h-5 w-5" /> Upload</span>}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  );
}

/** Up to `max` product images; the first is the cover. */
export function MultiImageUpload({ value, onChange, max = 8 }: { value: string[]; onChange: (urls: string[]) => void; max?: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files).slice(0, max - value.length);
    setBusy(list.length);
    const urls: string[] = [];
    for (const f of list) {
      try {
        urls.push(await uploadChecked(f));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
      }
      setBusy((b) => b - 1);
    }
    onChange([...value, ...urls]);
    if (input.current) input.current.value = '';
  }

  return (
    <div>
      <span className="label">Photos <span className="text-ink-400">(first photo is the cover · up to {max})</span></span>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {value.map((url, i) => (
          <div key={url} className={cn('relative aspect-square overflow-hidden rounded-xl border', i === 0 ? 'border-sun-400/60' : 'border-white/10')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button type="button" onClick={() => onChange(value.filter((u) => u !== url))} className="absolute right-1 top-1 rounded-full bg-ink-950/80 p-1 text-white" aria-label="Remove photo"><X className="h-3 w-3" /></button>
            {i > 0 && (
              <button type="button" onClick={() => onChange([url, ...value.filter((u) => u !== url)])} className="absolute bottom-1 left-1 rounded-full bg-ink-950/80 px-2 py-0.5 text-[10px] font-semibold text-white">Make cover</button>
            )}
          </div>
        ))}
        {Array.from({ length: busy }).map((_, i) => (
          <div key={`b${i}`} className="grid aspect-square place-items-center rounded-xl border border-white/10"><Loader2 className="h-5 w-5 animate-spin text-ink-400" /></div>
        ))}
        {value.length + busy < max && (
          <button type="button" onClick={() => input.current?.click()} className="grid aspect-square place-items-center rounded-xl border border-dashed border-white/15 text-ink-400 hover:border-white/30 hover:text-white">
            <span className="flex flex-col items-center gap-1 text-xs"><ImagePlus className="h-5 w-5" /> Add</span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept={ACCEPT} multiple className="hidden" onChange={(e) => pick(e.target.files)} />
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  );
}
