import { describe, expect, it } from 'vitest'
import type { Tile } from '../game/types'
import type { GenRoom } from './types'
import { mulberry32 } from './seededRng'
import { FORAGE_PATCH_ITEM_DEF_IDS, spawnNpcsAndItems } from './population'
import { pickFloorItemDefFromTable, pickNpcKindFromTable } from './spawnTables'

function flatFloor(w: number, h: number): Tile[] {
  return Array.from({ length: w * h }, () => 'floor')
}

describe('forage floor patches', () => {
  it('exposes the four patch item defs including Grubling for grub floor loot', () => {
    expect(FORAGE_PATCH_ITEM_DEF_IDS.has('Mushrooms')).toBe(true)
    expect(FORAGE_PATCH_ITEM_DEF_IDS.has('Fungus')).toBe(true)
    expect(FORAGE_PATCH_ITEM_DEF_IDS.has('Foodroot')).toBe(true)
    expect(FORAGE_PATCH_ITEM_DEF_IDS.has('Grubling')).toBe(true)
  })

  it('pickFloorItemDefFromTable: SporeMist can return Fungus', () => {
    const room: GenRoom = {
      id: 'r1',
      rect: { x: 0, y: 0, w: 3, h: 3 },
      center: { x: 1, y: 1 },
      leafDepth: 0,
      tags: { roomFunction: 'Habitat', roomProperties: 'SporeMist' },
    }
    let i = 0
    const draws = [0.92]
    const rng = {
      next: () => draws[i++] ?? 0.99,
      int: (min: number, maxExclusive: number) => min,
      pick: <T,>(arr: readonly T[]) => arr[0]!,
    }
    const defId = pickFloorItemDefFromTable(
      { floorType: 'Dungeon', floorProperties: [], room, isOnEntranceExitShortestPath: false },
      rng as import('./seededRng').Rng,
    )
    expect(defId).toBe('Fungus')
  })

  it('pickNpcKindFromTable: SporeMist without Infested keeps 45% Wurglepup / Bobr split', () => {
    const room: GenRoom = {
      id: 'r1',
      rect: { x: 0, y: 0, w: 3, h: 3 },
      center: { x: 1, y: 1 },
      leafDepth: 0,
      tags: { roomFunction: 'Habitat', roomProperties: 'SporeMist' },
    }
    const baseCtx = {
      floorType: 'Dungeon' as const,
      floorProperties: [] as const,
      room,
      idx: 0,
      isNear: true,
      isOnEntranceExitShortestPath: false,
    }
    const rngLow = { next: () => 0.2, int: (min: number) => min, pick: <T,>(a: readonly T[]) => a[0]! }
    expect(pickNpcKindFromTable(baseCtx, rngLow as import('./seededRng').Rng)).toBe('Wurglepup')
    const rngHigh = { next: () => 0.5, int: (min: number) => min, pick: <T,>(a: readonly T[]) => a[0]! }
    expect(pickNpcKindFromTable(baseCtx, rngHigh as import('./seededRng').Rng)).toBe('Bobr')
  })

  it('pickNpcKindFromTable: Infested SporeMist can return Bulba, SporeGrub, or Grub', () => {
    const room: GenRoom = {
      id: 'r1',
      rect: { x: 0, y: 0, w: 3, h: 3 },
      center: { x: 1, y: 1 },
      leafDepth: 0,
      tags: { roomFunction: 'Habitat', roomProperties: 'SporeMist' },
    }
    const ctx = {
      floorType: 'Cave' as const,
      floorProperties: ['Infested'] as const,
      room,
      idx: 0,
      isNear: false,
      isOnEntranceExitShortestPath: false,
    }
    const rngBulba = { next: () => 0.1, int: (min: number) => min, pick: <T,>(a: readonly T[]) => a[0]! }
    expect(pickNpcKindFromTable(ctx, rngBulba as import('./seededRng').Rng)).toBe('Bulba')
    const rngSporeGrub = { next: () => 0.27, int: (min: number) => min, pick: <T,>(a: readonly T[]) => a[0]! }
    expect(pickNpcKindFromTable(ctx, rngSporeGrub as import('./seededRng').Rng)).toBe('SporeGrub')
    const rngGrub = { next: () => 0.35, int: (min: number) => min, pick: <T,>(a: readonly T[]) => a[0]! }
    expect(pickNpcKindFromTable(ctx, rngGrub as import('./seededRng').Rng)).toBe('Grub')
  })

  it('pickFloorItemDefFromTable: Infested Habitat can return Grubling', () => {
    const room: GenRoom = {
      id: 'r1',
      rect: { x: 0, y: 0, w: 3, h: 3 },
      center: { x: 1, y: 1 },
      leafDepth: 0,
      tags: { roomFunction: 'Habitat' },
    }
    let i = 0
    const rng = {
      // First roll must be in [0.06, 0.18) to hit Grubling (below 0.06 is Slime/GlassVial).
      next: () => (i++ === 0 ? 0.07 : 0.99),
      int: (min: number, maxExclusive: number) => min,
      pick: <T,>(arr: readonly T[]) => arr[0]!,
    }
    const defId = pickFloorItemDefFromTable(
      {
        floorType: 'Dungeon',
        floorProperties: ['Infested'],
        room,
        isOnEntranceExitShortestPath: false,
      },
      rng as import('./seededRng').Rng,
    )
    expect(defId).toBe('Grubling')
  })

  it('pickFloorItemDefFromTable: Jungle Habitat can return Grubling', () => {
    const room: GenRoom = {
      id: 'r1',
      rect: { x: 0, y: 0, w: 3, h: 3 },
      center: { x: 1, y: 1 },
      leafDepth: 0,
      tags: { roomFunction: 'Habitat' },
    }
    let i = 0
    const rng = {
      next: () => (i++ === 0 ? 0.05 : 0.99),
      int: (min: number, maxExclusive: number) => min,
      pick: <T,>(arr: readonly T[]) => arr[0]!,
    }
    const defId = pickFloorItemDefFromTable(
      { floorType: 'Jungle', floorProperties: [], room, isOnEntranceExitShortestPath: false },
      rng as import('./seededRng').Rng,
    )
    expect(defId).toBe('Grubling')
  })

  it('spawnNpcsAndItems places multiple floor cells for Habitat mushroom patch', () => {
    const w = 16
    const h = 16
    const tiles = flatFloor(w, h)
    const entrance = { x: 0, y: 0 }
    const exit = { x: 15, y: 15 }
    const room: GenRoom = {
      id: 'r_hab',
      rect: { x: 4, y: 4, w: 8, h: 8 },
      center: { x: 8, y: 8 },
      leafDepth: 0,
      tags: { roomFunction: 'Habitat' },
    }
    const rng = mulberry32(20260412)
    const occupied = new Set<string>()
    const { floorItems } = spawnNpcsAndItems({
      tiles,
      w,
      h,
      rooms: [room],
      entrance,
      exit,
      occupied,
      rng,
      floorType: 'Dungeon',
      npcSpawnCountMin: 1,
      npcSpawnCountMax: 1,
    })
    const mush = floorItems.filter((it) => it.defId === 'Mushrooms')
    expect(mush.length).toBeGreaterThanOrEqual(2)
    expect(mush.length).toBeLessThanOrEqual(5)
    for (const it of mush) {
      expect(it.pos.x).toBeGreaterThanOrEqual(room.rect.x)
      expect(it.pos.y).toBeGreaterThanOrEqual(room.rect.y)
      expect(it.pos.x).toBeLessThan(room.rect.x + room.rect.w)
      expect(it.pos.y).toBeLessThan(room.rect.y + room.rect.h)
      expect(Math.abs(it.pos.x - room.center.x) + Math.abs(it.pos.y - room.center.y)).toBeLessThanOrEqual(2)
    }
  })
})
