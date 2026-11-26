'use client';

import type { DesignWarning, SizingResult } from '@solaris/solar-engine';
import { AlertTriangle, BatteryFull, ChevronDown, Cpu, Info, Moon, Sun, SunMedium, Zap } from 'lucide-react';
import { useState } from 'react';
import { RingGauge } from '@/components/ui/ring-gauge';
import { SegmentedBar, SplitBar } from '@/components/ui/segmented-bar';
import { cn, formatNaira, formatNairaCompact, formatNumber } from '@/lib/format';

const CHEMISTRY_LABEL = { LIFEPO4: 'LiFePO4 lithium', LEAD_ACID_AGM: 'AGM / gel', LEAD_ACID_TUBULAR: 'Tubular lead-acid' } as const;

export function DesignResults({ result, busy = false }: { result: SizingResult; busy?: boolean }) {
  const { energy, inverter, battery, solar, cost, chargeController } = result;
  const inverterLoad = inverter.recommendedKva > 0 ? inverter.requiredKva / inverter.recommendedKva : 0;
  const storageCoverage = battery.configuration ? battery.requiredNominalKwh / battery.configuration.installedNominalKwh : 0;

  return (
    <div className={cn('space-y-4 transition-opacity duration-300', busy && 'opacity-60')} aria-busy={busy}>
      <div className="flex items-start gap-3 rounded-2xl border border-sun-400/25 bg-sun-400/[0.07] px-4 py-3 text-sm text-sun-100">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sun-400" />
        <p>
          <strong className="font-semibold text-sun-200">Calculated estimate.</strong>{' '}
          <span className="text-sun-100/80">Not an installer-approved design. Confirm with a qualified installer after a site survey.</span>
        </p>
      </div>

      {/* Headline metrics */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <Label icon={<Sun className="h-4 w-4 text-sun-400" />}>Daily energy use</Label>
          <Metric value={formatNumber(energy.dailyKwh, 2)} unit="kWh" />
          <SplitBar
            className="mt-4"
            parts={[
              { value: energy.daytimeKwh, className: 'bg-sun-400', label: 'Daytime' },
              { value: energy.nighttimeKwh, className: 'bg-volt-500', label: 'Night-time' },
            ]}
          />
          <div className="mt-2 flex justify-between text-xs text-ink-400">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sun-400" /> Day {formatNumber(energy.daytimeKwh, 1)} kWh</span>
            <span className="flex items-center gap-1"><Moon className="h-3 w-3 text-volt-400" /> Night {formatNumber(energy.nighttimeKwh, 1)} kWh</span>
          </div>
        </div>

        <div className="card p-5">
          <Label icon={<Zap className="h-4 w-4 text-volt-400" />}>Peak demand</Label>
          <Metric value={formatNumber(energy.peakLoadW / 1000, 2)} unit="kW" />
          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl bg-white/[0.04] p-2.5">
              <dt className="text-ink-400">Starting surge</dt>
              <dd className="mt-0.5 text-sm font-semibold text-white">{formatNumber(energy.peakSurgeW / 1000, 2)} kW</dd>
            </div>
            <div className="rounded-xl bg-white/[0.04] p-2.5">
              <dt className="text-ink-400">24-h average</dt>
              <dd className="mt-0.5 text-sm font-semibold text-white">{formatNumber(energy.averageLoadW, 0)} W</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* System recommendation */}
      <div className="card p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Recommended system</h3>
          <span className="pill">{result.location.capital}, {result.location.state.replace('Federal Capital Territory', 'FCT')}</span>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
          <RingGauge value={inverterLoad} tone="sun" label={`Inverter ${inverter.recommendedKva} kVA`} className="mx-auto">
            <div>
              <div className="text-3xl font-extrabold text-white">{inverter.recommendedKva}</div>
              <div className="text-xs font-semibold text-ink-400">kVA inverter</div>
            </div>
          </RingGauge>

          <div className="grid gap-3">
            <SystemRow
              icon={<SunMedium className="h-5 w-5 text-sun-400" />}
              title={`${solar.panelCount} × ${solar.panelWatts} W panels`}
              detail={`${formatNumber(solar.installedArrayKw, 2)} kWp array · ${solar.peakSunHoursUsed} peak sun hours (${solar.designBasis === 'WORST_MONTH' ? 'worst month' : 'annual average'})`}
            />
            <SystemRow
              icon={<BatteryFull className="h-5 w-5 text-volt-400" />}
              title={
                battery.configuration
                  ? `${formatNumber(battery.configuration.installedNominalKwh, 2)} kWh ${CHEMISTRY_LABEL[battery.chemistry]}`
                  : 'No battery storage'
              }
              detail={
                battery.configuration
                  ? `${battery.configuration.totalUnits} × ${battery.configuration.unitDescription} · ${battery.bankVoltage} V bank · ${formatNumber(battery.configuration.installedUsableKwh, 1)} kWh usable`
                  : 'Increase backup hours to add storage'
              }
            />
            <SystemRow
              icon={<Cpu className="h-5 w-5 text-ink-300" />}
              title={`${inverter.recommendedKva} kVA hybrid inverter`}
              detail={`Load ${formatNumber(inverter.requiredKva, 2)} kVA · surge capacity ${formatNumber(inverter.surgeCapacityVa / 1000, 1)} kVA · MPPT ≥ ${chargeController.requiredMpptCurrentA} A @ ${chargeController.atBankVoltage} V`}
            />
          </div>
        </div>

        {battery.configuration && (
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-xs text-ink-400">
              <span>Storage required vs installed</span>
              <span className="font-semibold text-volt-300">{formatNumber(battery.requiredNominalKwh, 1)} / {formatNumber(battery.configuration.installedNominalKwh, 1)} kWh</span>
            </div>
            <SegmentedBar value={storageCoverage} label="Battery storage required versus installed" />
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl bg-white/[0.04] p-3">
            <div className="text-ink-400">Expected generation (avg.)</div>
            <div className="mt-1 text-base font-bold text-white">{formatNumber(solar.expectedDailyGenerationKwh.annualAverage, 1)} kWh/day</div>
          </div>
          <div className="rounded-xl bg-white/[0.04] p-3">
            <div className="text-ink-400">Worst month coverage</div>
            <div className={cn('mt-1 text-base font-bold', solar.worstMonthCoverage < 0.9 ? 'text-sun-300' : 'text-volt-300')}>
              {Math.round(solar.worstMonthCoverage * 100)}%
            </div>
          </div>
        </div>
      </div>

      {/* Cost */}
      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-white">Estimated cost</h3>
            <p className="mt-0.5 text-xs text-ink-400">Reference prices reviewed {cost.pricesReviewed} · actual quotes vary</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold text-sun-300">{formatNaira(cost.total)}</div>
            <div className="text-xs text-ink-400">
              Range {formatNairaCompact(cost.range.low)} – {formatNairaCompact(cost.range.high)}
            </div>
          </div>
        </div>
        <table className="mt-5 w-full text-sm">
          <tbody className="divide-y divide-white/[0.06]">
            {cost.lineItems.map((i) => (
              <tr key={i.code}>
                <td className="py-2.5 pr-3 text-ink-300">
                  {i.label}
                  {i.quantity > 1 && <span className="text-ink-400"> × {i.quantity}</span>}
                </td>
                <td className="py-2.5 text-right font-medium text-white">{formatNaira(i.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Breakdown */}
      <div className="card p-5 sm:p-6">
        <h3 className="text-base font-bold text-white">Where your energy goes</h3>
        <ul className="mt-4 space-y-3">
          {energy.items.slice(0, 8).map((i) => (
            <li key={i.name}>
              <div className="flex justify-between text-xs">
                <span className="text-ink-300">{i.quantity > 1 ? `${i.quantity} × ` : ''}{i.name}</span>
                <span className="font-semibold text-white">{formatNumber(i.dailyWh / 1000, 2)} kWh · {Math.round(i.shareOfTotal * 100)}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-gradient-to-r from-sun-400 to-volt-400" style={{ width: `${Math.max(2, i.shareOfTotal * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <Warnings warnings={result.warnings} />
      <Assumptions result={result} />
    </div>
  );
}

function Label({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
      {icon}
      {children}
    </div>
  );
}

function Metric({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="mt-2 flex items-baseline gap-1.5">
      <span className="text-4xl font-extrabold tracking-tight text-white">{value}</span>
      <span className="text-sm font-semibold text-ink-400">{unit}</span>
    </div>
  );
}

function SystemRow({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/[0.06] bg-ink-900/50 p-3.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.05]">{icon}</span>
      <div className="min-w-0">
        <div className="text-sm font-bold text-white">{title}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-ink-400">{detail}</div>
      </div>
    </div>
  );
}

function Warnings({ warnings }: { warnings: DesignWarning[] }) {
  const important = warnings.filter((w) => w.code !== 'ENGINEERING_REVIEW_REQUIRED');
  if (important.length === 0) return null;
  return (
    <div className="card space-y-2.5 p-5 sm:p-6">
      <h3 className="text-base font-bold text-white">Engineering notes</h3>
      {important.map((w) => (
        <div
          key={w.code}
          className={cn(
            'flex gap-3 rounded-xl p-3 text-sm',
            w.severity === 'CRITICAL' ? 'bg-red-500/10 text-red-200' : w.severity === 'WARNING' ? 'bg-sun-400/[0.08] text-sun-100' : 'bg-white/[0.04] text-ink-300',
          )}
        >
          {w.severity === 'INFO' ? <Info className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          <p>{w.message}</p>
        </div>
      ))}
    </div>
  );
}

function Assumptions({ result }: { result: SizingResult }) {
  const [open, setOpen] = useState(false);
  const a = result.assumptions;
  const rows: Array<[string, string]> = [
    ['Peak sun hours', `${a.peakSunHours} h/day (${a.solarDesignBasis === 'WORST_MONTH' ? 'worst month' : 'annual average'})`],
    ['Location resource', `${result.location.pshAnnual} avg · ${result.location.pshWorstMonth} worst month`],
    ['Solar derating (losses)', `${Math.round(a.solarDerating * 100)}%`],
    ['Battery depth of discharge', `${Math.round(a.batteryDepthOfDischarge * 100)}%`],
    ['Battery round-trip efficiency', `${Math.round(a.batteryRoundTripEfficiency * 100)}%`],
    ['Inverter efficiency', `${Math.round(a.inverterEfficiency * 100)}%`],
    ['Power factor', `${a.powerFactor}`],
    ['Inverter design margin', `${Math.round((a.inverterDesignMargin - 1) * 100)}% headroom`],
    ['Inverter surge capability', `${a.inverterSurgeMultiplier}× rating`],
    ['Engine / data version', `${result.engineVersion} · ${result.dataVersion}`],
  ];
  return (
    <div className="card overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between p-5 text-left sm:px-6" aria-expanded={open}>
        <span className="text-base font-bold text-white">Calculation assumptions</span>
        <ChevronDown className={cn('h-5 w-5 text-ink-400 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <dl className="divide-y divide-white/[0.06] border-t border-white/[0.06] px-5 text-sm sm:px-6">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2.5">
              <dt className="text-ink-400">{k}</dt>
              <dd className="text-right font-medium text-ink-100">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
