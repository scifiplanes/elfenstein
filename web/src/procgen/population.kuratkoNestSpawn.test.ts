import { describe, expect, it } from 'vitest'
import type { Tile } from '../game/types'
import type { GenRoom } from './types'
import { mulberry32 } from './seededRng'
import { spawnNpcsAndItems } from './population'

function flatFloor(w: number, h: number): Tile[] {
  return Array.from({ length: w * h }, () => 'floor')
}

function inRect(p: { x: number; y: number }, rect: { x: number; y: number; w: number; h: number }) {
  return p.x >= rect.x && p.x < rect.x + rect.w && p.y >= rect.y && p.y < rect.y + rect.h
}

/** Two stacked 5×5 rooms: upper = nest Habitat, lower = spawn sink (entrance/exit). */
function twoRoomLayout() {
  const w = 5
  const h = 10
  const nestRect = { x: 0, y: 0, w, h: 5 }
  const lowerRect = { x: 0, y: 5, w, h: 5 }
  const nestPos = { x: 2, y: 2 }
  const rooms: GenRoom[] = [
    {
      id: 'r_nest',
      rect: nestRect,
      center: nestPos,
      leafDepth: 0,
      tags: { roomFunction: 'Habitat' },
    },
    {
      id: 'r_lower',
      rect: lowerRect,
      center: { x: 2, y: 7 },
      leafDepth: 0,
      tags: { roomFunction: 'Communal' },
    },
  ]
  return { w, h, tiles: flatFloor(w, h), nestRect, nestPos, rooms, entrance: { x: 2, y: 6 }, exit: { x: 2, y: 9 } }
}

describe('spawnNpcsAndItems Kuratko nest room guard', () => {
  it('retunes a non-Kuratko spawn in the nest room to Kuratko when kuratkoNestPos is set', () => {
    const w = 5
    const h = 5
    const nestPos = { x: 2, y: 2 }
    const rect = { x: 0, y: 0, w, h }
    const room: GenRoom = {
      id: 'r_nest',
      rect,
      center: nestPos,
      leafDepth: 0,
      tags: { roomFunction: 'Habitat' },
    }
    const tiles = flatFloor(w, h)
    const entrance = { x: 0, y: 0 }
    const exit = { x: 4, y: 4 }
    const occupied = new Set<string>([`${nestPos.x},${nestPos.y}`])
    const rng = mulberry32(0x4b7572a1)
    const { npcs } = spawnNpcsAndItems({
      tiles,
      w,
      h,
      rooms: [room],
      entrance,
      exit,
      occupied,
      rng,
      floorType: 'Cave',
      npcSpawnCountMin: 1,
      npcSpawnCountMax: 1,
      spawnBosses: false,
      populationStreamSeed: 0,
      kuratkoNestPos: nestPos,
    })
    const inRoom = npcs.filter((n) => inRect(n.pos, rect))
    expect(inRoom.length).toBeGreaterThanOrEqual(1)
    expect(inRoom.some((n) => n.kind === 'Kuratko' && n.variant !== 'boss')).toBe(true)
    expect(npcs.filter((n) => n.kind === 'Kuratko').length).toBe(1)
  })

  it('injects a Kuratko when the nest room has no regular NPC but has a free floor cell', () => {
    const { w, h, tiles, nestRect, nestPos, rooms, entrance, exit } = twoRoomLayout()
    const occupied = new Set<string>([`${nestPos.x},${nestPos.y}`])

    /** Deterministic seed where `npcCap===1` places the regular NPC in `r_lower`, triggering inject into `r_nest`. */
    const chosenSeed = 0

    const occ = new Set(occupied)
    const rng = mulberry32(chosenSeed)
    const { npcs } = spawnNpcsAndItems({
      tiles,
      w,
      h,
      rooms,
      entrance,
      exit,
      occupied: occ,
      rng,
      floorType: 'Cave',
      npcSpawnCountMin: 1,
      npcSpawnCountMax: 1,
      spawnBosses: false,
      populationStreamSeed: 0,
      kuratkoNestPos: nestPos,
    })
    expect(npcs).toHaveLength(2)
    const injected = npcs.find((n) => n.id.startsWith('g_npc_Kuratko_nest_'))
    expect(injected?.kind).toBe('Kuratko')
    expect(injected && inRect(injected.pos, nestRect)).toBe(true)
  })

  it('does not add nest inject when kuratkoNestPos is omitted', () => {
    const { w, h, tiles, nestPos, rooms, entrance, exit } = twoRoomLayout()
    const occupied = new Set<string>([`${nestPos.x},${nestPos.y}`])
    const rng = mulberry32(0x4b7572c3)
    const { npcs } = spawnNpcsAndItems({
      tiles,
      w,
      h,
      rooms,
      entrance,
      exit,
      occupied,
      rng,
      floorType: 'Cave',
      npcSpawnCountMin: 1,
      npcSpawnCountMax: 1,
      spawnBosses: false,
      populationStreamSeed: 0,
    })
    expect(npcs).toHaveLength(1)
    expect(npcs.some((n) => n.id.startsWith('g_npc_Kuratko_nest_'))).toBe(false)
  })
})
