import { findCatalogAppliance } from './data/appliances';
import { clamp, round } from './math';
import type { ApplianceLoad, EnergyAnalysis, EnergyBreakdownItem } from './types';

export interface NormalisedLoad extends Required<Omit<ApplianceLoad, 'catalogId'>> {
  catalogId?: string;
}

/** Fill defaults (night hours, simultaneity, surge) from the catalogue and assumptions. */
export function normaliseLoads(loads: ApplianceLoad[], defaultNightFraction: number): NormalisedLoad[] {
  return loads
    .filter((l) => l.quantity > 0 && l.watts > 0 && l.hoursPerDay > 0)
    .map((l) => {
      const catalog = findCatalogAppliance(l.catalogId);
      const hours = clamp(l.hoursPerDay, 0, 24);
      const night = l.nightHoursPerDay ?? hours * (catalog?.typicalNightFraction ?? defaultNightFraction);
      return {
        ...l,
        hoursPerDay: hours,
        nightHoursPerDay: clamp(night, 0, hours),
        simultaneousUse: l.simultaneousUse ?? true,
        surgeFactor: Math.max(1, l.surgeFactor ?? catalog?.surgeFactor ?? 1),
      };
    });
}

/**
 * Stage A — energy analysis.
 *
 *   E_daily = Σ (W_i × Q_i × H_i) / 1000      [kWh]
 *
 * Also separates daytime from night-time energy (night energy must come from the
 * battery or grid), the energy needed to ride through `backupHours`, and the
 * simultaneous peak and starting-surge demand used for inverter sizing.
 */
export function analyseEnergy(loads: NormalisedLoad[], backupHours: number): EnergyAnalysis {
  let dailyWh = 0;
  let nightWh = 0;
  let backupWh = 0;
  let simultaneousW = 0;
  let largestNonSimultaneousW = 0;
  let largestSurgeIncrementW = 0;

  const raw = loads.map((l) => {
    const unitTotalW = l.watts * l.quantity;
    const itemDailyWh = unitTotalW * l.hoursPerDay;
    const itemNightWh = unitTotalW * l.nightHoursPerDay;
    dailyWh += itemDailyWh;
    nightWh += itemNightWh;
    backupWh += unitTotalW * Math.min(l.hoursPerDay, backupHours);

    if (l.simultaneousUse) simultaneousW += unitTotalW;
    else largestNonSimultaneousW = Math.max(largestNonSimultaneousW, unitTotalW);

    // Only one motor is assumed to start at a time: the extra surge of a single unit.
    largestSurgeIncrementW = Math.max(largestSurgeIncrementW, l.watts * (l.surgeFactor - 1));

    return { l, itemDailyWh };
  });

  const peakLoadW = Math.max(simultaneousW, largestNonSimultaneousW);

  const items: EnergyBreakdownItem[] = raw
    .map(({ l, itemDailyWh }) => ({
      name: l.name,
      quantity: l.quantity,
      watts: l.watts,
      hoursPerDay: l.hoursPerDay,
      nightHoursPerDay: round(l.nightHoursPerDay, 2),
      dailyWh: round(itemDailyWh, 1),
      shareOfTotal: dailyWh > 0 ? round(itemDailyWh / dailyWh, 4) : 0,
    }))
    .sort((a, b) => b.dailyWh - a.dailyWh);

  return {
    dailyWh: round(dailyWh, 1),
    dailyKwh: round(dailyWh / 1000, 3),
    daytimeKwh: round((dailyWh - nightWh) / 1000, 3),
    nighttimeKwh: round(nightWh / 1000, 3),
    backupKwh: round(backupWh / 1000, 3),
    peakLoadW: round(peakLoadW, 1),
    peakSurgeW: round(peakLoadW + largestSurgeIncrementW, 1),
    averageLoadW: round(dailyWh / 24, 1),
    items,
  };
}
