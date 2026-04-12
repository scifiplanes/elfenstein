import { describe, expect, it } from 'vitest'
import type { GameState, UiState } from '../types'
import { DEFAULT_AUDIO, DEFAULT_RENDER } from '../tuningDefaults'
import { DEFAULT_HUB_HOTSPOTS } from '../hubHotspotDefaults'
import {
  applyVitalsExplorationDrain,
  characterHasActiveStatus,
  staminaStepVitalsBumpForCharacter,
  syncStarvationDehydrationStatuses,
} from './vitalsDerived'

function shell(
  overrides: Partial<Omit<GameState, 'ui'>> & { ui?: Partial<UiState> },
): GameState {
  const { ui: uiOverrides, ...rest } = overrides
  return {
    nowMs: 0,
    ui: {
      screen: 'game',
      settingsOpen: false,
      debugOpen: false,
      roomTelegraphMode: 'auto',
      roomTelegraphStrength: 0.2,
      sfxQueue: [],
      activityLog: [],
      ...uiOverrides,
    },
    render: { ...DEFAULT_RENDER, ...rest.render },
    audio: { ...DEFAULT_AUDIO },
    hubHotspots: {
      village: { ...DEFAULT_HUB_HOTSPOTS.village },
      tavern: { ...DEFAULT_HUB_HOTSPOTS.tavern },
    },
    run: {
      runId: 't',
      startedAtMs: 0,
      xp: 0,
      level: 1,
      perkHistory: [],
      bonuses: { hpMaxBonus: 0, staminaMaxBonus: 0, damageBonusPct: 0 },
      ...rest.run,
    },
    view: { camPos: { x: 0, y: 0, z: 0 }, camYaw: 0 },
    party: rest.party ?? {
      chars: [],
      inventory: { cols: 1, rows: 1, slots: [null] },
      items: {},
    },
    floor: rest.floor ?? {
      seed: 1,
      floorIndex: 0,
      floorType: 'Dungeon',
      floorProperties: [],
      difficulty: 1,
      w: 8,
      h: 8,
      tiles: Array(64).fill('floor'),
      playerPos: { x: 1, y: 1 },
      playerDir: 0,
      npcs: [],
      pois: [],
      itemsOnFloor: [],
      floorGeomRevision: 0,
    },
    ...rest,
  } as GameState
}

const baseChar = {
  id: 'a' as const,
  name: 'A',
  species: 'Igor' as const,
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
  hp: 10,
  stamina: 20,
  statuses: [] as GameState['party']['chars'][number]['statuses'],
  equipment: {},
}

describe('applyVitalsExplorationDrain', () => {
  it('does not drain when not in dungeon screen', () => {
    const s = shell({
      ui: { screen: 'hub' },
      party: {
        chars: [{ ...baseChar, hunger: 50, thirst: 50 }],
        inventory: { cols: 1, rows: 1, slots: [null] },
        items: {},
      },
      render: { ...DEFAULT_RENDER, vitalsHungerDrainPerStep: 1, vitalsThirstDrainPerStep: 1 },
    })
    const next = applyVitalsExplorationDrain(s, 'step')
    expect(next.party.chars[0]!.hunger).toBe(50)
    expect(next.party.chars[0]!.thirst).toBe(50)
  })

  it('step drain uses fractional accrual until whole points', () => {
    const s = shell({
      party: {
        chars: [{ ...baseChar, hunger: 5, thirst: 5 }],
        inventory: { cols: 1, rows: 1, slots: [null] },
        items: {},
      },
      render: { ...DEFAULT_RENDER, vitalsHungerDrainPerStep: 0.4, vitalsThirstDrainPerStep: 0.5 },
    })
    const a = applyVitalsExplorationDrain(s, 'step')
    expect(a.party.chars[0]!.hunger).toBe(5)
    expect(a.party.chars[0]!.thirst).toBe(5)
    expect(a.run.vitalsDrainAccByChar?.a?.hunger).toBeCloseTo(0.4)
    const b = applyVitalsExplorationDrain(a, 'step')
    const c = applyVitalsExplorationDrain(b, 'step')
    expect(c.party.chars[0]!.hunger).toBe(4)
    expect(c.party.chars[0]!.thirst).toBe(4)
  })

  it('turn drain uses separate tuning', () => {
    const s = shell({
      party: {
        chars: [{ ...baseChar, hunger: 10, thirst: 10 }],
        inventory: { cols: 1, rows: 1, slots: [null] },
        items: {},
      },
      render: {
        ...DEFAULT_RENDER,
        vitalsHungerDrainPerStep: 0,
        vitalsThirstDrainPerStep: 0,
        vitalsHungerDrainPerTurn: 1,
        vitalsThirstDrainPerTurn: 1,
      },
    })
    const next = applyVitalsExplorationDrain(s, 'turn')
    expect(next.party.chars[0]!.hunger).toBe(9)
    expect(next.party.chars[0]!.thirst).toBe(9)
  })

  it('clamps vitals at 0', () => {
    const s = shell({
      party: {
        chars: [{ ...baseChar, hunger: 0, thirst: 1 }],
        inventory: { cols: 1, rows: 1, slots: [null] },
        items: {},
      },
      render: { ...DEFAULT_RENDER, vitalsHungerDrainPerStep: 0, vitalsThirstDrainPerStep: 2 },
    })
    const next = applyVitalsExplorationDrain(s, 'step')
    expect(next.party.chars[0]!.hunger).toBe(0)
    expect(next.party.chars[0]!.thirst).toBe(0)
  })

  it('skips dead characters', () => {
    const s = shell({
      party: {
        chars: [{ ...baseChar, hp: 0, hunger: 50, thirst: 50 }],
        inventory: { cols: 1, rows: 1, slots: [null] },
        items: {},
      },
      render: { ...DEFAULT_RENDER, vitalsHungerDrainPerStep: 5, vitalsThirstDrainPerStep: 5 },
    })
    const next = applyVitalsExplorationDrain(s, 'step')
    expect(next.party.chars[0]!.hunger).toBe(50)
  })
})

describe('syncStarvationDehydrationStatuses', () => {
  it('adds permanent statuses at 0 and removes when refilled', () => {
    let s = shell({
      nowMs: 1000,
      party: {
        chars: [{ ...baseChar, hunger: 0, thirst: 0, statuses: [] }],
        inventory: { cols: 1, rows: 1, slots: [null] },
        items: {},
      },
    })
    s = syncStarvationDehydrationStatuses(s)
    const c = s.party.chars[0]!
    expect(characterHasActiveStatus(c, s, 'Starving')).toBe(true)
    expect(characterHasActiveStatus(c, s, 'Dehydrated')).toBe(true)
    expect(c.statuses.find((x) => x.id === 'Starving')?.untilMs).toBeUndefined()

    const chars = s.party.chars.slice()
    chars[0] = { ...c, hunger: 1, thirst: 1 }
    s = { ...s, party: { ...s.party, chars } }
    s = syncStarvationDehydrationStatuses(s)
    const c2 = s.party.chars[0]!
    expect(characterHasActiveStatus(c2, s, 'Starving')).toBe(false)
    expect(characterHasActiveStatus(c2, s, 'Dehydrated')).toBe(false)
  })
})

describe('staminaStepVitalsBumpForCharacter', () => {
  it('sums configured penalties when statuses active', () => {
    const s = shell({
      party: {
        chars: [
          {
            ...baseChar,
            hunger: 0,
            thirst: 0,
            statuses: [
              { id: 'Starving', untilMs: undefined },
              { id: 'Dehydrated', untilMs: undefined },
            ],
          },
        ],
        inventory: { cols: 1, rows: 1, slots: [null] },
        items: {},
      },
      render: {
        ...DEFAULT_RENDER,
        vitalsDrainStaminaStepPenaltyStarving: 2,
        vitalsDrainStaminaStepPenaltyDehydrated: 1,
      },
    })
    const c = s.party.chars[0]!
    expect(staminaStepVitalsBumpForCharacter(s, c)).toBe(3)
  })
})
