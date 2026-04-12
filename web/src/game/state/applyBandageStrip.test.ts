import { describe, expect, it } from 'vitest'
import { ContentDB } from '../content/contentDb'
import type { ItemId } from '../types'
import { applyBandageStrip, computeBandageStripRotateDeg } from './interactions'
import { makeInitialState } from './initialState'

const content = ContentDB.createDefault()

describe('applyBandageStrip', () => {
  it('consumes strip, clears bleeding, places decal at norm, no portrait mouth cue', () => {
    const base = makeInitialState(content)
    const cid = base.party.chars[0]!.id
    const itemId = 'i_band_test' as ItemId
    const state = {
      ...base,
      party: {
        ...base.party,
        chars: base.party.chars.map((c, i) =>
          i === 0 ? { ...c, statuses: [{ id: 'Bleeding' as const, untilMs: base.nowMs + 10_000 }] } : c,
        ),
        items: {
          ...base.party.items,
          [itemId]: { id: itemId, defId: 'BandageStrip', qty: 1 },
        },
      },
    }
    const slot = state.party.inventory.slots.findIndex((s) => s == null)
    const slots = state.party.inventory.slots.slice()
    if (slot >= 0) slots[slot] = itemId
    const withSlot = { ...state, party: { ...state.party, inventory: { ...state.party.inventory, slots } } }

    const norm = { u: 0.35, v: 0.62 }
    const wantRot = computeBandageStripRotateDeg(withSlot, cid, itemId)
    const next = applyBandageStrip(withSlot, content, cid, itemId, norm)

    expect(next.party.items[itemId]).toBeUndefined()
    expect(next.party.chars[0]?.statuses.some((s) => s.id === 'Bleeding')).toBe(false)
    expect(next.ui.portraitMouth).toBeUndefined()
    const decals = next.ui.portraitBandageDecals ?? []
    expect(decals.length).toBe(1)
    expect(decals[0]!.u).toBe(norm.u)
    expect(decals[0]!.v).toBe(norm.v)
    expect(decals[0]!.rotateDeg).toBe(wantRot)
    expect(decals[0]!.untilMs).toBeUndefined()
  })

  it('clamps drop norm when undefined', () => {
    const base = makeInitialState(content)
    const cid = base.party.chars[0]!.id
    const itemId = 'i_band_test2' as ItemId
    const state = {
      ...base,
      party: {
        ...base.party,
        items: {
          ...base.party.items,
          [itemId]: { id: itemId, defId: 'BandageStrip', qty: 1 },
        },
      },
    }
    const slot = state.party.inventory.slots.findIndex((s) => s == null)
    const slots = state.party.inventory.slots.slice()
    if (slot >= 0) slots[slot] = itemId
    const withSlot = { ...state, party: { ...state.party, inventory: { ...state.party.inventory, slots } } }

    const next = applyBandageStrip(withSlot, content, cid, itemId, undefined)
    expect((next.ui.portraitBandageDecals ?? [])[0]!.u).toBe(0.5)
    expect((next.ui.portraitBandageDecals ?? [])[0]!.v).toBe(0.5)
  })
})
