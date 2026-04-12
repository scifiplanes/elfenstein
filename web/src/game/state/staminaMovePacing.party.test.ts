import { describe, expect, it } from 'vitest'
import { ContentDB } from '../content/contentDb'
import { reduce } from '../reducer'
import type { Character, CharacterId, GameState } from '../types'
import { makeInitialState } from './initialState'

const CONTENT = ContentDB.createDefault()

/** Fixed procgen seed so forward-from-spawn is walkable (random seeds can bump on step 1). */
const PACING_TEST_FLOOR_SEED = 0

function mkChar(id: string, endurance: number, stamina: number): Character {
  return {
    id: id as CharacterId,
    name: id,
    species: 'Igor',
    endurance,
    stats: {
      strength: 5,
      agility: 5,
      speed: 5,
      perception: 5,
      endurance,
      intelligence: 5,
      wisdom: 5,
      luck: 5,
    },
    armor: 0,
    resistances: {},
    skills: {},
    hunger: 60,
    thirst: 60,
    hp: 10,
    stamina,
    statuses: [],
    equipment: {},
  }
}

function clearMoveAnim(s: GameState): GameState {
  return reduce(s, { type: 'time/tick', nowMs: s.nowMs + 500 })
}

describe('stamina move pacing (per-character)', () => {
  it('charges step stamina on different beats for different endurance', () => {
    let s = makeInitialState(CONTENT, { floorSeed: PACING_TEST_FLOOR_SEED })
    s = {
      ...s,
      ui: { ...s.ui, screen: 'game' },
      render: { ...s.render, staminaCostStep: 1, staminaCostStepEveryN: 1 },
      party: {
        ...s.party,
        chars: [mkChar('c_fast', 5, 30), mkChar('c_slow', 10, 30)],
      },
      // Procgen RNG can place a hostile on the step line; this test is about pacing, not encounters.
      floor: { ...s.floor, npcs: [] },
    }

    const p0 = s.floor.playerPos
    s = reduce(s, { type: 'player/step', forward: 1 })
    expect(s.party.chars.find((c) => c.id === 'c_fast')!.stamina).toBe(29)
    expect(s.party.chars.find((c) => c.id === 'c_slow')!.stamina).toBe(30)

    s = clearMoveAnim(s)
    s = reduce(s, { type: 'player/step', forward: -1 })
    expect(s.party.chars.find((c) => c.id === 'c_fast')!.stamina).toBe(28)
    expect(s.party.chars.find((c) => c.id === 'c_slow')!.stamina).toBe(29)

    s = clearMoveAnim(s)
    s = reduce(s, { type: 'player/step', forward: 1 })
    expect(s.floor.playerPos).not.toEqual(p0)
    expect(s.party.chars.find((c) => c.id === 'c_fast')!.stamina).toBe(27)
    expect(s.party.chars.find((c) => c.id === 'c_slow')!.stamina).toBe(29)
  })

  it('applies staminaDrainStepMultiplier to step tick cost', () => {
    let s = makeInitialState(CONTENT, { floorSeed: PACING_TEST_FLOOR_SEED })
    s = {
      ...s,
      ui: { ...s.ui, screen: 'game' },
      render: { ...s.render, staminaCostStep: 1, staminaCostStepEveryN: 1, staminaDrainStepMultiplier: 2 },
      party: {
        ...s.party,
        chars: [mkChar('c_a', 5, 30)],
      },
      // Same as sibling test: procgen can place a hostile on the step line.
      floor: { ...s.floor, npcs: [] },
    }
    s = reduce(s, { type: 'player/step', forward: 1 })
    expect(s.party.chars[0]!.stamina).toBe(28)
  })

  it('rejects step when a due payer cannot afford; counters unchanged', () => {
    let s = makeInitialState(CONTENT, { floorSeed: PACING_TEST_FLOOR_SEED })
    s = {
      ...s,
      ui: { ...s.ui, screen: 'game' },
      render: { ...s.render, staminaCostStep: 1, staminaCostStepEveryN: 1 },
      party: {
        ...s.party,
        chars: [mkChar('c_broke', 5, 0), mkChar('c_ok', 5, 10)],
      },
      floor: { ...s.floor, npcs: [] },
    }
    const before = s
    const next = reduce(s, { type: 'player/step', forward: 1 })
    expect(next.floor.playerPos).toEqual(before.floor.playerPos)
    expect(next.floor.staminaStepPaceByChar).toEqual(before.floor.staminaStepPaceByChar)
    expect(next.party.chars.map((c) => c.stamina)).toEqual(before.party.chars.map((c) => c.stamina))
  })
})
