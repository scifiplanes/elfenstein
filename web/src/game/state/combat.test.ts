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
  skipPcTurn,
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

  it('soloEncounter boss excludes other same-room hostiles from encounter', () => {
    const nBoss: GameState['floor']['npcs'][number] = {
      id: 'nb',
      kind: 'BigHands',
      name: 'nb',
      pos: { x: 3, y: 3 },
      status: 'hostile',
      hp: 40,
      hpMax: 40,
      language: 'DeepGnome',
      statuses: [],
      variant: 'boss',
      bossTraitId: 'boss_big_hands',
    }
    const n2 = mkNpc('n2', 'Skeleton', { x: 4, y: 3 })
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
        npcs: [nBoss, n2],
        playerPos: { x: 5, y: 5 },
        playerDir: 0,
      },
      party: {
        chars: [mkChar('c1', 5, 30)],
        inventory: { cols: 10, rows: 2, slots: emptySlots(20) },
        items: {},
      },
    })
    expect(collectEncounterNpcIds(state, 'nb').sort()).toEqual(['nb'])
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

describe('skipPcTurn', () => {
  it('logs wait and sets lastAction skip for acting PC', () => {
    const combat = {
      encounterId: 'enc_skip',
      startedAtMs: 0,
      participants: { party: ['c1'], npcs: ['n1'] },
      turnQueue: [
        { kind: 'pc' as const, id: 'c1', initiative: 10 },
        { kind: 'npc' as const, id: 'n1', initiative: 5 },
      ],
      turnIndex: 0,
    }
    const state = gameShell({
      nowMs: 1000,
      combat: { ...combat },
      floor: {
        seed: 1,
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
        chars: [mkChar('c1', 5, 30)],
        inventory: { cols: 10, rows: 2, slots: emptySlots(20) },
        items: {},
      },
    })
    const next = skipPcTurn(state, 'c1')
    expect(next.combat?.lastAction).toEqual({
      actorKind: 'pc',
      actorId: 'c1',
      action: 'skip',
      atMs: 1000,
    })
    expect((next.ui.activityLog ?? []).at(-1)?.text).toContain('waits')
  })
})

describe('attemptFlee', () => {
  it('rejects on NPC turn without advancing or spending stamina', () => {
    const combat = {
      encounterId: 'enc_npc_turn',
      startedAtMs: 0,
      participants: { party: ['c1'], npcs: ['n1'] },
      turnQueue: [
        { kind: 'npc' as const, id: 'n1', initiative: 10 },
        { kind: 'pc' as const, id: 'c1', initiative: 5 },
      ],
      turnIndex: 0,
    }
    const state = gameShell({
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
        chars: [mkChar('c1', 5, 30)],
        inventory: { cols: 10, rows: 2, slots: emptySlots(20) },
        items: {},
      },
    })
    const r = attemptFlee(state)
    expect(r.advanceTurn).toBe(false)
    expect(r.state.party.chars[0]!.stamina).toBe(30)
    expect((r.state.ui.activityLog ?? []).at(-1)?.text).toBe('Not your turn.')
    expect(r.state.ui.sfxQueue?.at(-1)?.kind).toBe('reject')
  })

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
    expect(texts.some((t) => t.includes('misses') || t.includes('damage'))).toBe(true)
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

  function mkState(seed: number, opts?: { debugOpen?: boolean }): GameState {
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
    const base = gameShell({
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
    if (opts?.debugOpen) return { ...base, ui: { ...base.ui, debugOpen: true } }
    return base
  }

  it('sets ui.portraitShake for the damaged PC on a hit', () => {
    let found = false
    for (let seed = 0; seed < 30_000; seed++) {
      const next = npcTakeTurn(mkState(seed), 'n1')
      const texts = (next.ui.activityLog ?? []).map((e) => e.text)
      if (!texts.some((t) => t.includes('damage'))) continue
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
      if (!texts.some((t) => t.includes('misses'))) continue
      found = true
      expect(next.ui.portraitShake).toBeUndefined()
      break
    }
    expect(found).toBe(true)
  })

  it('appends legacy roll formula when debug is open on a hit', () => {
    let found = false
    for (let seed = 0; seed < 30_000; seed++) {
      const next = npcTakeTurn(mkState(seed, { debugOpen: true }), 'n1')
      const texts = (next.ui.activityLog ?? []).map((e) => e.text)
      if (!texts.some((t) => t.includes('damage'))) continue
      found = true
      expect(texts.some((t) => t.includes('d20+Spd'))).toBe(true)
      break
    }
    expect(found).toBe(true)
  })
})

function parseTargetFromNpcAttackThematicLine(line: string): string | null {
  const miss = line.match(/ misses ([^.]+)\./)
  if (miss) return miss[1]!
  const hit = line.match(/ hits ([^ ]+) for/)
  if (hit) return hit[1]!
  const crit = line.match(/ critical hit on ([^ ]+) for/)
  if (crit) return crit[1]!
  return null
}

describe('npcTakeTurn weighted PC target pool', () => {
  it('targets both PCs across turns when two share the softest band (deterministic roll varies by turnIndex)', () => {
    const encId = 'enc_two_pc_aggro'
    let foundBoth = false
    for (let floorSeed = 0; floorSeed < 500; floorSeed++) {
      const targeted = new Set<string>()
      for (let turnIndex = 0; turnIndex < 80; turnIndex++) {
        const combat = {
          encounterId: encId,
          startedAtMs: 0,
          participants: { party: ['c1', 'c2'], npcs: ['n1'] },
          turnQueue: [
            { kind: 'npc' as const, id: 'n1', initiative: 10 },
            { kind: 'pc' as const, id: 'c1', initiative: 5 },
            { kind: 'pc' as const, id: 'c2', initiative: 4 },
          ],
          turnIndex,
        }
        const state = gameShell({
          combat,
          floor: {
            seed: floorSeed,
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
            chars: [mkChar('c1', 5, 30), mkChar('c2', 5, 30)],
            inventory: { cols: 10, rows: 2, slots: emptySlots(20) },
            items: {},
          },
        })
        const next = npcTakeTurn(state, 'n1')
        const texts = (next.ui.activityLog ?? []).map((e) => e.text)
        const attackLine = texts.find(
          (t) => t.includes(' misses ') || t.includes(' hits ') || t.includes('critical hit on'),
        )
        expect(attackLine).toBeTruthy()
        const tid = parseTargetFromNpcAttackThematicLine(attackLine!)
        expect(tid).toBeTruthy()
        targeted.add(tid!)
      }
      if (targeted.has('c1') && targeted.has('c2')) {
        foundBoth = true
        break
      }
    }
    expect(foundBoth).toBe(true)
  })
})
