import { describe, expect, it } from 'vitest'
import type { Tile } from '../game/types'
import { placeLocksOnPath } from './locks'

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
})
