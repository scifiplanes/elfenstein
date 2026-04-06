import { shakeEnvelopeFactor } from '../../game/shakeEnvelope'

/** CSS transform for interaction shake; envelope from hold + decay tuning. */
export function shakeTransform(
  nowMs: number,
  startedAtMs: number,
  untilMs: number,
  magnitude: number,
  holdMs: number,
  decayMs: number,
): string {
  const amp = magnitude * shakeEnvelopeFactor(nowMs, startedAtMs, untilMs, holdMs, decayMs)
  const x = Math.sin(nowMs * 0.07) * 6 * amp
  const y = Math.cos(nowMs * 0.06) * 4 * amp
  const r = Math.sin(nowMs * 0.05) * 0.8 * amp
  return `translate3d(${x}px, ${y}px, 0) rotate(${r}deg)`
}
