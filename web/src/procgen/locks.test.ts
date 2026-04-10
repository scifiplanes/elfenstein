import { describe, expect, it, vi } from 'vitest'
import type { Tile } from '../game/types'
import { generateDungeon } from './generateDungeon'
import { placeLocksOnPath, validateGen } from './locks'

/** Single-row corridor: only one route from entrance to exit (a bridge). */
function corridorMap(w: number, corridorY: number): Tile[] {
  const h = 3
  const tiles: Tile[] = Array.from({ length: w * h }, () => 'wall')
  for (let x = 1; x < w - 1; x++) {
    tiles[x + corridorY * w] = 'floor'
  }
  return tiles
}

describe('placeLocksOnPath', () => {
  it('places a lock on a unique shortest-path bridge when path is long enough', () => {
    const w = 9
    const h = 3
    const y = 1
    const tiles = corridorMap(w, y)
    const entrance = { x: 1, y }
    const exit = { x: 7, y }
    const rng = { next: () => 0.99 }

    const { doors, floorItems } = placeLocksOnPath({
      tiles,
      w,
      h,
      entrance,
      exit,
      rng,
      occupied: new Set<string>(),
      difficulty: 1,
    })

    expect(doors.length).toBeGreaterThanOrEqual(1)
    expect(floorItems.some((it) => it.defId === 'IronKey' && it.forLockId === 'A')).toBe(true)
    const lockedIdx = doors[0]!.pos.x + doors[0]!.pos.y * w
    expect(tiles[lockedIdx] === 'lockedDoor' || tiles[lockedIdx] === 'lockedDoorOctopus').toBe(true)
  })

  it('returns no doors when the path is shorter than minPathAnyLock', () => {
    const w = 5
    const h = 3
    const y = 1
    const tiles = corridorMap(w, y)
    const entrance = { x: 1, y }
    const exit = { x: 3, y }
    const rng = { next: () => 0.99 }

    const { doors } = placeLocksOnPath({
      tiles,
      w,
      h,
      entrance,
      exit,
      rng,
      occupied: new Set<string>(),
      difficulty: 1,
    })

    expect(doors).toEqual([])
  })

  it('articulation fallback places lock when shortest-path lock slots are occupied but the neck after entrance separates', () => {
    const w = 11
    const h = 3
    const y = 1
    const tiles = corridorMap(w, y)
    const entrance = { x: 1, y }
    const exit = { x: 9, y }
    // Block every primary single-lock index in 2..length-3 (here path indices 2–6 map to x=3..7).
    const occupied = new Set<string>(['3,1', '4,1', '5,1', '6,1', '7,1'])
    const rng = { next: () => 0.99 }

    const { doors, floorItems } = placeLocksOnPath({
      tiles,
      w,
      h,
      entrance,
      exit,
      rng,
      occupied,
      difficulty: 1,
    })

    expect(doors.length).toBe(1)
    expect(doors[0]!.pos).toEqual({ x: 2, y: 1 })
    expect(floorItems.some((it) => it.forLockId === 'A')).toBe(true)
    const key = floorItems.find((it) => it.forLockId === 'A')
    expect(key?.pos).toEqual(entrance)
    const li = 2 + y * w
    expect(tiles[li] === 'lockedDoor' || tiles[li] === 'lockedDoorOctopus').toBe(true)
  })
})

describe('validateGen', () => {
  it('accepts procgen floors that place locked doors (geometric lattice check must not use closed-lock reachability)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const w = 31
      const h = 31
      const out = generateDungeon({
        seed: 12,
        w,
        h,
        floorIndex: 0,
        floorType: 'Dungeon',
        floorProperties: [],
        difficulty: 1,
      })
      expect(out.doors.some((d) => d.locked && d.lockId)).toBe(true)
      expect(validateGen(out, w, h)).toBe(true)
    } finally {
      warn.mockRestore()
    }
  })
})
