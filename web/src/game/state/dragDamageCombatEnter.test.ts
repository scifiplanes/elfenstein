import { describe, expect, it } from 'vitest'
import { ContentDB } from '../content/contentDb'
import { reduce } from '../reducer'
import type { GameState } from '../types'
import { DEFAULT_AUDIO, DEFAULT_RENDER } from '../tuningDefaults'
import { DEFAULT_HUB_HOTSPOTS } from '../hubHotspotDefaults'
import { inventoryItemFromDef } from './itemDurability'

const content = ContentDB.createDefault()

function mkChar(id: string): GameState['party']['chars'][number] {
  return {
    id,
    name: id,
    species: 'Igor',
    endurance: 5,
    stats: {
      strength: 5,
      agility: 5,
      speed: 5,
      perception: 5,
      endurance: 5,
      intelligence: 4,
      wisdom: 4,
      luck: 5,
    },
    armor: 0,
    resistances: {},
    skills: {},
    hunger: 50,
    thirst: 50,
    hp: 50,
    stamina: 30,
    statuses: [],
    equipment: {},
  }
}

function emptySlots(n: number): Array<null> {
  return Array.from({ length: n }, () => null)
}

function shellWithFloorNpc(
  npcHp: number,
  status: GameState['floor']['npcs'][number]['status'],
  id = 'n_floor',
): GameState {
  const npc: GameState['floor']['npcs'][number] = {
    id,
    kind: 'Skeleton',
    name: 'Skel',
    pos: { x: 3, y: 3 },
    status,
    hp: npcHp,
    hpMax: npcHp,
    language: 'DeepGnome',
    statuses: [],
  }
  return {
    nowMs: 1000,
    ui: {
      screen: 'game',
      settingsOpen: false,
      debugOpen: false,
      roomTelegraphMode: 'auto',
      roomTelegraphStrength: 0.2,
      sfxQueue: [],
      activityLog: [],
    },
    render: { ...DEFAULT_RENDER },
    audio: { ...DEFAULT_AUDIO },
    hubHotspots: {
      village: {
        tavern: { ...DEFAULT_HUB_HOTSPOTS.village.tavern },
        cave: { ...DEFAULT_HUB_HOTSPOTS.village.cave },
        tent: { ...DEFAULT_HUB_HOTSPOTS.village.tent },
      },
      tavern: {
        innkeeper: { ...DEFAULT_HUB_HOTSPOTS.tavern.innkeeper },
        innkeeperTrade: { ...DEFAULT_HUB_HOTSPOTS.tavern.innkeeperTrade },
      },
    },
    run: {
      runId: 'test',
      startedAtMs: 0,
      xp: 0,
      level: 1,
      perkHistory: [],
      bonuses: { hpMaxBonus: 0, staminaMaxBonus: 0, damageBonusPct: 0 },
    },
    view: { camPos: { x: 0, y: 0, z: 0 }, camYaw: 0 },
    floor: {
      seed: 1,
      floorIndex: 0,
      floorType: 'Dungeon',
      floorProperties: [],
      difficulty: 1,
      w: 31,
      h: 31,
      tiles: Array(31 * 31).fill('floor') as GameState['floor']['tiles'],
      pois: [],
      gen: {
        rooms: [
          {
            id: 'r1',
            rect: { x: 2, y: 2, w: 6, h: 6 },
            center: { x: 5, y: 5 },
            leafDepth: 1,
          },
        ],
      } as GameState['floor']['gen'],
      itemsOnFloor: [],
      floorGeomRevision: 0,
      npcs: [npc],
      playerPos: { x: 5, y: 5 },
      playerDir: 0,
    },
    party: {
      chars: [mkChar('c1')],
      inventory: { cols: 10, rows: 2, slots: emptySlots(20) },
      items: { i_club: inventoryItemFromDef(content, 'Club', 'i_club', 1) },
    },
  }
}

function shellWithHostileNpc(npcHp: number): GameState {
  return shellWithFloorNpc(npcHp, 'hostile', 'n_hostile')
}

describe('out-of-combat NPC damage auto-starts encounter', () => {
  it('npc/attack leaves combat entered when hostile survives (Club base 7)', () => {
    const s0 = shellWithHostileNpc(50)
    expect(s0.combat).toBeUndefined()
    const s1 = reduce(s0, { type: 'npc/attack', npcId: 'n_hostile', itemId: 'i_club' })
    expect(s1.combat).toBeDefined()
    expect(s1.combat?.participants.npcs).toContain('n_hostile')
    const npc = s1.floor.npcs.find((n) => n.id === 'n_hostile')
    expect(npc?.hp).toBe(43)
  })

  it('npc/attack does not enter combat when the blow kills the hostile', () => {
    const s0 = shellWithHostileNpc(3)
    const s1 = reduce(s0, { type: 'npc/attack', npcId: 'n_hostile', itemId: 'i_club' })
    expect(s1.combat).toBeUndefined()
    expect(s1.floor.npcs.some((n) => n.id === 'n_hostile')).toBe(false)
  })

  it('npc/attack provokes neutral NPC to hostile and enters combat', () => {
    const s0 = shellWithFloorNpc(50, 'neutral', 'n_neutral')
    expect(s0.combat).toBeUndefined()
    const s1 = reduce(s0, { type: 'npc/attack', npcId: 'n_neutral', itemId: 'i_club' })
    const npc = s1.floor.npcs.find((n) => n.id === 'n_neutral')
    expect(npc?.status).toBe('hostile')
    expect(s1.combat).toBeDefined()
    expect(s1.combat?.participants.npcs).toContain('n_neutral')
    expect(s1.ui.activityLog?.some((e) => e.text.includes('becomes hostile'))).toBe(true)
  })
})
