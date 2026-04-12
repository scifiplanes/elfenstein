import { describe, expect, it } from 'vitest'
import { pickFloorFriendlyNpcTrade } from '../game/content/trading'
import type { Tile } from '../game/types'
import type { GenRoom } from './types'
import { mulberry32 } from './seededRng'
import { spawnNpcsAndItems } from './population'

function flatFloor(w: number, h: number): Tile[] {
  return Array.from({ length: w * h }, () => 'floor')
}

describe('pickFloorFriendlyNpcTrade', () => {
  it('returns non-empty stock and wants; clones are independent of prior mutations', () => {
    const a = pickFloorFriendlyNpcTrade(mulberry32(404), 0)
    expect(a.stock.length).toBeGreaterThan(0)
    expect(a.wants.length).toBeGreaterThan(0)
    a.stock[0]!.qty = 999
    const b = pickFloorFriendlyNpcTrade(mulberry32(404), 0)
    expect(b.stock[0]!.qty).not.toBe(999)
  })
})

describe('spawnNpcsAndItems floor friendly trade', () => {
  it('assigns trade to some procgen-friendly merchant-kind NPCs (deterministic seed search)', () => {
    const w = 12
    const h = 12
    const tiles = flatFloor(w, h)
    const entrance = { x: 1, y: 1 }
    const exit = { x: 10, y: 10 }
    const room: GenRoom = {
      id: 'r_one',
      rect: { x: 0, y: 0, w, h },
      center: { x: 6, y: 6 },
      leafDepth: 0,
    }
    let found: { npc: import('./types').GenNpc } | null = null
    for (let seed = 0; seed < 8000; seed++) {
      const occupied = new Set<string>()
      const rng = mulberry32(seed)
      const { npcs } = spawnNpcsAndItems({
        tiles,
        w,
        h,
        rooms: [room],
        entrance,
        exit,
        occupied,
        rng,
        floorType: 'Ruins',
        npcSpawnCountMin: 12,
        npcSpawnCountMax: 12,
        spawnBosses: false,
      })
      const t = npcs.find((n) => n.trade != null)
      if (t && t.trade!.stock.length > 0 && t.trade!.wants.length > 0) {
        found = { npc: t }
        break
      }
    }
    expect(found).not.toBeNull()
    if (!found) return
    expect(found.npc.status).toBe('friendly')
    expect(
      found.npc.kind === 'Elder' ||
        found.npc.kind === 'Snailord' ||
        found.npc.kind === 'Bok' ||
        found.npc.kind === 'RegularBok' ||
        found.npc.kind === 'Grechka',
    ).toBe(true)
  })
})
