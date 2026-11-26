import { round } from './math';
import type { EngineeringAssumptions, EnergyAnalysis, InverterRecommendation } from './types';

/** Common inverter ratings on the Nigerian market, in kVA. */
export const STANDARD_INVERTER_KVA = [1, 1.5, 2.5, 3.5, 5, 6, 8, 10, 12, 15, 20, 25, 30] as const;

/**
 * Stage D — inverter sizing.
 *
 *   continuous W  = peak simultaneous load × design margin
 *   required kVA  = continuous W / power factor / 1000
 *   surge VA      = (peak load + largest single starting surge) / power factor
 *
 * The recommended rating is the smallest standard size that satisfies BOTH the
 * continuous requirement and the surge requirement (rating × surge multiplier).
 */
export function sizeInverter(energy: EnergyAnalysis, a: EngineeringAssumptions): InverterRecommendation {
  const requiredContinuousW = energy.peakLoadW * a.inverterDesignMargin;
  const requiredKva = requiredContinuousW / a.powerFactor / 1000;
  const requiredSurgeVa = energy.peakSurgeW / a.powerFactor;

  const meets = (kva: number) =>
    kva >= requiredKva && kva * 1000 * a.inverterSurgeMultiplier >= requiredSurgeVa;

  const standard = STANDARD_INVERTER_KVA.find(meets);
  const exceedsStandardRange = standard === undefined;
  const recommendedKva =
    standard ?? Math.ceil(Math.max(requiredKva, requiredSurgeVa / 1000 / a.inverterSurgeMultiplier));

  return {
    requiredContinuousW: round(requiredContinuousW, 1),
    requiredKva: round(requiredKva, 2),
    requiredSurgeVa: round(requiredSurgeVa, 0),
    recommendedKva,
    recommendedKw: round(recommendedKva * a.powerFactor, 2),
    surgeCapacityVa: round(recommendedKva * 1000 * a.inverterSurgeMultiplier, 0),
    exceedsStandardRange,
  };
}
