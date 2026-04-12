/**
 * Integer stamina pacing: charge a base cost only every N-th successful grid move on the current floor.
 */

/** Endurance at which `effectiveStaminaMoveEveryN` equals the base N (before clamp). */
const ENDURANCE_PIVOT = 5
/** Per point of endurance above/below pivot, scale N by this fraction of base (e.g. +1 endurance → +10% N). */
const ENDURANCE_N_SCALE = 0.1
const EVERY_N_MIN = 1
const EVERY_N_MAX = 30

/**
 * Effective move/strafe interval N from F2 base `baseN` and character endurance (higher endurance → larger N → less frequent STA charges).
 */
export function effectiveStaminaMoveEveryN(baseN: number, endurance: number): number {
  const B = Math.max(EVERY_N_MIN, Math.min(EVERY_N_MAX, Math.round(Number(baseN)) || EVERY_N_MIN))
  const e = Number(endurance)
  const raw = B * (1 + (e - ENDURANCE_PIVOT) * ENDURANCE_N_SCALE)
  return Math.max(EVERY_N_MIN, Math.min(EVERY_N_MAX, Math.round(raw)))
}

export function nextStaminaMovePace(
  counter: number | undefined,
  intervalN: number,
  baseCost: number,
): { cost: number; nextCounter: number } {
  const n = Math.max(1, Math.round(Number(intervalN)) || 1)
  const c = counter ?? 0
  const next = (c + 1) % n
  const base = Math.max(0, Math.round(Number(baseCost)))
  const cost = next === 0 && base > 0 ? base : 0
  return { cost, nextCounter: next }
}
