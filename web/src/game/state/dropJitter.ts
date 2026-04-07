import type { ItemId } from '../types'

export type DropJitter = { x: number; z: number }

/**
 * Generates a small in-cell offset so multiple floor items in the same tile can be
 * rendered/picked separately. The caller controls whether jitter is stable or rerolled by
 * choosing an appropriate `nonce`.
 */
export function makeDropJitter(args: { floorSeed: number; itemId: ItemId; nonce: number; radius: number }): DropJitter {
  const { floorSeed, itemId, nonce, radius } = args
  const r = Math.max(0, Math.min(0.45, radius))
  if (r === 0) return { x: 0, z: 0 }

  const seed = hashStr(`${floorSeed}:dropJitter:${itemId}:${nonce}`)
  // Two independent-ish uniform values in [0, 1).
  const u = ((seed >>> 0) % 10_000) / 10_000
  const v = (((seed >>> 12) ^ (seed * 31)) >>> 0) % 10_000 / 10_000

  // Sample a disk so offsets don't bias to corners.
  const theta = u * Math.PI * 2
  const mag = Math.sqrt(v) * r
  const x = Math.cos(theta) * mag
  const z = Math.sin(theta) * mag
  return { x, z }
}

function hashStr(s: string) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

