import { describe, expect, it } from 'vitest'
import type { CombatState, GameState } from '../types'
import { npcKindHpMax } from '../content/npcCombat'
import { DEFAULT_AUDIO, DEFAULT_RENDER } from '../tuningDefaults'
import { DEFAULT_HUB_HOTSPOTS } from '../hubHotspotDefaults'
import { combatVictoryXp, combatXpDepthMul } from './runProgression'

function mkCombat(npcIds: string[]): CombatState {
  return {
    encounterId: 'e1',
    startedAtMs: 0,
    participants: { party: ['c1'], npcs: npcIds },
    turnQueue: [],
    turnIndex: 0,
  }
}

function baseFloor(overrides: Partial<GameState['floor']>): GameState['floor'] {
  return {
    seed: 1,
    floorIndex: 0,
    floorType: 'Dungeon',
    floorProperties: [],
    difficulty: 1,
    w: 16,
    h: 16,
    tiles: Array(16 * 16).fill('floor'),
    pois: [],
    itemsOnFloor: [],
    floorGeomRevision: 0,
    npcs: [],
    ...overrides,
  }
}

function shell(floor: GameState['floor']): GameState {
  return {
    nowMs: 0,
    ui: {
      screen: 'game',
      settingsOpen: false,
      debugOpen: false,
      roomTelegraphMode: 'auto',
      roomTelegraphStrength: 0.2,
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
      runId: 't',
      startedAtMs: 0,
      xp: 0,
      level: 1,
      perkHistory: [],
      bonuses: { hpMaxBonus: 0, staminaMaxBonus: 0, damageBonusPct: 0 },
    },
    party: { chars: [], items: {}, inventory: { slots: Array(24).fill(null) } },
    view: { camPos: { x: 0, y: 0, z: 0 }, camYaw: 0 },
    floor,
  }
}

describe('combatXpDepthMul', () => {
  it('increases with floorIndex and difficulty up to cap', () => {
    const low = shell(baseFloor({ floorIndex: 0, difficulty: 0 }))
    const high = shell(baseFloor({ floorIndex: 20, difficulty: 2 }))
    expect(combatXpDepthMul(high)).toBeGreaterThan(combatXpDepthMul(low))
    expect(combatXpDepthMul(high)).toBeLessThanOrEqual(1.25)
  })
})

describe('combatVictoryXp', () => {
  it('gives more XP for a tougher enemy than a weak one (same count)', () => {
    const weak = shell(
      baseFloor({
        npcs: [
          {
            id: 'w',
            kind: 'Kuratko',
            name: 'w',
            pos: { x: 1, y: 1 },
            status: 'hostile',
            hp: 0,
            hpMax: npcKindHpMax('Kuratko'),
            language: 'Common',
            statuses: [],
          },
        ],
      }),
    )
    const tough = shell(
      baseFloor({
        npcs: [
          {
            id: 't',
            kind: 'Chumbo',
            name: 't',
            pos: { x: 1, y: 1 },
            status: 'hostile',
            hp: 0,
            hpMax: npcKindHpMax('Chumbo'),
            language: 'Common',
            statuses: [],
          },
        ],
      }),
    )
    expect(combatVictoryXp(tough, mkCombat(['t']))).toBeGreaterThan(combatVictoryXp(weak, mkCombat(['w'])))
  })

  it('pays more for boss variant than normal for same kind and hpMax', () => {
    const hp = npcKindHpMax('Skeleton')
    const normal = shell(
      baseFloor({
        npcs: [
          {
            id: 'n',
            kind: 'Skeleton',
            name: 'n',
            pos: { x: 1, y: 1 },
            status: 'hostile',
            hp: 0,
            hpMax: hp,
            language: 'Common',
            statuses: [],
          },
        ],
      }),
    )
    const boss = shell(
      baseFloor({
        npcs: [
          {
            id: 'b',
            kind: 'Skeleton',
            name: 'b',
            pos: { x: 1, y: 1 },
            status: 'hostile',
            hp: 0,
            hpMax: hp,
            language: 'Common',
            statuses: [],
            variant: 'boss',
          },
        ],
      }),
    )
    expect(combatVictoryXp(boss, mkCombat(['b']))).toBeGreaterThan(combatVictoryXp(normal, mkCombat(['n'])))
  })

  it('uses 10 XP fallback per participant when npc row is missing', () => {
    const st = shell(baseFloor({ npcs: [] }))
    expect(combatVictoryXp(st, mkCombat(['ghost', 'ghost2']))).toBe(20)
  })
})
