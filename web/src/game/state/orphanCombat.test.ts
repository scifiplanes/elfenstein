import { describe, expect, it } from 'vitest'
import { ContentDB } from '../content/contentDb'
import { reduce } from '../reducer'
import type { GameState } from '../types'
import { makeInitialState } from './initialState'

const content = ContentDB.createDefault()

/** Combat whose `participants.npcs` do not exist on `floor.npcs` (desync / soft-lock scenario). */
function orphanCombatState(): GameState {
  const base = makeInitialState(content, { floorSeed: 424242 })
  const pcId = base.party.chars.find((c) => c.hp > 0)!.id
  return {
    ...base,
    ui: { ...base.ui, screen: 'game' },
    floor: { ...base.floor, npcs: [] },
    combat: {
      encounterId: 'enc_orphan_test',
      startedAtMs: base.nowMs,
      participants: {
        party: base.party.chars.filter((c) => c.hp > 0).map((c) => c.id),
        npcs: ['n_no_longer_on_floor'],
      },
      turnQueue: [{ kind: 'pc', id: pcId as any, initiative: 10 }],
      turnIndex: 0,
      pcDefense: {},
    },
  }
}

describe('orphan encounter combat', () => {
  it('combat/fleeAttempt clears combat via maybeEndCombat (no silent no-op)', () => {
    const s0 = orphanCombatState()
    expect(s0.combat).toBeDefined()
    const s1 = reduce(s0, { type: 'combat/fleeAttempt' })
    expect(s1.combat).toBeUndefined()
    const log = s1.ui.activityLog ?? []
    const last = log[log.length - 1]?.text ?? ''
    expect(last).toMatch(/Encounter won/)
  })

  it('time/tick clears orphan combat', () => {
    const s0 = orphanCombatState()
    const s1 = reduce(s0, { type: 'time/tick', nowMs: s0.nowMs + 500 })
    expect(s1.combat).toBeUndefined()
    const won = (s1.ui.activityLog ?? []).some((e) => e.text.includes('Encounter won'))
    expect(won).toBe(true)
  })
})
