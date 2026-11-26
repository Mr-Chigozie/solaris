import { BatteryFull, Cpu, MapPin, SunMedium } from 'lucide-react';
import Link from 'next/link';
import { cn, formatDate, formatNaira, formatNumber } from '@/lib/format';
import { STATUS_LABEL, type DesignSummary } from './types';

export function DesignCard({ d }: { d: DesignSummary }) {
  const status = STATUS_LABEL[d.status];
  return (
    <Link href={`/designs/${d.id}`} className="card group block p-5 transition hover:border-white/15">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-bold text-white group-hover:text-sun-200">{d.title}</h3>
          <p className="mt-1 flex items-center gap-1 text-xs text-ink-400">
            <MapPin className="h-3 w-3" /> {d.audit.city ? `${d.audit.city}, ` : ''}{d.audit.state.replace('Federal Capital Territory', 'FCT')} · {formatDate(d.createdAt)}
          </p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold', status.className)}>{status.label}</span>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
        <Spec icon={<SunMedium className="h-4 w-4 text-sun-400" />} value={`${formatNumber(d.arrayKw, 2)} kWp`} label={`${d.panelCount} panels`} />
        <Spec icon={<BatteryFull className="h-4 w-4 text-volt-400" />} value={`${formatNumber(d.batteryKwh, 1)} kWh`} label="storage" />
        <Spec icon={<Cpu className="h-4 w-4 text-ink-300" />} value={`${formatNumber(d.inverterKva, 1)} kVA`} label="inverter" />
      </div>
      <div className="mt-4 flex items-baseline justify-between border-t border-white/[0.06] pt-4">
        <span className="text-xs text-ink-400">{formatNumber(d.dailyKwh, 2)} kWh/day</span>
        <span className="font-bold text-sun-300">{formatNaira(d.estimatedCost)}</span>
      </div>
    </Link>
  );
}

function Spec({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] p-2.5">
      {icon}
      <div className="mt-1.5 font-bold text-white">{value}</div>
      <div className="text-ink-400">{label}</div>
    </div>
  );
}
