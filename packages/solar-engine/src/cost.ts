import { ceilTo, round } from './math';
import type {
  BatteryRecommendation,
  CostEstimate,
  CostLineItem,
  EngineeringAssumptions,
  InverterRecommendation,
  SolarArrayRecommendation,
} from './types';

/**
 * Stage G — indicative cost estimate from reference unit prices.
 * Replaced by real vendor quotations once a design is matched to marketplace products.
 */
export function estimateCost(
  solar: SolarArrayRecommendation,
  battery: BatteryRecommendation,
  inverter: InverterRecommendation,
  a: EngineeringAssumptions,
): CostEstimate {
  const c = a.cost;
  const items: CostLineItem[] = [];

  if (solar.panelCount > 0) {
    const unitPrice = a.panelWatts * c.panelPricePerWatt;
    items.push({
      code: 'SOLAR_PANELS',
      label: `${a.panelWatts} W solar panels`,
      quantity: solar.panelCount,
      unit: 'panel',
      unitPrice,
      amount: unitPrice * solar.panelCount,
    });
  }

  if (battery.configuration) {
    const cfg = battery.configuration;
    const unitKwh = (cfg.unitNominalVoltage * cfg.unitAh) / 1000;
    const unitPrice = unitKwh * c.batteryPricePerKwh[battery.chemistry];
    items.push({
      code: 'BATTERY_BANK',
      label: cfg.unitDescription,
      quantity: cfg.totalUnits,
      unit: 'unit',
      unitPrice: round(unitPrice, 0),
      amount: round(unitPrice * cfg.totalUnits, 0),
    });
  }

  const inverterPrice = inverter.recommendedKva * c.inverterPricePerKva;
  items.push({
    code: 'INVERTER',
    label: `${inverter.recommendedKva} kVA hybrid inverter (built-in MPPT)`,
    quantity: 1,
    unit: 'unit',
    unitPrice: inverterPrice,
    amount: inverterPrice,
  });

  const equipmentSubtotal = items.reduce((sum, i) => sum + i.amount, 0);
  const bos = equipmentSubtotal * c.balanceOfSystemFraction;
  const installation = (equipmentSubtotal + bos) * c.installationFraction;
  const preContingency = equipmentSubtotal + bos + installation + c.logisticsFlat;
  const contingency = preContingency * c.contingencyFraction;

  items.push(
    { code: 'BALANCE_OF_SYSTEM', label: 'Cables, breakers, surge protection & mounting', quantity: 1, unit: 'lot', unitPrice: round(bos, 0), amount: round(bos, 0) },
    { code: 'INSTALLATION', label: 'Installation labour', quantity: 1, unit: 'job', unitPrice: round(installation, 0), amount: round(installation, 0) },
    { code: 'LOGISTICS', label: 'Logistics & transport', quantity: 1, unit: 'lot', unitPrice: c.logisticsFlat, amount: c.logisticsFlat },
    { code: 'CONTINGENCY', label: 'Contingency', quantity: 1, unit: 'lot', unitPrice: round(contingency, 0), amount: round(contingency, 0) },
  );

  const total = items.reduce((sum, i) => sum + i.amount, 0);

  return {
    currency: 'NGN',
    pricesReviewed: c.pricesReviewed,
    lineItems: items,
    equipmentSubtotal: round(equipmentSubtotal, 0),
    total: round(total, 0),
    range: {
      low: ceilTo(total * (1 - c.estimateUncertaintyFraction), 1000),
      high: ceilTo(total * (1 + c.estimateUncertaintyFraction), 1000),
    },
  };
}
