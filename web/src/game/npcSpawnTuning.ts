/** Shipped defaults: ~2× legacy typical count (~3); uniform mean (min+max)/2 = 6. */
export const DEFAULT_NPC_SPAWN_COUNT_MIN = 4
export const DEFAULT_NPC_SPAWN_COUNT_MAX = 8

/** Hard cap per floor (procgen + debug); avoids absurd rolls. */
export const NPC_SPAWN_COUNT_ABS_MAX = 48

/**
 * Clamp inclusive min/max for procgen NPC count; swap if reversed.
 * `undefined` / non-finite inputs fall back to defaults.
 */
export function clampNpcSpawnCountRange(minIn: unknown, maxIn: unknown): { min: number; max: number } {
  let lo =
    minIn === undefined || minIn === null || !Number.isFinite(Number(minIn))
      ? DEFAULT_NPC_SPAWN_COUNT_MIN
      : Math.round(Number(minIn))
  let hi =
    maxIn === undefined || maxIn === null || !Number.isFinite(Number(maxIn))
      ? DEFAULT_NPC_SPAWN_COUNT_MAX
      : Math.round(Number(maxIn))
  lo = Math.min(NPC_SPAWN_COUNT_ABS_MAX, Math.max(1, lo))
  hi = Math.min(NPC_SPAWN_COUNT_ABS_MAX, Math.max(1, hi))
  if (lo > hi) {
    const t = lo
    lo = hi
    hi = t
  }
  return { min: lo, max: hi }
}
