/** Uniform 32-bit floor seed; fallback if `crypto.getRandomValues` is missing. */
export function randomFloorSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    return buf[0] >>> 0
  }
  return (((Math.random() * 2 ** 32) >>> 0) ^ (Math.floor(performance.now()) >>> 0)) >>> 0
}

