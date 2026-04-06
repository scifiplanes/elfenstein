/**
 * Shake strength 0..1 from debug tuning.
 * - holdMs > 0: full strength for hold, then linear fade over decayMs (both scaled down if hold+decay exceeds event duration T).
 * - holdMs === 0 && decayMs > 0: legacy ramp min(1, remaining/decayMs) (matches pre–two-slider behavior).
 */
export function shakeEnvelopeFactor(
  nowMs: number,
  startedAtMs: number,
  untilMs: number,
  holdMs: number,
  decayMs: number,
): number {
  const remaining = untilMs - nowMs
  if (remaining <= 0) return 0
  const start = Number.isFinite(startedAtMs) ? startedAtMs : untilMs - 160
  const T = untilMs - start
  if (T <= 0) return 0
  const elapsed = nowMs - start
  const hold = Math.max(0, holdMs)
  const decay = Math.max(0, decayMs)

  if (hold === 0 && decay > 0) {
    return Math.max(0, Math.min(1, remaining / Math.max(1, decay)))
  }
  if (hold === 0 && decay === 0) {
    return 1
  }

  let h = hold
  let d = decay
  const sum = h + d
  if (sum > T) {
    const s = T / sum
    h *= s
    d *= s
  }
  if (elapsed < h) return 1
  if (d <= 0) return 0
  return Math.max(0, (h + d - elapsed) / d)
}
