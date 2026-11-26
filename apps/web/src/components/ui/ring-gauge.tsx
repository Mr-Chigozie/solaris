import { cn } from '@/lib/format';

interface RingGaugeProps {
  /** 0–1 */
  value: number;
  size?: number;
  stroke?: number;
  tone?: 'sun' | 'volt';
  children?: React.ReactNode;
  className?: string;
  label?: string;
}

/** Circular progress gauge with a tick-marked track. */
export function RingGauge({ value, size = 132, stroke = 10, tone = 'sun', children, className, label }: RingGaugeProps) {
  const v = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2 - 6;
  const c = 2 * Math.PI * r;
  const color = tone === 'sun' ? 'var(--brand-primary)' : 'var(--brand-secondary)';
  const ticks = 48;

  return (
    <div className={cn('relative inline-grid place-items-center', className)} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {Array.from({ length: ticks }).map((_, i) => {
          const a = (i / ticks) * 2 * Math.PI;
          const r1 = size / 2 - 1;
          const r2 = size / 2 - 4;
          const on = i / ticks <= v;
          return (
            <line
              key={i}
              x1={size / 2 + r1 * Math.cos(a)}
              y1={size / 2 + r1 * Math.sin(a)}
              x2={size / 2 + r2 * Math.cos(a)}
              y2={size / 2 + r2 * Math.sin(a)}
              style={{ stroke: on ? color : 'rgba(255,255,255,0.12)' }}
              strokeWidth={1.4}
              strokeLinecap="round"
            />
          );
        })}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ stroke: color, transition: 'stroke-dashoffset 700ms cubic-bezier(.2,.8,.2,1)', filter: `drop-shadow(0 0 10px color-mix(in oklab, ${color} 35%, transparent))` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
