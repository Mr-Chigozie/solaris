'use client';

import { cn } from '@/lib/format';

export function SectionTabs({ items, active, onChange }: { items: Array<[string, string]>; active: string; onChange: (k: string) => void }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {items.map(([k, label]) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={cn('rounded-full px-4 py-1.5 text-sm font-semibold transition', active === k ? 'bg-sun-400 text-ink-950' : 'bg-white/[0.05] text-ink-300 hover:text-white')}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
