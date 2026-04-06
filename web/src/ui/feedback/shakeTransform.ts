/** CSS transform for a short interaction shake (envelope tapers by remaining time). */
export function shakeTransform(nowMs: number, untilMs: number, magnitude: number): string {
  const t = Math.max(0, Math.min(1, (untilMs - nowMs) / 220))
  const amp = magnitude * t
  const x = Math.sin(nowMs * 0.07) * 6 * amp
  const y = Math.cos(nowMs * 0.06) * 4 * amp
  const r = Math.sin(nowMs * 0.05) * 0.8 * amp
  return `translate3d(${x}px, ${y}px, 0) rotate(${r}deg)`
}
