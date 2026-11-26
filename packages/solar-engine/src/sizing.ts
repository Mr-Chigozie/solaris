import { resolveAssumptions } from './assumptions';
import { sizeBattery } from './battery';
import { estimateCost } from './cost';
import { NATIONAL_FALLBACK, SOLAR_DATA_VERSION, findState } from './data/locations';
import { analyseEnergy, normaliseLoads, type NormalisedLoad } from './energy';
import { sizeInverter } from './inverter';
import { sizeChargeController, sizeSolarArray } from './panels';
import type { DesignWarning, SizingInput, SizingResult } from './types';
import { ENGINE_VERSION } from './version';

export class SizingInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SizingInputError';
  }
}

/**
 * Full calculation pipeline: validate → energy → inverter → battery → solar →
 * charge controller → cost → engineering checks.
 *
 * Pure and deterministic: the same input (and engine/data version) always produces
 * the same output, which is what makes saved designs and quotations reproducible.
 */
export function calculateSystem(input: SizingInput): SizingResult {
  if (!Array.isArray(input.appliances) || input.appliances.length === 0) {
    throw new SizingInputError('At least one appliance is required.');
  }

  const found = findState(input.location.state);
  const resource = found ?? NATIONAL_FALLBACK;
  const { assumptions: a, overriddenKeys } = resolveAssumptions(
    resource,
    input.batteryChemistry,
    input.assumptions,
    input.referencePrices,
  );

  const loads = normaliseLoads(input.appliances, a.defaultNightFraction);
  if (loads.length === 0) {
    throw new SizingInputError('Every appliance has zero quantity, watts or hours — nothing to size.');
  }

  const energy = analyseEnergy(loads, input.backupHours);
  const inverter = sizeInverter(energy, a);
  const battery = sizeBattery(energy, inverter.recommendedKva, input.gridAvailable, input.autonomyDays, a);
  const solar = sizeSolarArray(energy, resource, a);
  const chargeController = sizeChargeController(solar.installedArrayKw, battery.bankVoltage, a);
  const cost = estimateCost(solar, battery, inverter, a);

  const warnings = collectWarnings({ found: Boolean(found), loads, overriddenKeys, energy, inverter, battery, solar, gridAvailable: input.gridAvailable, a });

  return {
    engineVersion: ENGINE_VERSION,
    dataVersion: SOLAR_DATA_VERSION,
    status: 'ESTIMATED_REVIEW_REQUIRED',
    location: { ...resource, resolved: Boolean(found) },
    energy,
    inverter,
    battery,
    solar,
    chargeController,
    cost,
    assumptions: a,
    warnings,
  };
}

function collectWarnings(ctx: {
  found: boolean;
  loads: NormalisedLoad[];
  overriddenKeys: string[];
  energy: SizingResult['energy'];
  inverter: SizingResult['inverter'];
  battery: SizingResult['battery'];
  solar: SizingResult['solar'];
  gridAvailable: boolean;
  a: SizingResult['assumptions'];
}): DesignWarning[] {
  const w: DesignWarning[] = [];
  const { loads, inverter, battery, solar, a } = ctx;

  if (!ctx.found) {
    w.push({ code: 'UNKNOWN_LOCATION', severity: 'WARNING', message: 'Location not recognised — a conservative national solar resource value was used.' });
  }

  const surgeLoads = loads.filter((l) => l.surgeFactor >= 3);
  if (surgeLoads.length > 0) {
    w.push({
      code: 'HIGH_SURGE_LOAD',
      severity: 'WARNING',
      message: `Motor/compressor loads with high starting current: ${surgeLoads.map((l) => l.name).join(', ')}. The inverter was sized for surge; confirm against the inverter's datasheet surge rating.`,
    });
  }

  if (loads.some((l) => /air ?condition|\bac\b/i.test(l.name) || l.catalogId?.startsWith('ac-'))) {
    w.push({ code: 'AIR_CONDITIONING_LOAD', severity: 'INFO', message: 'Air conditioning dominates solar system cost. Inverter-type ACs and limiting night-time AC use significantly reduce battery size.' });
  }

  if (loads.some((l) => l.watts >= 1000 && l.surgeFactor === 1)) {
    w.push({ code: 'HIGH_HEATING_LOAD', severity: 'INFO', message: 'Heating appliances (iron, kettle, cooker) draw high power. Schedule them during peak sun hours.' });
  }

  if (solar.worstMonthCoverage < 0.9) {
    w.push({
      code: 'WORST_MONTH_SHORTFALL',
      severity: ctx.gridAvailable ? 'INFO' : 'WARNING',
      message: `In the lowest-irradiation month the array covers about ${Math.round(solar.worstMonthCoverage * 100)}% of daily needs. Expect to rely on grid or generator top-up, or size against the worst month.`,
    });
  }

  if (!battery.required) {
    w.push({ code: 'NO_BATTERY_STORAGE', severity: 'INFO', message: 'No battery storage was sized (zero backup hours). Loads will drop when there is no sun or grid.' });
  }

  if (battery.required && a.batteryChemistry !== 'LIFEPO4') {
    w.push({ code: 'LEAD_ACID_SHALLOW_DISCHARGE', severity: 'INFO', message: 'Lead-acid batteries are sized at 50% depth of discharge to protect cycle life, which roughly doubles the nominal capacity needed.' });
  }

  if (inverter.exceedsStandardRange) {
    w.push({ code: 'INVERTER_EXCEEDS_STANDARD_RANGE', severity: 'CRITICAL', message: 'The load exceeds a single standard inverter. This needs parallel inverters or a three-phase design by a qualified engineer.' });
  }

  if (inverter.recommendedKva > 15 || solar.installedArrayKw > 20) {
    w.push({ code: 'LARGE_SYSTEM', severity: 'WARNING', message: 'Commercial-scale system: a site survey and engineered design are required before quotation.' });
  }

  if (ctx.overriddenKeys.length > 0) {
    w.push({ code: 'ASSUMPTION_OVERRIDDEN', severity: 'INFO', message: `Custom assumptions applied: ${ctx.overriddenKeys.join(', ')}.` });
  }

  w.push({
    code: 'ENGINEERING_REVIEW_REQUIRED',
    severity: 'INFO',
    message: 'This is a calculated estimate, not an installer-approved design. Final sizing must be confirmed by a qualified installer against equipment datasheets and a site survey.',
  });

  return w;
}
