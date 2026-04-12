import { describe, expect, it } from 'vitest'
import { ContentDB } from '../content/contentDb'
import { equipItem } from './equipment'
import { makeInitialState } from './initialState'

const content = ContentDB.createDefault()

describe('equipItem head slot', () => {
  it('does not equip a hand weapon onto head (paperdoll / equipmentSlot path)', () => {
    const state0 = makeInitialState(content)
    const charId = state0.party.chars[0]!.id
    const clubIdx = state0.party.inventory.slots.findIndex((id) => id && state0.party.items[id]?.defId === 'Club')
    expect(clubIdx).toBeGreaterThanOrEqual(0)
    const clubId = state0.party.inventory.slots[clubIdx]!
    const next = equipItem(state0, charId, 'head', clubId, content)
    expect(next).toBe(state0)
    expect(next.party.chars[0]!.equipment.head).toBeUndefined()
    expect(next.party.inventory.slots[clubIdx]).toBe(clubId)
  })

  it('still equips a hat when def allows head', () => {
    const state0 = makeInitialState(content)
    const charId = state0.party.chars[0]!.id
    const emptyIdx = state0.party.inventory.slots.findIndex((s) => s == null)
    expect(emptyIdx).toBeGreaterThanOrEqual(0)
    const hatId = 'i_hat_test'
    const state1 = {
      ...state0,
      party: {
        ...state0.party,
        items: { ...state0.party.items, [hatId]: { id: hatId, defId: 'WoolCap', qty: 1 } },
        inventory: {
          ...state0.party.inventory,
          slots: state0.party.inventory.slots.map((s, i) => (i === emptyIdx ? hatId : s)),
        },
      },
    }
    const next = equipItem(state1, charId, 'head', hatId, content)
    expect(next.party.chars[0]!.equipment.head).toBe(hatId)
    expect(next.party.inventory.slots[emptyIdx]).toBeNull()
  })
})
