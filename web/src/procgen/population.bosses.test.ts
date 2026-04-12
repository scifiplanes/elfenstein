import { describe, expect, it } from 'vitest'
import type { Tile } from '../game/types'
import type { GenRoom } from './types'
import { mulberry32 } from './seededRng'
import { spawnNpcsAndItems } from './population'

function flatFloor(w: number, h: number): Tile[] {
  return Array.from({ length: w * h }, () => 'floor')
}

describe('spawnNpcsAndItems bosses', () => {
  it('places at least one boss when floor rules match (Cursed path-center room)', () => {
    const w = 15
    const h = 15
    const tiles = flatFloor(w, h)
    const entrance = { x: 0, y: 0 }
    const exit = { x: 14, y: 14 }
    const room: GenRoom = {
      id: 'r_all',
      rect: { x: 0, y: 0, w, h },
      center: { x: 7, y: 7 },
      leafDepth: 0,
      district: 'Core',
    }
    const rng = mulberry32(42_001)
    const { npcs } = spawnNpcsAndItems({
      tiles,
      w,
      h,
      rooms: [room],
      entrance,
      exit,
      occupied: new Set(),
      rng,
      floorType: 'Dungeon',
      floorProperties: ['Cursed'],
      floorIndex: 0,
      populationStreamSeed: 77_007,
      npcSpawnCountMin: 2,
      npcSpawnCountMax: 4,
    })
    const bosses = npcs.filter((n) => n.variant === 'boss')
    expect(bosses.length).toBeGreaterThan(0)
    expect(bosses.every((b) => b.bossTraitId != null)).toBe(true)
  })
})
