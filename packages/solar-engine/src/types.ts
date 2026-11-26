/**
 * SOLARIS solar engine — public types.
 *
 * Units are encoded in every field name (W, Wh, kWh, kW, kVA, V, Ah, NGN) so that
 * energy (kWh) is never confused with power (kW), and real power (kW) is never
 * confused with apparent power (kVA).
 */

export type BatteryChemistry = 'LIFEPO4' | 'LEAD_ACID_AGM' | 'LEAD_ACID_TUBULAR';

/** Which solar resource figure the array is sized against. */
export type SolarDesignBasis = 'ANNUAL_AVERAGE' | 'WORST_MONTH';

export type ApplianceCategory =
  | 'LIGHTING'
  | 'COOLING'
  | 'REFRIGERATION'
  | 'ENTERTAINMENT'
  | 'OFFICE'
  | 'KITCHEN'
  | 'LAUNDRY'
  | 'WATER'
  | 'SECURITY'
  | 'OTHER';

export interface ApplianceLoad {
  /** Optional reference to a catalogue entry (used to fill in surge factor). */
  catalogId?: string;
  name: string;
  quantity: number;
  /** Rated running power per unit, in watts. */
  watts: number;
  /** Total operating hours per day, 0–24. */
  hoursPerDay: number;
  /** Of `hoursPerDay`, how many fall outside solar hours. Defaults to an assumption. */
  nightHoursPerDay?: number;
  /** Whether this appliance runs at the same time as the other loads. Default true. */
  simultaneousUse?: boolean;
  /** Starting surge multiple of running watts (motors/compressors ≈ 3). Default from catalogue or 1. */
  surgeFactor?: number;
}

export interface SizingInput {
  location: { state: string; city?: string };
  appliances: ApplianceLoad[];
  /** Is there a (possibly unreliable) grid connection? */
  gridAvailable: boolean;
  /** Hours the battery must carry the load during an outage / after sunset. */
  backupHours: number;
  /** Days of storage without any recharge. */
  autonomyDays: number;
  batteryChemistry?: BatteryChemistry;
  /** Optional overrides of engineering and cost assumptions (user-supplied, flagged in warnings). */
  assumptions?: AssumptionOverrides;
  /** Platform reference prices (admin-managed). A baseline, not a user override. */
  referencePrices?: Partial<CostAssumptions>;
}

export interface CostAssumptions {
  currency: 'NGN';
  /** ISO month the reference prices were last reviewed. */
  pricesReviewed: string;
  panelPricePerWatt: number;
  batteryPricePerKwh: Record<BatteryChemistry, number>;
  inverterPricePerKva: number;
  /** Cables, breakers, surge protection, mounting, as a fraction of equipment cost. */
  balanceOfSystemFraction: number;
  /** Labour as a fraction of equipment + BOS. */
  installationFraction: number;
  logisticsFlat: number;
  contingencyFraction: number;
  /** ± band applied to the total to express estimate uncertainty. */
  estimateUncertaintyFraction: number;
}

export interface EngineeringAssumptions {
  /** Peak sun hours used for array sizing (kWh/m²/day). Derived from location unless overridden. */
  peakSunHours: number;
  solarDesignBasis: SolarDesignBasis;
  /** Combined PV losses: temperature, soiling, wiring, mismatch, MPPT. */
  solarDerating: number;
  /** Fraction of daily energy the array should supply (1 = full solar coverage). */
  targetSolarFraction: number;
  panelWatts: number;
  batteryChemistry: BatteryChemistry;
  batteryDepthOfDischarge: number;
  batteryRoundTripEfficiency: number;
  inverterEfficiency: number;
  powerFactor: number;
  /** Continuous-rating headroom over the simultaneous peak load. */
  inverterDesignMargin: number;
  /** Short-duration surge capability of the inverter as a multiple of its rating. */
  inverterSurgeMultiplier: number;
  /** When an appliance has no night hours specified, this fraction of its hours is assumed to be at night. */
  defaultNightFraction: number;
  /** Charge controller current headroom (NEC-style 1.25). */
  chargeControllerSafetyFactor: number;
  cost: CostAssumptions;
}

export type AssumptionOverrides = Partial<Omit<EngineeringAssumptions, 'cost'>> & {
  cost?: Partial<CostAssumptions>;
};

export interface SolarResource {
  state: string;
  stateCode: string;
  capital: string;
  zone: GeoZone;
  latitude: number;
  longitude: number;
  /** Annual mean daily global horizontal irradiation ≈ peak sun hours. */
  pshAnnual: number;
  /** Lowest monthly mean (rainy season in the south, August/Harmattan in the north). */
  pshWorstMonth: number;
}

export type GeoZone =
  | 'NORTH_CENTRAL'
  | 'NORTH_EAST'
  | 'NORTH_WEST'
  | 'SOUTH_EAST'
  | 'SOUTH_SOUTH'
  | 'SOUTH_WEST';

export interface EnergyBreakdownItem {
  name: string;
  quantity: number;
  watts: number;
  hoursPerDay: number;
  nightHoursPerDay: number;
  dailyWh: number;
  shareOfTotal: number;
}

export interface EnergyAnalysis {
  dailyWh: number;
  dailyKwh: number;
  daytimeKwh: number;
  nighttimeKwh: number;
  /** Energy needed to carry loads for `backupHours`. */
  backupKwh: number;
  /** Sum of running watts of appliances that can run together. */
  peakLoadW: number;
  /** Peak load plus the single largest starting surge. */
  peakSurgeW: number;
  /** 24-hour average load (daily energy / 24 h). */
  averageLoadW: number;
  items: EnergyBreakdownItem[];
}

export interface InverterRecommendation {
  requiredContinuousW: number;
  requiredKva: number;
  requiredSurgeVa: number;
  recommendedKva: number;
  /** Indicative real-power rating at the assumed power factor. */
  recommendedKw: number;
  surgeCapacityVa: number;
  exceedsStandardRange: boolean;
}

export interface BatteryRecommendation {
  required: boolean;
  chemistry: BatteryChemistry;
  /** Energy the bank must actually deliver to the loads (per autonomy period). */
  requiredUsableKwh: number;
  requiredNominalKwh: number;
  bankVoltage: 12 | 24 | 48;
  requiredAh: number;
  configuration: {
    unitDescription: string;
    unitNominalVoltage: number;
    unitAh: number;
    unitsInSeries: number;
    stringsInParallel: number;
    totalUnits: number;
    installedNominalKwh: number;
    installedUsableKwh: number;
  } | null;
}

export interface SolarArrayRecommendation {
  peakSunHoursUsed: number;
  designBasis: SolarDesignBasis;
  /** Energy the array must harvest per day after accounting for conversion losses. */
  requiredGenerationKwh: number;
  requiredArrayKw: number;
  panelWatts: number;
  panelCount: number;
  installedArrayKw: number;
  expectedDailyGenerationKwh: { annualAverage: number; worstMonth: number };
  /** Fraction of the generation requirement met in the worst month (capped at 1). */
  worstMonthCoverage: number;
}

export interface ChargeControllerRecommendation {
  /** For hybrid inverters this is the built-in MPPT capacity to check against. */
  requiredMpptCurrentA: number;
  atBankVoltage: number;
}

export interface CostLineItem {
  code: 'SOLAR_PANELS' | 'BATTERY_BANK' | 'INVERTER' | 'BALANCE_OF_SYSTEM' | 'INSTALLATION' | 'LOGISTICS' | 'CONTINGENCY';
  label: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
}

export interface CostEstimate {
  currency: 'NGN';
  pricesReviewed: string;
  lineItems: CostLineItem[];
  equipmentSubtotal: number;
  total: number;
  range: { low: number; high: number };
}

export type WarningSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface DesignWarning {
  code:
    | 'ENGINEERING_REVIEW_REQUIRED'
    | 'UNKNOWN_LOCATION'
    | 'HIGH_SURGE_LOAD'
    | 'AIR_CONDITIONING_LOAD'
    | 'WORST_MONTH_SHORTFALL'
    | 'NO_BATTERY_STORAGE'
    | 'LEAD_ACID_SHALLOW_DISCHARGE'
    | 'LARGE_SYSTEM'
    | 'INVERTER_EXCEEDS_STANDARD_RANGE'
    | 'ASSUMPTION_OVERRIDDEN'
    | 'HIGH_HEATING_LOAD';
  severity: WarningSeverity;
  message: string;
}

export type DesignResultStatus = 'ESTIMATED_REVIEW_REQUIRED';

export interface SizingResult {
  engineVersion: string;
  dataVersion: string;
  status: DesignResultStatus;
  location: SolarResource & { resolved: boolean };
  energy: EnergyAnalysis;
  inverter: InverterRecommendation;
  battery: BatteryRecommendation;
  solar: SolarArrayRecommendation;
  chargeController: ChargeControllerRecommendation;
  cost: CostEstimate;
  /** The fully resolved assumptions used — persist these to reproduce the design later. */
  assumptions: EngineeringAssumptions;
  warnings: DesignWarning[];
}
