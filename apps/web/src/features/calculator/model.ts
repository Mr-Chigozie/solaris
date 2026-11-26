import type { BatteryChemistry, CatalogAppliance, SizingInput, SolarDesignBasis } from '@solaris/solar-engine';

export interface ApplianceRow {
  key: string;
  catalogId?: string;
  name: string;
  quantity: number;
  watts: number;
  hoursPerDay: number;
  nightHoursPerDay?: number;
  simultaneousUse: boolean;
  /** From the (admin-managed) catalogue, so new appliances size correctly. */
  surgeFactor?: number;
}

export interface AdvancedOptions {
  solarDesignBasis: SolarDesignBasis;
  peakSunHours?: number;
  panelWatts: number;
  solarDerating: number;
}

export interface CalculatorState {
  state: string;
  city: string;
  gridAvailable: boolean;
  backupHours: number;
  autonomyDays: number;
  batteryChemistry: BatteryChemistry;
  appliances: ApplianceRow[];
  advanced: AdvancedOptions;
}

export const STORAGE_KEY = 'solaris:calculator:v1';

let seq = 0;
export const newKey = () => `row-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export function rowFromCatalog(a: CatalogAppliance, quantity = 1): ApplianceRow {
  return {
    key: newKey(),
    catalogId: a.id,
    name: a.name,
    quantity,
    watts: a.defaultWatts,
    hoursPerDay: a.typicalHoursPerDay,
    nightHoursPerDay: Math.round(a.typicalHoursPerDay * a.typicalNightFraction * 10) / 10,
    simultaneousUse: true,
    surgeFactor: a.surgeFactor,
  };
}

/** A typical Nigerian 3-bedroom flat to start from. */
export const DEFAULT_STATE: CalculatorState = {
  state: 'FC',
  city: '',
  gridAvailable: true,
  backupHours: 10,
  autonomyDays: 1,
  batteryChemistry: 'LIFEPO4',
  advanced: { solarDesignBasis: 'ANNUAL_AVERAGE', panelWatts: 550, solarDerating: 0.8 },
  appliances: [
    { key: 'd1', catalogId: 'fridge', name: 'Refrigerator', quantity: 1, watts: 150, hoursPerDay: 12, nightHoursPerDay: 6, simultaneousUse: true },
    { key: 'd2', catalogId: 'led-bulb', name: 'LED bulb', quantity: 10, watts: 10, hoursPerDay: 6, nightHoursPerDay: 5.4, simultaneousUse: true },
    { key: 'd3', catalogId: 'ceiling-fan', name: 'Ceiling fan', quantity: 3, watts: 75, hoursPerDay: 10, nightHoursPerDay: 6, simultaneousUse: true },
    { key: 'd4', catalogId: 'tv-55', name: 'LED TV (55")', quantity: 1, watts: 120, hoursPerDay: 6, nightHoursPerDay: 3.6, simultaneousUse: true },
    { key: 'd5', catalogId: 'decoder', name: 'Satellite decoder', quantity: 1, watts: 20, hoursPerDay: 6, nightHoursPerDay: 3.6, simultaneousUse: true },
    { key: 'd6', catalogId: 'router', name: 'Wi-Fi router / modem', quantity: 1, watts: 15, hoursPerDay: 24, nightHoursPerDay: 12, simultaneousUse: true },
    { key: 'd7', catalogId: 'laptop', name: 'Laptop', quantity: 2, watts: 65, hoursPerDay: 6, nightHoursPerDay: 1.8, simultaneousUse: true },
  ],
};

export function isRowValid(r: ApplianceRow) {
  return (
    r.name.trim().length > 0 &&
    Number.isInteger(r.quantity) && r.quantity >= 1 &&
    r.watts > 0 &&
    r.hoursPerDay > 0 && r.hoursPerDay <= 24 &&
    (r.nightHoursPerDay === undefined || (r.nightHoursPerDay >= 0 && r.nightHoursPerDay <= r.hoursPerDay))
  );
}

/** Convert UI state into the API's SizingInput (only valid rows are sent). */
export function toSizingInput(s: CalculatorState): SizingInput {
  return {
    location: { state: s.state, ...(s.city.trim() ? { city: s.city.trim() } : {}) },
    gridAvailable: s.gridAvailable,
    backupHours: s.backupHours,
    autonomyDays: s.autonomyDays,
    batteryChemistry: s.batteryChemistry,
    appliances: s.appliances.filter(isRowValid).map(({ key: _key, ...r }) => ({
      ...(r.catalogId ? { catalogId: r.catalogId } : {}),
      name: r.name.trim(),
      quantity: r.quantity,
      watts: r.watts,
      hoursPerDay: r.hoursPerDay,
      ...(r.nightHoursPerDay !== undefined ? { nightHoursPerDay: r.nightHoursPerDay } : {}),
      simultaneousUse: r.simultaneousUse,
      ...(r.surgeFactor && r.surgeFactor >= 1 && r.surgeFactor <= 8 ? { surgeFactor: r.surgeFactor } : {}),
    })),
    assumptions: {
      solarDesignBasis: s.advanced.solarDesignBasis,
      ...(s.advanced.peakSunHours ? { peakSunHours: s.advanced.peakSunHours } : {}),
      ...(s.advanced.panelWatts !== 550 ? { panelWatts: s.advanced.panelWatts } : {}),
      ...(s.advanced.solarDerating !== 0.8 ? { solarDerating: s.advanced.solarDerating } : {}),
    },
  };
}

export function loadState(): CalculatorState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CalculatorState;
    if (!Array.isArray(parsed.appliances)) return null;
    return { ...DEFAULT_STATE, ...parsed, advanced: { ...DEFAULT_STATE.advanced, ...parsed.advanced } };
  } catch {
    return null;
  }
}

export function saveState(s: CalculatorState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable (private mode) — the calculator still works */
  }
}

export const CATEGORY_LABELS: Record<string, string> = {
  LIGHTING: 'Lighting',
  COOLING: 'Cooling',
  REFRIGERATION: 'Fridges',
  ENTERTAINMENT: 'TV & media',
  OFFICE: 'Office & IT',
  KITCHEN: 'Kitchen',
  LAUNDRY: 'Laundry',
  WATER: 'Water',
  SECURITY: 'Security',
  OTHER: 'Other',
};
