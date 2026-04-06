export type Rng = {
  next(): number // [0,1)
  int(min: number, maxExclusive: number): number
  pick<T>(arr: readonly T[]): T
}

export function mulberry32(seed: number): Rng {
  let t = seed >>> 0
  const next = () => {
    t += 0x6d2b79f5
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int(min, maxExclusive) {
      return Math.floor(next() * (maxExclusive - min)) + min
    },
    pick(arr) {
      return arr[this.int(0, arr.length)]
    },
  }
}

export function splitSeed(seed: number, salt: number) {
  // Cheap deterministic stream split.
  return (seed ^ (salt * 0x9e3779b9)) >>> 0
}

