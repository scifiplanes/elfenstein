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
})
