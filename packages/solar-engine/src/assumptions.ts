import type {
  AssumptionOverrides,
  BatteryChemistry,
  CostAssumptions,
  EngineeringAssumptions,
  SolarDesignBasis,
  SolarResource,
} from './types';

/**
 * Battery chemistry profiles. Usable depth of discharge and round-trip efficiency
 * are conservative design values, not manufacturer maximums.
 */
export const BATTERY_CHEMISTRY_PROFILES: Record<
  BatteryChemistry,
  { label: string; depthOfDischarge: number; roundTripEfficiency: number; unitAh: number; unitVoltage: number }
> = {
  LIFEPO4: { label: 'Lithium iron phosphate (LiFePO4)', depthOfDischarge: 0.9, roundTripEfficiency: 0.95, unitAh: 100, unitVoltage: 0 /* module matches bank voltage */ },
  LEAD_ACID_AGM: { label: 'Sealed lead-acid (AGM/gel)', depthOfDischarge: 0.5, roundTripEfficiency: 0.85, unitAh: 200, unitVoltage: 12 },
  LEAD_ACID_TUBULAR: { label: 'Tubular lead-acid', depthOfDischarge: 0.5, roundTripEfficiency: 0.8, unitAh: 220, unitVoltage: 12 },
};

/**
 * Reference prices (NGN). PLACEHOLDERS to validate against live vendor listings —
 * these change frequently with FX. Each saved design keeps the prices it used.
 */
export const DEFAULT_COST_ASSUMPTIONS: CostAssumptions = {
  currency: 'NGN',
  pricesReviewed: '2026-11',
  panelPricePerWatt: 280,
  batteryPricePerKwh: {
    LIFEPO4: 380_000,
    LEAD_ACID_AGM: 150_000,
    LEAD_ACID_TUBULAR: 135_000,
  },
  inverterPricePerKva: 180_000,
  balanceOfSystemFraction: 0.12,
  installationFraction: 0.1,
  logisticsFlat: 50_000,
  contingencyFraction: 0.05,
  estimateUncertaintyFraction: 0.15,
};

export const DEFAULT_ASSUMPTIONS: Omit<EngineeringAssumptions, 'peakSunHours' | 'batteryDepthOfDischarge' | 'batteryRoundTripEfficiency'> = {
  solarDesignBasis: 'ANNUAL_AVERAGE',
  solarDerating: 0.8,
  targetSolarFraction: 1,
  panelWatts: 550,
  batteryChemistry: 'LIFEPO4',
  inverterEfficiency: 0.93,
  powerFactor: 0.8,
  inverterDesignMargin: 1.25,
  inverterSurgeMultiplier: 2,
  defaultNightFraction: 0.5,
  chargeControllerSafetyFactor: 1.25,
  cost: DEFAULT_COST_ASSUMPTIONS,
};

export function pshForBasis(resource: SolarResource, basis: SolarDesignBasis): number {
  return basis === 'WORST_MONTH' ? resource.pshWorstMonth : resource.pshAnnual;
}

/**
 * Merge defaults, chemistry profile, location and user overrides into one fully
 * resolved, serialisable assumption set. Precedence: override > chemistry/location > default.
 */
export function resolveAssumptions(
  resource: SolarResource,
  chemistry: BatteryChemistry | undefined,
  overrides: AssumptionOverrides = {},
  referencePrices: Partial<CostAssumptions> = {},
): { assumptions: EngineeringAssumptions; overriddenKeys: string[] } {
  const batteryChemistry = overrides.batteryChemistry ?? chemistry ?? DEFAULT_ASSUMPTIONS.batteryChemistry;
  const profile = BATTERY_CHEMISTRY_PROFILES[batteryChemistry];
  const solarDesignBasis = overrides.solarDesignBasis ?? DEFAULT_ASSUMPTIONS.solarDesignBasis;

  const { cost: costOverrides, ...engineeringOverrides } = overrides;
  const definedOverrides = Object.fromEntries(
    Object.entries(engineeringOverrides).filter(([, v]) => v !== undefined),
  ) as Partial<EngineeringAssumptions>;

  const assumptions: EngineeringAssumptions = {
    ...DEFAULT_ASSUMPTIONS,
    batteryChemistry,
    solarDesignBasis,
    peakSunHours: pshForBasis(resource, solarDesignBasis),
    batteryDepthOfDischarge: profile.depthOfDischarge,
    batteryRoundTripEfficiency: profile.roundTripEfficiency,
    ...definedOverrides,
    cost: {
      ...DEFAULT_COST_ASSUMPTIONS,
      ...referencePrices,
      ...costOverrides,
      currency: 'NGN',
      batteryPricePerKwh: {
        ...DEFAULT_COST_ASSUMPTIONS.batteryPricePerKwh,
        ...(referencePrices.batteryPricePerKwh ?? {}),
        ...(costOverrides?.batteryPricePerKwh ?? {}),
      },
    },
  };

  const overriddenKeys = Object.keys(definedOverrides).filter(
    (k) => k !== 'batteryChemistry' && k !== 'solarDesignBasis',
  );
  if (costOverrides && Object.keys(costOverrides).length > 0) overriddenKeys.push('cost');

  return { assumptions, overriddenKeys };
}
