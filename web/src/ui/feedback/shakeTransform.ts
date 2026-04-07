import { shakeEnvelopeFactor } from '../../game/shakeEnvelope'

/** CSS transform for interaction shake; envelope from hold + decay tuning. */
export function shakeTransform(
  nowMs: number,
  startedAtMs: number,
  untilMs: number,
  magnitude: number,
  holdMs: number,
  decayMs: number,
  hz?: number,
): string {
  const amp = magnitude * shakeEnvelopeFactor(nowMs, startedAtMs, untilMs, holdMs, decayMs)
  if (!hz || hz <= 0) {
    const x = Math.sin(nowMs * 0.07) * 6 * amp
    const y = Math.cos(nowMs * 0.06) * 4 * amp
    const r = Math.sin(nowMs * 0.05) * 0.8 * amp
    return `translate3d(${x}px, ${y}px, 0) rotate(${r}deg)`
  }

  // Match legacy ratios between axes while allowing a single “base” Hz slider.
  // Legacy: sin(nowMs*0.07) => ~11.14Hz (0.07 rad/ms).
  // Use time since event start to keep phase numerically stable.
  const t = (nowMs - startedAtMs) / 1000
  const w = t * Math.PI * 2 * hz
  const yRatio = 0.06 / 0.07
  const rRatio = 0.05 / 0.07
  const x = Math.sin(w) * 6 * amp
  const y = Math.cos(w * yRatio) * 4 * amp
  const r = Math.sin(w * rRatio) * 0.8 * amp
  return `translate3d(${x}px, ${y}px, 0) rotate(${r}deg)`
}
