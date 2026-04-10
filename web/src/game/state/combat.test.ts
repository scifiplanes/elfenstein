import { describe, expect, it } from 'vitest'
import type { Character, GameState } from '../types'
import { DEFAULT_AUDIO, DEFAULT_RENDER } from '../tuningDefaults'
import { DEFAULT_HUB_HOTSPOTS } from '../hubHotspotDefaults'
import { ContentDB } from '../content/contentDb'
import { npcQuestGibberishLine } from '../npc/npcQuestSpeech'
import {
  advanceTurnIndex,
  attemptFlee,
  collectEncounterNpcIds,
  npcTakeTurn,
  QUEST_SHOUT_CHANCE_PCT,
  questShoutRollMod100,
} from './combat'

const COMBAT_SPEECH_CONTENT = ContentDB.createDefault()

function mkChar(id: string, speed: number, stamina: number): Character {
  return {
    id,
    name: id,
    species: 'Igor',
    endurance: 5,
    stats: {
      strength: 5,
      agility: 5,
      speed,
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
    stamina,
    statuses: [],
    equipment: {},
  }
}

function mkNpc(
  id: string,
  kind: 'Swarm' | 'Skeleton',
  pos: { x: number; y: number },
): GameState['floor']['npcs'][number] {
  return {
    id,
    kind,
    name: id,
    pos,
    status: 'hostile',
    hp: 10,
    hpMax: 10,
    language: 'DeepGnome',
    statuses: [],
  }
}

function emptySlots(n: number): Array<null> {
  return Array.from({ length: n }, () => null)
}

function gameShell(overrides: Partial<GameState> & { floor: GameState['floor']; party: GameState['party'] }): GameState {
  const base: GameState = {
    nowMs: 0,
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
    ...overrides,
  }
  return base
}

describe('collectEncounterNpcIds', () => {
  it('includes hostiles in the same procgen room as the primary', () => {
    const n1 = mkNpc('n1', 'Skeleton', { x: 3, y: 3 })
    const n2 = mkNpc('n2', 'Skeleton', { x: 4, y: 3 })
    const n3 = mkNpc('n3', 'Skeleton', { x: 20, y: 20 })
    const state = gameShell({
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
        npcs: [n1, n2, n3],
        playerPos: { x: 5, y: 5 },
        playerDir: 0,
      },
      party: {
        chars: [mkChar('c1', 5, 30)],
        inventory: { cols: 10, rows: 2, slots: emptySlots(20) },
        items: {},
      },
    })
    const ids = collectEncounterNpcIds(state, 'n1')
    expect(ids.sort()).toEqual(['n1', 'n2'].sort())
  })

  it('excludes same-room hostiles beyond join range of player except the primary', () => {
    const n1 = mkNpc('n1', 'Skeleton', { x: 3, y: 3 })
    const n2 = mkNpc('n2', 'Skeleton', { x: 4, y: 3 })
    const state = gameShell({
      floor: {
        seed: 11,
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
        npcs: [n1, n2],
        playerPos: { x: 10, y: 10 },
        playerDir: 0,
      },
      party: {
        chars: [mkChar('c1', 5, 30)],
        inventory: { cols: 10, rows: 2, slots: emptySlots(20) },
        items: {},
      },
    })
    expect(collectEncounterNpcIds(state, 'n1').sort()).toEqual(['n1'])
  })

  it('uses Chebyshev distance when the primary cell is in no room', () => {
    const n1 = mkNpc('n1', 'Skeleton', { x: 5, y: 5 })
    const n2 = mkNpc('n2', 'Skeleton', { x: 5, y: 6 })
    const n3 = mkNpc('n3', 'Skeleton', { x: 5, y: 8 })
    const state = gameShell({
      floor: {
        seed: 2,
        floorIndex: 0,
        floorType: 'Dungeon',
        floorProperties: [],
        difficulty: 1,
        w: 31,
        h: 31,
        tiles: Array(31 * 31).fill('floor') as GameState['floor']['tiles'],
        pois: [],
        gen: undefined,
        itemsOnFloor: [],
        floorGeomRevision: 0,
        npcs: [n1, n2, n3],
        playerPos: { x: 5, y: 5 },
        playerDir: 0,
      },
      party: {
        chars: [mkChar('c1', 5, 30)],
        inventory: { cols: 10, rows: 2, slots: emptySlots(20) },
        items: {},
      },
    })
    const ids = collectEncounterNpcIds(state, 'n1')
    expect(ids.sort()).toEqual(['n1', 'n2'].sort())
  })

  it('returns empty when primary Swarm is neutralized by SwarmQueen in inventory', () => {
    const n1 = mkNpc('n1', 'Swarm', { x: 3, y: 3 })
    const state = gameShell({
      floor: {
        seed: 3,
        floorIndex: 0,
        floorType: 'Dungeon',
        floorProperties: [],
        difficulty: 1,
        w: 10,
        h: 10,
        tiles: Array(100).fill('floor') as GameState['floor']['tiles'],
        pois: [],
        gen: undefined,
        itemsOnFloor: [],
        floorGeomRevision: 0,
        npcs: [n1],
        playerPos: { x: 3, y: 3 },
        playerDir: 0,
      },
      party: {
        chars: [mkChar('c1', 5, 30)],
        inventory: {
          cols: 10,
          rows: 2,
          slots: (() => {
            const s: Array<string | null> = emptySlots(20)
            s[0] = 'iq'
            return s
          })(),
        },
        items: { iq: { id: 'iq', defId: 'SwarmQueen', qty: 1 } },
      },
    })
    expect(collectEncounterNpcIds(state, 'n1')).toEqual([])
  })
})

describe('advanceTurnIndex', () => {
  it('clears pcDefense when that PC becomes the active turn again', () => {
    const combat = {
      encounterId: 'enc_test',
      startedAtMs: 0,
      participants: { party: ['c1'], npcs: ['n1'] },
      turnQueue: [
        { kind: 'pc' as const, id: 'c1', initiative: 10 },
        { kind: 'npc' as const, id: 'n1', initiative: 8 },
      ],
      turnIndex: 1,
      pcDefense: { c1: { armorBonus: 2, resistBonusPct: 0.08 } },
    }
    const state = gameShell({
      combat,
      floor: {
        seed: 10,
        floorIndex: 0,
        floorType: 'Dungeon',
        floorProperties: [],
        difficulty: 1,
        w: 10,
        h: 10,
        tiles: Array(100).fill('floor') as GameState['floor']['tiles'],
        pois: [],
        itemsOnFloor: [],
        floorGeomRevision: 0,
        npcs: [mkNpc('n1', 'Skeleton', { x: 1, y: 1 })],
        playerPos: { x: 2, y: 2 },
        playerDir: 0,
      },
      party: {
        chars: [mkChar('c1', 5, 30)],
        inventory: { cols: 10, rows: 2, slots: emptySlots(20) },
        items: {},
      },
    })
    const next = advanceTurnIndex(state)
    expect(next.combat?.turnIndex).toBe(0)
    expect(next.combat?.pcDefense?.c1).toBeUndefined()
  })

  it('ticks pcFireshield turnsRemaining when entering that PC initiative', () => {
    const combat = {
      encounterId: 'enc_fs',
      startedAtMs: 0,
      participants: { party: ['c1'], npcs: ['n1'] },
      turnQueue: [
        { kind: 'npc' as const, id: 'n1', initiative: 9 },
        { kind: 'pc' as const, id: 'c1', initiative: 8 },
      ],
      turnIndex: 0,
      pcFireshield: { c1: { fireResistBonusPct: 0.25, turnsRemaining: 2 } },
    }
    const state = gameShell({
      combat,
      floor: {
        seed: 11,
        floorIndex: 0,
        floorType: 'Dungeon',
        floorProperties: [],
        difficulty: 1,
        w: 10,
        h: 10,
        tiles: Array(100).fill('floor') as GameState['floor']['tiles'],
        pois: [],
        itemsOnFloor: [],
        floorGeomRevision: 0,
        npcs: [mkNpc('n1', 'Skeleton', { x: 1, y: 1 })],
        playerPos: { x: 2, y: 2 },
        playerDir: 0,
      },
      party: {
        chars: [mkChar('c1', 5, 30)],
        inventory: { cols: 10, rows: 2, slots: emptySlots(20) },
        items: {},
      },
    })
    const afterNpc = advanceTurnIndex(state)
    expect(afterNpc.combat?.turnIndex).toBe(1)
    expect(afterNpc.combat?.pcFireshield?.c1?.turnsRemaining).toBe(1)

    const afterPc = advanceTurnIndex(afterNpc)
    expect(afterPc.combat?.turnIndex).toBe(0)
    expect(afterPc.combat?.pcFireshield?.c1?.turnsRemaining).toBe(1)

    const shieldConsumed = advanceTurnIndex(afterPc)
    expect(shieldConsumed.combat?.turnIndex).toBe(1)
    expect(shieldConsumed.combat?.pcFireshield).toBeUndefined()
  })
})

describe('attemptFlee', () => {
  it('returns advanceTurn true after a failed flee (deterministic search over nowMs)', () => {
    const combat = {
      encounterId: 'enc_flee',
      startedAtMs: 0,
      participants: { party: ['c1'], npcs: ['n1'] },
      turnQueue: [{ kind: 'pc' as const, id: 'c1', initiative: 10 }],
      turnIndex: 0,
    }
    const shell = (): GameState =>
      gameShell({
        nowMs: 0,
        combat: { ...combat },
        floor: {
          seed: 99,
          floorIndex: 0,
          floorType: 'Dungeon',
          floorProperties: [],
          difficulty: 1,
          w: 10,
          h: 10,
          tiles: Array(100).fill('floor') as GameState['floor']['tiles'],
          pois: [],
          itemsOnFloor: [],
          floorGeomRevision: 0,
          npcs: [mkNpc('n1', 'Swarm', { x: 1, y: 1 })],
          playerPos: { x: 2, y: 2 },
          playerDir: 0,
        },
        party: {
          chars: [mkChar('c1', 1, 30)],
          inventory: { cols: 10, rows: 2, slots: emptySlots(20) },
          items: {},
        },
      })

    let found = false
    for (let ms = 0; ms < 400_000; ms++) {
      const r = attemptFlee({ ...shell(), nowMs: ms })
      if (r.advanceTurn && r.state.combat) {
        found = true
        expect(r.state.combat.participants.npcs).toContain('n1')
        break
      }
    }
    expect(found).toBe(true)
  })
})

describe('npcTakeTurn quest shout', () => {
  const encId = 'enc_qs_test'

  function findShoutFloorSeed(): number {
    for (let s = 0; s < 10_000; s++) {
      if (questShoutRollMod100(s, encId, 'n1', 0) < QUEST_SHOUT_CHANCE_PCT) return s
    }
    throw new Error('no seed found for quest shout roll')
  }

  function mkQuestNpc(
    id: string,
    kind: 'Skeleton',
    pos: { x: number; y: number },
  ): GameState['floor']['npcs'][number] {
    return {
      ...mkNpc(id, kind, pos),
      quest: { wants: 'IronKey', hated: [] },
    }
  }

  it('appends gibberish quest line before swing when roll passes', () => {
    const seed = findShoutFloorSeed()
    const combat = {
      encounterId: encId,
      startedAtMs: 0,
      participants: { party: ['c1'], npcs: ['n1'] },
      turnQueue: [
        { kind: 'npc' as const, id: 'n1', initiative: 10 },
        { kind: 'pc' as const, id: 'c1', initiative: 5 },
      ],
      turnIndex: 0,
    }
    const state = gameShell({
      combat,
      floor: {
        seed,
        floorIndex: 0,
        floorType: 'Dungeon',
        floorProperties: [],
        difficulty: 1,
        w: 10,
        h: 10,
        tiles: Array(100).fill('floor') as GameState['floor']['tiles'],
        pois: [],
        itemsOnFloor: [],
        floorGeomRevision: 0,
        npcs: [mkQuestNpc('n1', 'Skeleton', { x: 1, y: 1 })],
        playerPos: { x: 2, y: 2 },
        playerDir: 0,
      },
      party: {
        chars: [mkChar('c1', 5, 100)],
        inventory: { cols: 10, rows: 2, slots: emptySlots(20) },
        items: {},
      },
    })
    const npc = mkQuestNpc('n1', 'Skeleton', { x: 1, y: 1 })
    const expectedGib = npcQuestGibberishLine(npc, (id) => COMBAT_SPEECH_CONTENT.item(id).name, seed)
    expect(expectedGib).toBeTruthy()
    const next = npcTakeTurn(state, 'n1')
    const texts = (next.ui.activityLog ?? []).map((e) => e.text)
    expect(texts.some((t) => t === `n1: "${expectedGib}"`)).toBe(true)
    expect(texts.some((t) => t.includes('bring me'))).toBe(false)
    expect(texts.some((t) => t.includes('→'))).toBe(true)
  })

  it('does not add quest line when NPC has no quest want', () => {
    const seed = findShoutFloorSeed()
    const combat = {
      encounterId: encId,
      startedAtMs: 0,
      participants: { party: ['c1'], npcs: ['n1'] },
      turnQueue: [
        { kind: 'npc' as const, id: 'n1', initiative: 10 },
        { kind: 'pc' as const, id: 'c1', initiative: 5 },
      ],
      turnIndex: 0,
    }
    const state = gameShell({
      combat,
      floor: {
        seed,
        floorIndex: 0,
        floorType: 'Dungeon',
        floorProperties: [],
        difficulty: 1,
        w: 10,
        h: 10,
        tiles: Array(100).fill('floor') as GameState['floor']['tiles'],
        pois: [],
        itemsOnFloor: [],
        floorGeomRevision: 0,
        npcs: [mkNpc('n1', 'Skeleton', { x: 1, y: 1 })],
        playerPos: { x: 2, y: 2 },
        playerDir: 0,
      },
      party: {
        chars: [mkChar('c1', 5, 100)],
        inventory: { cols: 10, rows: 2, slots: emptySlots(20) },
        items: {},
      },
    })
    const next = npcTakeTurn(state, 'n1')
    const texts = (next.ui.activityLog ?? []).map((e) => e.text)
    expect(texts.some((t) => t.includes('bring me'))).toBe(false)
  })
})

describe('npcTakeTurn portrait shake', () => {
  const encId = 'enc_portrait_shake_test'

  function mkState(seed: number): GameState {
    const combat = {
      encounterId: encId,
      startedAtMs: 0,
      participants: { party: ['c1'], npcs: ['n1'] },
      turnQueue: [
        { kind: 'npc' as const, id: 'n1', initiative: 10 },
        { kind: 'pc' as const, id: 'c1', initiative: 5 },
      ],
      turnIndex: 0,
    }
    return gameShell({
      nowMs: 1000,
      combat,
      floor: {
        seed,
        floorIndex: 0,
        floorType: 'Dungeon',
        floorProperties: [],
        difficulty: 1,
        w: 10,
        h: 10,
        tiles: Array(100).fill('floor') as GameState['floor']['tiles'],
        pois: [],
        itemsOnFloor: [],
        floorGeomRevision: 0,
        npcs: [mkNpc('n1', 'Skeleton', { x: 1, y: 1 })],
        playerPos: { x: 2, y: 2 },
        playerDir: 0,
      },
      party: {
        chars: [mkChar('c1', 5, 100)],
        inventory: { cols: 10, rows: 2, slots: emptySlots(20) },
        items: {},
      },
    })
  }

  it('sets ui.portraitShake for the damaged PC on a hit', () => {
    let found = false
    for (let seed = 0; seed < 30_000; seed++) {
      const next = npcTakeTurn(mkState(seed), 'n1')
      const texts = (next.ui.activityLog ?? []).map((e) => e.text)
      if (!texts.some((t) => t.includes('— hit'))) continue
      found = true
      const ps = next.ui.portraitShake
      expect(ps?.characterId).toBe('c1')
      expect(ps!.untilMs).toBeGreaterThan(ps!.startedAtMs)
      expect([0.18, 0.24]).toContain(ps!.magnitude)
      break
    }
    expect(found).toBe(true)
  })

  it('does not set portrait shake on a miss', () => {
    let found = false
    for (let seed = 0; seed < 30_000; seed++) {
      const next = npcTakeTurn(mkState(seed), 'n1')
      const texts = (next.ui.activityLog ?? []).map((e) => e.text)
      if (!texts.some((t) => t.includes('— miss.'))) continue
      found = true
      expect(next.ui.portraitShake).toBeUndefined()
      break
    }
    expect(found).toBe(true)
  })
})
