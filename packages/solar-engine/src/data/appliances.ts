import type { ApplianceCategory } from '../types';

export interface CatalogAppliance {
  id: string;
  name: string;
  category: ApplianceCategory;
  /** Typical running power per unit, in watts. */
  defaultWatts: number;
  /** Starting surge multiple of running power. */
  surgeFactor: number;
  /** A sensible starting value for the calculator. */
  typicalHoursPerDay: number;
  /** Typical share of operating hours after sunset. */
  typicalNightFraction: number;
  note?: string;
}

/**
 * Appliance reference catalogue for Nigerian homes and small businesses.
 * Wattages are typical nameplate/running values — users should edit them to match
 * their own equipment. Seeded into the `appliances` table; the engine uses the
 * surge factors when the client does not supply one.
 */
export const APPLIANCE_CATALOG: readonly CatalogAppliance[] = [
  // Lighting
  { id: 'led-bulb', name: 'LED bulb', category: 'LIGHTING', defaultWatts: 10, surgeFactor: 1, typicalHoursPerDay: 6, typicalNightFraction: 0.9 },
  { id: 'led-tube', name: 'LED tube light', category: 'LIGHTING', defaultWatts: 20, surgeFactor: 1, typicalHoursPerDay: 6, typicalNightFraction: 0.9 },
  { id: 'security-light', name: 'Outdoor security light', category: 'LIGHTING', defaultWatts: 30, surgeFactor: 1, typicalHoursPerDay: 12, typicalNightFraction: 1 },

  // Cooling
  { id: 'ceiling-fan', name: 'Ceiling fan', category: 'COOLING', defaultWatts: 75, surgeFactor: 1.5, typicalHoursPerDay: 10, typicalNightFraction: 0.6 },
  { id: 'standing-fan', name: 'Standing fan', category: 'COOLING', defaultWatts: 60, surgeFactor: 1.5, typicalHoursPerDay: 8, typicalNightFraction: 0.6 },
  { id: 'ac-1hp', name: 'Air conditioner (1 HP)', category: 'COOLING', defaultWatts: 900, surgeFactor: 3, typicalHoursPerDay: 6, typicalNightFraction: 0.6, note: 'Non-inverter compressor; high starting current.' },
  { id: 'ac-1-5hp', name: 'Air conditioner (1.5 HP)', category: 'COOLING', defaultWatts: 1300, surgeFactor: 3, typicalHoursPerDay: 6, typicalNightFraction: 0.6, note: 'Non-inverter compressor; high starting current.' },
  { id: 'ac-2hp', name: 'Air conditioner (2 HP)', category: 'COOLING', defaultWatts: 1800, surgeFactor: 3, typicalHoursPerDay: 6, typicalNightFraction: 0.6, note: 'Non-inverter compressor; high starting current.' },
  { id: 'ac-inverter-1-5hp', name: 'Inverter air conditioner (1.5 HP)', category: 'COOLING', defaultWatts: 1000, surgeFactor: 1.5, typicalHoursPerDay: 6, typicalNightFraction: 0.6, note: 'Soft-start; average draw is usually below rating.' },

  // Refrigeration
  { id: 'fridge', name: 'Refrigerator', category: 'REFRIGERATION', defaultWatts: 150, surgeFactor: 3, typicalHoursPerDay: 12, typicalNightFraction: 0.5, note: 'Hours = effective compressor run time, not hours plugged in.' },
  { id: 'chest-freezer', name: 'Chest freezer', category: 'REFRIGERATION', defaultWatts: 200, surgeFactor: 3, typicalHoursPerDay: 12, typicalNightFraction: 0.5, note: 'Hours = effective compressor run time.' },
  { id: 'inverter-fridge', name: 'Inverter refrigerator', category: 'REFRIGERATION', defaultWatts: 100, surgeFactor: 1.5, typicalHoursPerDay: 12, typicalNightFraction: 0.5 },

  // Entertainment
  { id: 'tv-32', name: 'LED TV (32")', category: 'ENTERTAINMENT', defaultWatts: 50, surgeFactor: 1, typicalHoursPerDay: 6, typicalNightFraction: 0.6 },
  { id: 'tv-55', name: 'LED TV (55")', category: 'ENTERTAINMENT', defaultWatts: 120, surgeFactor: 1, typicalHoursPerDay: 6, typicalNightFraction: 0.6 },
  { id: 'decoder', name: 'Satellite decoder', category: 'ENTERTAINMENT', defaultWatts: 20, surgeFactor: 1, typicalHoursPerDay: 6, typicalNightFraction: 0.6 },
  { id: 'sound-system', name: 'Home sound system', category: 'ENTERTAINMENT', defaultWatts: 100, surgeFactor: 1, typicalHoursPerDay: 3, typicalNightFraction: 0.6 },

  // Office / IT
  { id: 'router', name: 'Wi-Fi router / modem', category: 'OFFICE', defaultWatts: 15, surgeFactor: 1, typicalHoursPerDay: 24, typicalNightFraction: 0.5 },
  { id: 'laptop', name: 'Laptop', category: 'OFFICE', defaultWatts: 65, surgeFactor: 1, typicalHoursPerDay: 8, typicalNightFraction: 0.3 },
  { id: 'desktop', name: 'Desktop computer + monitor', category: 'OFFICE', defaultWatts: 250, surgeFactor: 1, typicalHoursPerDay: 8, typicalNightFraction: 0.2 },
  { id: 'phone-charger', name: 'Phone charger', category: 'OFFICE', defaultWatts: 10, surgeFactor: 1, typicalHoursPerDay: 3, typicalNightFraction: 0.6 },
  { id: 'laser-printer', name: 'Laser printer', category: 'OFFICE', defaultWatts: 400, surgeFactor: 1.5, typicalHoursPerDay: 0.5, typicalNightFraction: 0 },
  { id: 'pos-terminal', name: 'POS terminal', category: 'OFFICE', defaultWatts: 15, surgeFactor: 1, typicalHoursPerDay: 10, typicalNightFraction: 0.2 },

  // Kitchen
  { id: 'microwave', name: 'Microwave oven', category: 'KITCHEN', defaultWatts: 1200, surgeFactor: 1.5, typicalHoursPerDay: 0.3, typicalNightFraction: 0.5 },
  { id: 'blender', name: 'Blender', category: 'KITCHEN', defaultWatts: 400, surgeFactor: 2, typicalHoursPerDay: 0.2, typicalNightFraction: 0.3 },
  { id: 'kettle', name: 'Electric kettle', category: 'KITCHEN', defaultWatts: 1500, surgeFactor: 1, typicalHoursPerDay: 0.3, typicalNightFraction: 0.5 },
  { id: 'hot-plate', name: 'Electric hot plate / cooker', category: 'KITCHEN', defaultWatts: 1500, surgeFactor: 1, typicalHoursPerDay: 1, typicalNightFraction: 0.5, note: 'Heating loads are expensive to run on solar.' },

  // Laundry
  { id: 'washing-machine', name: 'Washing machine', category: 'LAUNDRY', defaultWatts: 500, surgeFactor: 2, typicalHoursPerDay: 1, typicalNightFraction: 0 },
  { id: 'pressing-iron', name: 'Pressing iron', category: 'LAUNDRY', defaultWatts: 1000, surgeFactor: 1, typicalHoursPerDay: 0.5, typicalNightFraction: 0, note: 'Heating load — best used during peak sun.' },

  // Water
  { id: 'pump-0-5hp', name: 'Water pump (0.5 HP)', category: 'WATER', defaultWatts: 450, surgeFactor: 3.5, typicalHoursPerDay: 1, typicalNightFraction: 0 },
  { id: 'pump-1hp', name: 'Water pump (1 HP)', category: 'WATER', defaultWatts: 800, surgeFactor: 3.5, typicalHoursPerDay: 1, typicalNightFraction: 0 },
  { id: 'water-dispenser', name: 'Water dispenser (hot/cold)', category: 'WATER', defaultWatts: 500, surgeFactor: 2, typicalHoursPerDay: 4, typicalNightFraction: 0.4 },

  // Security
  { id: 'cctv-4', name: 'CCTV system (4 cameras + DVR)', category: 'SECURITY', defaultWatts: 60, surgeFactor: 1, typicalHoursPerDay: 24, typicalNightFraction: 0.5 },
  { id: 'electric-fence', name: 'Electric fence energiser', category: 'SECURITY', defaultWatts: 15, surgeFactor: 1, typicalHoursPerDay: 24, typicalNightFraction: 0.5 },
];

export function findCatalogAppliance(id: string | undefined): CatalogAppliance | undefined {
  if (!id) return undefined;
  return APPLIANCE_CATALOG.find((a) => a.id === id);
}
