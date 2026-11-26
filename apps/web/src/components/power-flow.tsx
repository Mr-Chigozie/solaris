import { BatteryCharging, House, Sun, UtilityPole, Zap } from 'lucide-react';
import { cn } from '@/lib/format';

interface PowerFlowProps {
  solarLabel: string;
  homeLabel: string;
  batteryLabel: string;
  gridLabel: string;
  batteryLevel?: number;
  gridActive?: boolean;
  className?: string;
  caption?: string;
}

/**
 * Energy-flow diagram: array → inverter hub → home / battery / grid.
 * Animated dashed lines indicate direction of flow.
 */
export function PowerFlow({ solarLabel, homeLabel, batteryLabel, gridLabel, batteryLevel = 0.8, gridActive = false, className, caption }: PowerFlowProps) {
  return (
    <div className={cn('relative aspect-[5/4] w-full', className)}>
      <svg viewBox="0 0 400 320" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="pf-sun" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--brand-primary)' }} />
            <stop offset="1" style={{ stopColor: 'var(--brand-secondary)' }} />
          </linearGradient>
          <radialGradient id="pf-hub" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" style={{ stopColor: 'var(--brand-secondary)', stopOpacity: 0.35 }} />
            <stop offset="1" style={{ stopColor: 'var(--brand-secondary)', stopOpacity: 0 }} />
          </radialGradient>
        </defs>
        <circle cx="200" cy="160" r="70" fill="url(#pf-hub)" className="animate-pulse-soft" />
        {/* sun → hub */}
        <path d="M200 62 V128" stroke="url(#pf-sun)" strokeWidth="2.5" fill="none" strokeDasharray="6 6" className="animate-flow" />
        {/* hub → home */}
        <path d="M172 172 C 130 190, 100 200, 82 236" style={{ stroke: 'var(--brand-secondary)' }} strokeWidth="2.5" fill="none" strokeDasharray="6 6" className="animate-flow" />
        {/* hub → battery */}
        <path d="M228 172 C 270 190, 300 200, 318 236" style={{ stroke: 'var(--brand-secondary)' }} strokeWidth="2.5" fill="none" strokeDasharray="6 6" className="animate-flow" />
        {/* grid ↔ hub */}
        <path
          d="M200 192 V244"
          stroke={gridActive ? '#a3afc4' : 'rgba(255,255,255,0.15)'}
          strokeWidth="2"
          fill="none"
          strokeDasharray="4 6"
          className={gridActive ? 'animate-flow' : ''}
        />
      </svg>

      <Node className="left-1/2 top-[2%] -translate-x-1/2" icon={<Sun className="h-5 w-5 text-sun-400" />} title="Solar" value={solarLabel} glow="sun" />
      <div className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl border border-volt-400/30 bg-ink-850 shadow-[0_0_40px_-8px_color-mix(in_oklab,var(--brand-secondary)_60%,transparent)]">
        <Zap className="h-7 w-7 text-volt-300" />
      </div>
      <Node className="bottom-[2%] left-[2%]" icon={<House className="h-5 w-5 text-volt-300" />} title="Home" value={homeLabel} />
      <Node
        className="bottom-[2%] right-[2%]"
        icon={<BatteryCharging className="h-5 w-5 text-volt-300" />}
        title="Battery"
        value={batteryLabel}
        extra={
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-volt-400" style={{ width: `${Math.round(batteryLevel * 100)}%` }} />
          </div>
        }
      />
      <Node className="bottom-[2%] left-1/2 -translate-x-1/2" icon={<UtilityPole className="h-5 w-5 text-ink-300" />} title="Grid" value={gridLabel} muted={!gridActive} />
      {caption && <p className="absolute -bottom-7 left-0 right-0 text-center text-[11px] text-ink-400">{caption}</p>}
    </div>
  );
}

function Node({ className, icon, title, value, extra, glow, muted }: { className: string; icon: React.ReactNode; title: string; value: string; extra?: React.ReactNode; glow?: 'sun'; muted?: boolean }) {
  return (
    <div
      className={cn(
        'absolute min-w-[104px] rounded-2xl border border-white/10 bg-ink-850/90 px-3 py-2.5 backdrop-blur',
        glow === 'sun' && 'shadow-[0_0_36px_-10px_color-mix(in_oklab,var(--brand-primary)_70%,transparent)]',
        muted && 'opacity-60',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wider text-ink-400">{title}</span>
      </div>
      <div className="mt-1 text-sm font-bold text-white">{value}</div>
      {extra}
    </div>
  );
}
