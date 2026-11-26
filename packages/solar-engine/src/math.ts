/** Round to a fixed number of decimals without floating-point artefacts like 0.30000000000000004. */
export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Round up to the nearest step (e.g. naira prices to the nearest 1,000). */
export function ceilTo(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
