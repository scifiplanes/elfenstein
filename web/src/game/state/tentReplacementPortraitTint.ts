/**
 * Tent replacement portraits: CSS `saturate()` variance (game layer; UI imports these).
 * Legacy saves have hue only → `resolveTentReplacementPortraitAliveSaturateMult` falls back.
 */

/** Pre-per-recruit-saturation default (fixed `saturate(1.65)` for every recruit). */
export const TENT_REPLACEMENT_PORTRAIT_SATURATE_ALIVE_LEGACY = 1.65

/** Alive `saturate()` multiplier range (below 1 = more desaturated than source art). */
export const TENT_REPLACEMENT_PORTRAIT_SATURATE_ALIVE_MIN = 0.32
export const TENT_REPLACEMENT_PORTRAIT_SATURATE_ALIVE_MAX = 1.92

const DEAD_TO_ALIVE_SATURATE_RATIO = 1.4 / 1.65

export function tentReplacementPortraitDeadSaturateMult(aliveMult: number): number {
  return Math.max(0.18, aliveMult * DEAD_TO_ALIVE_SATURATE_RATIO)
}

export function resolveTentReplacementPortraitAliveSaturateMult(stored: number | undefined): number {
  return stored ?? TENT_REPLACEMENT_PORTRAIT_SATURATE_ALIVE_LEGACY
}

/** Deterministic alive multiplier from a `hashStr` uint. */
export function tentReplacementPortraitSaturateMultFromHash(hash: number): number {
  const u = (hash >>> 0) % 100001
  const t = u / 100000
  const s =
    TENT_REPLACEMENT_PORTRAIT_SATURATE_ALIVE_MIN +
    t * (TENT_REPLACEMENT_PORTRAIT_SATURATE_ALIVE_MAX - TENT_REPLACEMENT_PORTRAIT_SATURATE_ALIVE_MIN)
  return Math.round(s * 1000) / 1000
}
