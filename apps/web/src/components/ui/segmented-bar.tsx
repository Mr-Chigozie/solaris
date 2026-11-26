import { cn } from '@/lib/format';

/** Battery-style segmented meter. `value` 0–1. */
export function SegmentedBar({
  value,
  segments = 18,
  tone = 'volt',
  className,
  label,
}: {
  value: number;
  segments?: number;
  tone?: 'volt' | 'sun';
  className?: string;
  label?: string;
}) {
  const filled = Math.round(Math.max(0, Math.min(1, value)) * segments);
  const on = tone === 'volt' ? 'bg-volt-400 shadow-[0_0_12px_-2px_color-mix(in_oklab,var(--brand-secondary)_70%,transparent)]' : 'bg-sun-400 shadow-[0_0_12px_-2px_color-mix(in_oklab,var(--brand-primary)_70%,transparent)]';
  return (
    <div className={cn('flex h-8 gap-1', className)} role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={value} aria-label={label}>
      {Array.from({ length: segments }).map((_, i) => (
        <span key={i} className={cn('flex-1 rounded-md transition-colors duration-500', i < filled ? on : 'bg-white/[0.07]')} />
      ))}
    </div>
  );
}

/** Thin proportional split bar, e.g. day vs night energy. */
export function SplitBar({ parts, className }: { parts: Array<{ value: number; className: string; label: string }>; className?: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className={cn('flex h-2 overflow-hidden rounded-full bg-white/[0.06]', className)}>
      {parts.map((p) => (
        <span key={p.label} title={p.label} className={cn('h-full transition-all duration-500', p.className)} style={{ width: `${(p.value / total) * 100}%` }} />
      ))}
    </div>
  );
}
