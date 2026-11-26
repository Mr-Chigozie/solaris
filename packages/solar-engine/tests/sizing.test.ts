import { describe, expect, it } from 'vitest';
import { calculateSystem, findState, selectBankVoltage, SizingInputError, type SizingInput } from '../src';

const household: SizingInput = {
  location: { state: 'FCT', city: 'Abuja' },
  gridAvailable: true,
  backupHours: 8,
  autonomyDays: 1,
  appliances: [
    { name: 'Refrigerator', quantity: 1, watts: 150, hoursPerDay: 12 },
    { name: 'Television', quantity: 2, watts: 100, hoursPerDay: 6 },
    { name: 'Fan', quantity: 3, watts: 60, hoursPerDay: 10 },
  ],
};

describe('location resolution', () => {
  it('resolves names, codes and aliases', () => {
    expect(findState('FCT')?.capital).toBe('Abuja');
    expect(findState('Abuja')?.stateCode).toBe('FC');
    expect(findState('Lagos State')?.stateCode).toBe('LA');
    expect(findState('cross river')?.capital).toBe('Calabar');
    expect(findState('KN')?.state).toBe('Kano');
    expect(findState('Atlantis')).toBeUndefined();
  });
});

describe('reference household scenario (hand-calculated)', () => {
  const r = calculateSystem(household);

  it('A. energy: E = Σ W×Q×H / 1000', () => {
    // 150×1×12 + 100×2×6 + 60×3×10 = 1800 + 1200 + 1800 = 4800 Wh
    expect(r.energy.dailyKwh).toBe(4.8);
    expect(r.energy.nighttimeKwh).toBe(2.4); // default night fraction 0.5
    // backup: 150×min(12,8) + 200×min(6,8) + 180×min(10,8) = 1200+1200+1440
    expect(r.energy.backupKwh).toBe(3.84);
    expect(r.energy.peakLoadW).toBe(530);
    expect(r.energy.averageLoadW).toBe(200);
  });

  it('D. inverter: smallest standard size covering continuous + surge', () => {
    // 530 × 1.25 / 0.8 = 828 VA → 1 kVA
    expect(r.inverter.requiredKva).toBeCloseTo(0.83, 2);
    expect(r.inverter.recommendedKva).toBe(1);
  });

  it('B. battery: usable / (DoD × η_inv × √η_rt)', () => {
    // 3.84 / (0.9 × 0.93 × √0.95) = 4.707 kWh nominal
    expect(r.battery.requiredUsableKwh).toBe(3.84);
    expect(r.battery.requiredNominalKwh).toBeCloseTo(4.71, 2);
    expect(r.battery.bankVoltage).toBe(24);
    expect(r.battery.configuration?.totalUnits).toBe(2);
    expect(r.battery.configuration?.installedNominalKwh).toBeCloseTo(5.12, 2);
  });

  it('C. solar: generation / (PSH × derating), location-specific PSH', () => {
    // 2.4/0.93 + 2.4/(0.93×0.95) = 5.297 kWh → /(5.5 × 0.8) = 1.204 kWp → 3 × 550 W
    expect(r.solar.peakSunHoursUsed).toBe(5.5);
    expect(r.solar.requiredGenerationKwh).toBeCloseTo(5.297, 3);
    expect(r.solar.requiredArrayKw).toBeCloseTo(1.204, 3);
    expect(r.solar.panelCount).toBe(3);
    expect(r.solar.installedArrayKw).toBe(1.65);
  });

  it('records versions, resolved assumptions and review status', () => {
    expect(r.engineVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(r.dataVersion).toBeTruthy();
    expect(r.status).toBe('ESTIMATED_REVIEW_REQUIRED');
    expect(r.assumptions.batteryDepthOfDischarge).toBe(0.9);
    expect(r.warnings.map((w) => w.code)).toContain('ENGINEERING_REVIEW_REQUIRED');
  });

  it('produces a consistent cost breakdown', () => {
    const sum = r.cost.lineItems.reduce((s, i) => s + i.amount, 0);
    expect(r.cost.total).toBeCloseTo(sum, 0);
    expect(r.cost.range.low).toBeLessThan(r.cost.total);
    expect(r.cost.range.high).toBeGreaterThan(r.cost.total);
    expect(r.cost.currency).toBe('NGN');
  });

  it('is deterministic', () => {
    expect(calculateSystem(household)).toEqual(r);
  });
});

describe('engineering behaviour', () => {
  it('sizes the inverter for compressor starting surge', () => {
    const r = calculateSystem({
      ...household,
      appliances: [{ catalogId: 'ac-1-5hp', name: 'Air conditioner (1.5 HP)', quantity: 1, watts: 1300, hoursPerDay: 6 }],
    });
    // continuous: 1300×1.25/0.8 = 2.03 kVA; surge: (1300 + 1300×2)/0.8 = 4875 VA → 2.5 kVA × 2 = 5000 VA
    expect(r.inverter.requiredSurgeVa).toBe(4875);
    expect(r.inverter.recommendedKva).toBe(2.5);
    const codes = r.warnings.map((w) => w.code);
    expect(codes).toContain('HIGH_SURGE_LOAD');
    expect(codes).toContain('AIR_CONDITIONING_LOAD');
  });

  it('off-grid sizes storage for at least the night-time energy', () => {
    const r = calculateSystem({ ...household, gridAvailable: false, backupHours: 2 });
    expect(r.battery.requiredUsableKwh).toBe(r.energy.nighttimeKwh);
  });

  it('autonomy days scale storage linearly', () => {
    const one = calculateSystem(household);
    const two = calculateSystem({ ...household, autonomyDays: 2 });
    expect(two.battery.requiredNominalKwh).toBeCloseTo(one.battery.requiredNominalKwh * 2, 1);
  });

  it('lead-acid needs more nominal capacity than LiFePO4', () => {
    const li = calculateSystem(household);
    const pb = calculateSystem({ ...household, batteryChemistry: 'LEAD_ACID_TUBULAR' });
    expect(pb.battery.requiredNominalKwh).toBeGreaterThan(li.battery.requiredNominalKwh * 1.7);
    expect(pb.warnings.map((w) => w.code)).toContain('LEAD_ACID_SHALLOW_DISCHARGE');
  });

  it('the south needs a larger array than the north for the same load', () => {
    const lagos = calculateSystem({ ...household, location: { state: 'Lagos' } });
    const kano = calculateSystem({ ...household, location: { state: 'Kano' } });
    expect(lagos.solar.requiredArrayKw).toBeGreaterThan(kano.solar.requiredArrayKw);
  });

  it('worst-month design basis increases array size', () => {
    const avg = calculateSystem(household);
    const worst = calculateSystem({ ...household, assumptions: { solarDesignBasis: 'WORST_MONTH' } });
    expect(worst.solar.peakSunHoursUsed).toBeLessThan(avg.solar.peakSunHoursUsed);
    expect(worst.solar.requiredArrayKw).toBeGreaterThan(avg.solar.requiredArrayKw);
    expect(worst.solar.worstMonthCoverage).toBe(1);
  });

  it('respects assumption overrides and flags them', () => {
    const r = calculateSystem({ ...household, assumptions: { peakSunHours: 4, panelWatts: 450 } });
    expect(r.solar.peakSunHoursUsed).toBe(4);
    expect(r.solar.panelWatts).toBe(450);
    expect(r.warnings.find((w) => w.code === 'ASSUMPTION_OVERRIDDEN')?.message).toContain('peakSunHours');
  });

  it('zero backup hours on grid means no battery', () => {
    const r = calculateSystem({ ...household, backupHours: 0 });
    expect(r.battery.required).toBe(false);
    expect(r.battery.configuration).toBeNull();
    expect(r.cost.lineItems.some((i) => i.code === 'BATTERY_BANK')).toBe(false);
  });

  it('falls back with a warning for an unknown location', () => {
    const r = calculateSystem({ ...household, location: { state: 'Atlantis' } });
    expect(r.location.resolved).toBe(false);
    expect(r.warnings.map((w) => w.code)).toContain('UNKNOWN_LOCATION');
  });

  it('non-simultaneous loads do not add to peak', () => {
    const r = calculateSystem({
      ...household,
      appliances: [
        { name: 'Fan', quantity: 1, watts: 100, hoursPerDay: 5 },
        { name: 'Pressing iron', quantity: 1, watts: 1000, hoursPerDay: 0.5, simultaneousUse: false },
      ],
    });
    expect(r.energy.peakLoadW).toBe(1000);
  });

  it('flags loads beyond a single standard inverter', () => {
    const r = calculateSystem({
      ...household,
      appliances: [{ name: 'Industrial load', quantity: 30, watts: 1500, hoursPerDay: 4 }],
    });
    expect(r.inverter.exceedsStandardRange).toBe(true);
    expect(r.warnings.find((w) => w.code === 'INVERTER_EXCEEDS_STANDARD_RANGE')?.severity).toBe('CRITICAL');
  });

  it('keeps the battery bank voltage consistent with the inverter class', () => {
    expect(selectBankVoltage(1, 2)).toBe(12);
    expect(selectBankVoltage(1.5, 7.5)).toBe(24); // small inverters are 24 V in the Nigerian market
    expect(selectBankVoltage(2.5, 14)).toBe(48); // very large storage forces 48 V
    expect(selectBankVoltage(5, 5)).toBe(48);
  });

  it('rejects empty input', () => {
    expect(() => calculateSystem({ ...household, appliances: [] })).toThrow(SizingInputError);
    expect(() =>
      calculateSystem({ ...household, appliances: [{ name: 'x', quantity: 0, watts: 10, hoursPerDay: 1 }] }),
    ).toThrow(SizingInputError);
  });
});

describe('reference prices', () => {
  it('apply as a baseline without flagging a user override', () => {
    const base = calculateSystem(household);
    const priced = calculateSystem({ ...household, referencePrices: { panelPricePerWatt: 560, pricesReviewed: '2027-01' } });
    const panels = (r: typeof base) => r.cost.lineItems.find((i) => i.code === 'SOLAR_PANELS')!.amount;
    expect(panels(priced)).toBe(panels(base) * 2);
    expect(priced.cost.pricesReviewed).toBe('2027-01');
    expect(priced.warnings.map((w) => w.code)).not.toContain('ASSUMPTION_OVERRIDDEN');
  });
});
