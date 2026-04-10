import { describe, expect, it } from 'vitest'
import type { Tile } from '../game/types'
import type { GenRoom } from './types'
import { spawnNpcsAndItems } from './population'

function flatFloor(w: number, h: number): Tile[] {
  return Array.from({ length: w * h }, () => 'floor')
}

describe('spawnNpcsAndItems NPC count', () => {
  it('places min(targetCount, available floor cells in candidate rooms) for explicit min/max', () => {
    const w = 10
    const h = 10
    const tiles = flatFloor(w, h)
    const entrance = { x: 1, y: 1 }
    const exit = { x: 8, y: 8 }
    const room: GenRoom = {
      id: 'r_big',
      rect: { x: 0, y: 0, w, h },
      center: { x: 5, y: 5 },
      leafDepth: 0,
    }
    const rng = {
      next: () => 0.5,
      int: (min: number, maxExclusive: number) => Math.floor(0.5 * (maxExclusive - min)) + min,
      pick: <T,>(arr: readonly T[]) => arr[0]!,
    }
    const occupied = new Set<string>()
    const { npcs } = spawnNpcsAndItems({
      tiles,
      w,
      h,
      rooms: [room],
      entrance,
      exit,
      occupied,
      rng: rng as import('./seededRng').Rng,
      floorType: 'Dungeon',
      npcSpawnCountMin: 6,
      npcSpawnCountMax: 12,
    })
    expect(rng.int(6, 13)).toBe(9)
    expect(npcs.length).toBe(9)
    expect(npcs.length).toBeGreaterThanOrEqual(6)
    expect(npcs.length).toBeLessThanOrEqual(12)
  })

  it('caps NPC count when the room has fewer free cells than target', () => {
    const w = 12
    const h = 12
    const tiles = flatFloor(w, h)
    const entrance = { x: 0, y: 0 }
    const exit = { x: 11, y: 11 }
    const room: GenRoom = {
      id: 'r_small',
      rect: { x: 5, y: 5, w: 2, h: 2 },
      center: { x: 5, y: 5 },
      leafDepth: 0,
    }
    const rng = {
      next: () => 0.99,
      int: () => 12,
      pick: <T,>(arr: readonly T[]) => arr[0]!,
    }
    const occupied = new Set<string>()
    const { npcs } = spawnNpcsAndItems({
      tiles,
      w,
      h,
      rooms: [room],
      entrance,
      exit,
      occupied,
      rng: rng as import('./seededRng').Rng,
      floorType: 'Dungeon',
      npcSpawnCountMin: 12,
      npcSpawnCountMax: 12,
    })
    expect(npcs.length).toBe(4)
  })

  it('still spawns in a room when only the room center is reserved (e.g. POI), not the whole rect', () => {
    const w = 12
    const h = 12
    const tiles = flatFloor(w, h)
    const entrance = { x: 0, y: 0 }
    const exit = { x: 11, y: 11 }
    const room: GenRoom = {
      id: 'r_poi_on_center',
      rect: { x: 2, y: 2, w: 5, h: 5 },
      center: { x: 4, y: 4 },
      leafDepth: 0,
    }
    const occupied = new Set<string>(['4,4'])
    const rng = {
      next: () => 0.99,
      int: () => 20,
      pick: <T,>(arr: readonly T[]) => arr[0]!,
    }
    const { npcs } = spawnNpcsAndItems({
      tiles,
      w,
      h,
      rooms: [room],
      entrance,
      exit,
      occupied,
      rng: rng as import('./seededRng').Rng,
      floorType: 'Dungeon',
      npcSpawnCountMin: 20,
      npcSpawnCountMax: 20,
    })
    // 5×5 − 1 reserved center = 24 slots; target 20 → 20 NPCs (old center-only filter gave 0).
    expect(npcs.length).toBe(20)
  })
})
