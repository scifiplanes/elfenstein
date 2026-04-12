import { describe, expect, it } from 'vitest'
import type { GameState } from '../types'
import { DEFAULT_AUDIO, DEFAULT_RENDER } from '../tuningDefaults'
import { DEFAULT_HUB_HOTSPOTS } from '../hubHotspotDefaults'
import {
  applyVitalsTimeDrain,
  characterHasActiveStatus,
  staminaStepVitalsBumpForCharacter,
  syncStarvationDehydrationStatuses,
} from './vitalsDerived'

function shell(overrides: Partial<GameState>): GameState {
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
      ...overrides.ui,
    },
    render: { ...DEFAULT_RENDER, ...overrides.render },
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
      ...overrides.run,
    },
    view: { camPos: { x: 0, y: 0, z: 0 }, camYaw: 0 },
    party: overrides.party ?? { chars: [] },
    floor: overrides.floor ?? {
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
    ...overrides,
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

describe('applyVitalsTimeDrain', () => {
  it('does not drain on hub/title', () => {
    const s = shell({
      ui: { screen: 'hub' },
      party: { chars: [{ ...baseChar, hunger: 50, thirst: 50 }] },
      render: { ...DEFAULT_RENDER, vitalsHungerDrainPerGameMin: 60, vitalsThirstDrainPerGameMin: 60 },
    })
    const next = applyVitalsTimeDrain(s, 60_000)
    expect(next.party.chars[0]!.hunger).toBe(50)
    expect(next.party.chars[0]!.thirst).toBe(50)
  })

  it('drains hunger/thirst from fractional accrual over ticks', () => {
    const s = shell({
      nowMs: 0,
      party: { chars: [{ ...baseChar, hunger: 5, thirst: 5 }] },
      render: { ...DEFAULT_RENDER, vitalsHungerDrainPerGameMin: 60, vitalsThirstDrainPerGameMin: 60 },
    })
    // 60 pts/min = 1 pt/s; 2s clamped tick → −2 each
    const a = applyVitalsTimeDrain(s, 2000)
    expect(a.party.chars[0]!.hunger).toBe(3)
    expect(a.party.chars[0]!.thirst).toBe(3)
    const b = applyVitalsTimeDrain(a, 4000)
    expect(b.party.chars[0]!.hunger).toBe(1)
    expect(b.party.chars[0]!.thirst).toBe(1)
  })

  it('clamps vitals at 0', () => {
    const s = shell({
      nowMs: 0,
      party: { chars: [{ ...baseChar, hunger: 1, thirst: 0 }] },
      render: { ...DEFAULT_RENDER, vitalsHungerDrainPerGameMin: 120, vitalsThirstDrainPerGameMin: 0 },
    })
    const next = applyVitalsTimeDrain(s, 2000)
    expect(next.party.chars[0]!.hunger).toBe(0)
  })

  it('skips dead characters', () => {
    const s = shell({
      party: { chars: [{ ...baseChar, hp: 0, hunger: 50, thirst: 50 }] },
      render: { ...DEFAULT_RENDER, vitalsHungerDrainPerGameMin: 60, vitalsThirstDrainPerGameMin: 60 },
    })
    const next = applyVitalsTimeDrain(s, 2000)
    expect(next.party.chars[0]!.hunger).toBe(50)
  })
})

describe('syncStarvationDehydrationStatuses', () => {
  it('adds permanent statuses at 0 and removes when refilled', () => {
    let s = shell({
      nowMs: 1000,
      party: { chars: [{ ...baseChar, hunger: 0, thirst: 0, statuses: [] }] },
    })
    s = syncStarvationDehydrationStatuses(s)
    const c = s.party.chars[0]!
    expect(characterHasActiveStatus(c, s, 'Starving')).toBe(true)
    expect(characterHasActiveStatus(c, s, 'Dehydrated')).toBe(true)
    expect(c.statuses.filter((x) => x.id === 'Starving')).toHaveLength(1)
    expect(c.statuses.filter((x) => x.id === 'Dehydrated')).toHaveLength(1)
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
