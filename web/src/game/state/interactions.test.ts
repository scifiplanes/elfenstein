import { describe, expect, it } from 'vitest'
import { ContentDB } from '../content/contentDb'
import type { ItemId } from '../types'
import { feedCharacter } from './interactions'
import { makeInitialState } from './initialState'

const content = ContentDB.createDefault()

describe('feedCharacter', () => {
  it('Cooling poultice removes Burning', () => {
    const base = makeInitialState(content)
    const cid = base.party.chars[0]!.id
    const itemId = 'i_cool' as ItemId
    const state = {
      ...base,
      party: {
        ...base.party,
        chars: base.party.chars.map((c, i) =>
          i === 0 ? { ...c, statuses: [{ id: 'Burning' as const, untilMs: base.nowMs + 10_000 }] } : c,
        ),
        items: {
          ...base.party.items,
          [itemId]: { id: itemId, defId: 'CoolingPoultice', qty: 1 },
        },
      },
    }
    const next = feedCharacter(state, content, cid, itemId)
    expect(next.party.chars[0]?.statuses.some((s) => s.id === 'Burning')).toBe(false)
    expect(next.party.items[itemId]).toBeUndefined()
  })

  it('Waterbag (Full) feed leaves Waterbag (Empty)', () => {
    const base = makeInitialState(content)
    const cid = base.party.chars[0]!.id
    const itemId = 'i_wb_test' as ItemId
    const state = {
      ...base,
      party: {
        ...base.party,
        items: {
          ...base.party.items,
          [itemId]: { id: itemId, defId: 'WaterbagFull', qty: 1 },
        },
      },
    }
    const slot = state.party.inventory.slots.findIndex((s) => s == null)
    const slots = state.party.inventory.slots.slice()
    if (slot >= 0) slots[slot] = itemId
    const withSlot = { ...state, party: { ...state.party, inventory: { ...state.party.inventory, slots } } }
    const next = feedCharacter(withSlot, content, cid, itemId)
    expect(next.party.items[itemId]).toBeUndefined()
    const empties = Object.values(next.party.items).filter((i) => i.defId === 'WaterbagEmpty')
    expect(empties.reduce((s, i) => s + i.qty, 0)).toBe(1)
  })

  it('Dry wrap removes Drenched', () => {
    const base = makeInitialState(content)
    const cid = base.party.chars[0]!.id
    const itemId = 'i_dry' as ItemId
    const state = {
      ...base,
      party: {
        ...base.party,
        chars: base.party.chars.map((c, i) =>
          i === 0 ? { ...c, statuses: [{ id: 'Drenched' as const, untilMs: base.nowMs + 10_000 }] } : c,
        ),
        items: {
          ...base.party.items,
          [itemId]: { id: itemId, defId: 'DryWrap', qty: 1 },
        },
      },
    }
    const next = feedCharacter(state, content, cid, itemId)
    expect(next.party.chars[0]?.statuses.some((s) => s.id === 'Drenched')).toBe(false)
    expect(next.party.items[itemId]).toBeUndefined()
  })

  it('does not feed a dead character', () => {
    const base = makeInitialState(content)
    const cid = base.party.chars[0]!.id
    const itemId = 'i_food_dead' as ItemId
    const state = {
      ...base,
      party: {
        ...base.party,
        chars: base.party.chars.map((c, i) => (i === 0 ? { ...c, hp: 0 } : c)),
        items: {
          ...base.party.items,
          [itemId]: { id: itemId, defId: 'RoastMushrooms', qty: 1 },
        },
      },
    }
    const next = feedCharacter(state, content, cid, itemId)
    expect(next.party.items[itemId]).toBeDefined()
    expect(next.ui.activityLog.some((e) => e.text.includes('cannot eat'))).toBe(true)
  })
})
