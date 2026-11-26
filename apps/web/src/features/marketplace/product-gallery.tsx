'use client';

import { Package } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/format';

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  if (images.length === 0) {
    return <div className="card grid aspect-square place-items-center"><Package className="h-16 w-16 text-ink-600" /></div>;
  }
  return (
    <div className="min-w-0">
      <div className="card aspect-square overflow-hidden p-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[active]} alt={name} className="h-full w-full object-cover" />
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <button key={src} type="button" onClick={() => setActive(i)} className={cn('h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition', i === active ? 'border-sun-400' : 'border-transparent opacity-70 hover:opacity-100')} aria-label={`Image ${i + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
