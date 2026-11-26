import { BATTERY_CHEMISTRY_PROFILES } from './assumptions';
import { round } from './math';
import type { BatteryRecommendation, EngineeringAssumptions, EnergyAnalysis } from './types';

/**
 * DC bus voltage. Driven primarily by the inverter class sold in Nigeria
 * (≤1 kVA → 12 V, 1.5–2.5 kVA → 24 V, ≥3.5 kVA → 48 V); storage only pushes the
 * voltage up when the bank would otherwise need very high currents / many parallel strings.
 */
export function selectBankVoltage(inverterKva: number, nominalKwh: number): 12 | 24 | 48 {
  if (inverterKva >= 3.5 || nominalKwh > 12) return 48;
  if (inverterKva >= 1.5 || nominalKwh > 2.5) return 24;
  return 12;
}

/**
 * Stage B — battery sizing.
 *
 *   storage energy per day  = grid available ? backup energy
 *                                            : max(night-time energy, backup energy)
 *   usable kWh              = storage energy × autonomy days
 *   nominal kWh             = usable kWh / (DoD × η_inverter × η_battery,discharge)
 *
 * where η_battery,discharge = √(round-trip efficiency) — half of the round-trip loss
 * is attributed to discharge, the other half to charging (see panels.ts).
 */
export function sizeBattery(
  energy: EnergyAnalysis,
  inverterKva: number,
  gridAvailable: boolean,
  autonomyDays: number,
  a: EngineeringAssumptions,
): BatteryRecommendation {
  const dailyStorageKwh = gridAvailable
    ? energy.backupKwh
    : Math.max(energy.nighttimeKwh, energy.backupKwh);
  const requiredUsableKwh = dailyStorageKwh * Math.max(autonomyDays, 0);

  const dischargeEfficiency = Math.sqrt(a.batteryRoundTripEfficiency);
  const requiredNominalKwh =
    requiredUsableKwh / (a.batteryDepthOfDischarge * a.inverterEfficiency * dischargeEfficiency);

  const bankVoltage = selectBankVoltage(inverterKva, requiredNominalKwh);
  const requiredAh = (requiredNominalKwh * 1000) / bankVoltage;

  if (requiredUsableKwh <= 0) {
    return {
      required: false,
      chemistry: a.batteryChemistry,
      requiredUsableKwh: 0,
      requiredNominalKwh: 0,
      bankVoltage,
      requiredAh: 0,
      configuration: null,
    };
  }

  const profile = BATTERY_CHEMISTRY_PROFILES[a.batteryChemistry];
  // LiFePO4 modules are bought at the bank voltage (e.g. 51.2 V 100 Ah); lead-acid as 12 V blocks.
  const isLithium = a.batteryChemistry === 'LIFEPO4';
  const unitNominalVoltage = isLithium ? bankVoltage * (12.8 / 12) : profile.unitVoltage;
  const unitsInSeries = isLithium ? 1 : bankVoltage / profile.unitVoltage;
  const stringsInParallel = Math.max(1, Math.ceil(requiredAh / profile.unitAh));
  const totalUnits = unitsInSeries * stringsInParallel;
  const installedNominalKwh = (totalUnits * unitNominalVoltage * profile.unitAh) / 1000;

  return {
    required: true,
    chemistry: a.batteryChemistry,
    requiredUsableKwh: round(requiredUsableKwh, 2),
    requiredNominalKwh: round(requiredNominalKwh, 2),
    bankVoltage,
    requiredAh: round(requiredAh, 0),
    configuration: {
      unitDescription: isLithium
        ? `${round(unitNominalVoltage, 1)} V ${profile.unitAh} Ah LiFePO4 module`
        : `12 V ${profile.unitAh} Ah ${a.batteryChemistry === 'LEAD_ACID_TUBULAR' ? 'tubular' : 'AGM/gel'} battery`,
      unitNominalVoltage: round(unitNominalVoltage, 1),
      unitAh: profile.unitAh,
      unitsInSeries,
      stringsInParallel,
      totalUnits,
      installedNominalKwh: round(installedNominalKwh, 2),
      installedUsableKwh: round(installedNominalKwh * a.batteryDepthOfDischarge, 2),
    },
  };
}
