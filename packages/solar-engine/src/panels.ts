import { round } from './math';
import type {
  ChargeControllerRecommendation,
  EngineeringAssumptions,
  EnergyAnalysis,
  SolarArrayRecommendation,
  SolarResource,
} from './types';

/**
 * Stage C — solar array sizing.
 *
 *   generation needed = (daytime kWh / η_inv  +  night-time kWh / (η_inv × η_rt)) × solar fraction
 *   array kWp         = generation needed / (PSH × derating)
 *
 * Daytime loads are served directly through the inverter; night-time loads pass
 * through the battery first, so they also incur the round-trip battery loss.
 * PSH comes from location-specific irradiation (annual mean or worst month).
 */
export function sizeSolarArray(
  energy: EnergyAnalysis,
  resource: SolarResource,
  a: EngineeringAssumptions,
): SolarArrayRecommendation {
  const directKwh = energy.daytimeKwh / a.inverterEfficiency;
  const viaBatteryKwh = energy.nighttimeKwh / (a.inverterEfficiency * a.batteryRoundTripEfficiency);
  const requiredGenerationKwh = (directKwh + viaBatteryKwh) * a.targetSolarFraction;

  const psh = a.peakSunHours;
  const requiredArrayKw = psh > 0 ? requiredGenerationKwh / (psh * a.solarDerating) : 0;
  const panelCount = requiredArrayKw > 0 ? Math.ceil((requiredArrayKw * 1000) / a.panelWatts) : 0;
  const installedArrayKw = (panelCount * a.panelWatts) / 1000;

  const annualAverage = installedArrayKw * resource.pshAnnual * a.solarDerating;
  const worstMonth = installedArrayKw * resource.pshWorstMonth * a.solarDerating;

  return {
    peakSunHoursUsed: psh,
    designBasis: a.solarDesignBasis,
    requiredGenerationKwh: round(requiredGenerationKwh, 3),
    requiredArrayKw: round(requiredArrayKw, 3),
    panelWatts: a.panelWatts,
    panelCount,
    installedArrayKw: round(installedArrayKw, 3),
    expectedDailyGenerationKwh: { annualAverage: round(annualAverage, 2), worstMonth: round(worstMonth, 2) },
    worstMonthCoverage: requiredGenerationKwh > 0 ? round(Math.min(1, worstMonth / requiredGenerationKwh), 3) : 1,
  };
}

/** MPPT charge current needed at the battery bank voltage. */
export function sizeChargeController(
  installedArrayKw: number,
  bankVoltage: number,
  a: EngineeringAssumptions,
): ChargeControllerRecommendation {
  return {
    requiredMpptCurrentA: round(((installedArrayKw * 1000) / bankVoltage) * a.chargeControllerSafetyFactor, 0),
    atBankVoltage: bankVoltage,
  };
}
