import { describe, expect, it } from 'vitest'
import type { Tile } from '../game/types'
import type { FloorGenOutput } from './types'
import { scoreLayout } from './scoreLayout'

function emptyMeta(w: number, h: number): FloorGenOutput['meta'] {
  return {
    genVersion: 5,
    inputSeed: 0,
    attemptSeed: 0,
    attempt: 0,
    w,
    h,
    streams: { layout: 0, tags: 0, population: 0, locks: 0, districts: 0, score: 0, theme: 0 },
  }
}

/** 5×5 with a horizontal 3-cell corridor at y=2, x=1..3; walls elsewhere. */
function corridorGen(centerTile: 'floor' | 'lockedDoor', doors: FloorGenOutput['doors']): FloorGenOutput {
  const w = 5
  const h = 5
  const tiles: Tile[] = Array.from({ length: w * h }, () => 'wall')
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (y === 2 && x >= 1 && x <= 3) {
        tiles[x + y * w] = x === 2 ? centerTile : 'floor'
      }
    }
  }
  return {
    tiles,
    pois: [],
    rooms: [],
    doors,
    floorItems: [],
    npcs: [],
    entrance: { x: 1, y: 2 },
    exit: { x: 3, y: 2 },
    meta: emptyMeta(w, h),
  }
}

describe('scoreLayout', () => {
  it('counts lockedDoor as passage mass like floor (no spurious penalty vs all-floor)', () => {
    const noLock = corridorGen('floor', [])
    const withLock = corridorGen('lockedDoor', [{ pos: { x: 2, y: 2 }, locked: true, lockId: 'A' }])
    const s0 = scoreLayout(noLock, 5, 5, 1)
    const s1 = scoreLayout(withLock, 5, 5, 1)
    // Same walkable passage count (3 cells); lock layout gets lockPresenceBonus (+18 at normal difficulty).
    expect(s1).toBeGreaterThan(s0)
    expect(s1 - s0).toBe(18)
  })

  it('matches floor score when no gen.doors (locked tile but not counted as hasLocks)', () => {
    const noLock = corridorGen('floor', [])
    const orphanLockTile = corridorGen('lockedDoor', [])
    expect(scoreLayout(noLock, 5, 5, 1)).toBe(scoreLayout(orphanLockTile, 5, 5, 1))
  })
})
