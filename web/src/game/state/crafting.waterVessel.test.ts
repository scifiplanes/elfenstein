import { describe, expect, it } from 'vitest'
import { ContentDB } from '../content/contentDb'
import { findRecipe } from '../content/recipes'
import type { GameState, ItemId } from '../types'
import { makeInitialState } from './initialState'
import { maybeFinishCrafting, startCrafting } from './crafting'

const content = ContentDB.createDefault()

describe('crafting full water vessel → empty on success', () => {
  it('HerbLeaf + WaterskinFull leaves WaterskinEmpty and crafts HerbTea', () => {
    const recipe = findRecipe('HerbLeaf', 'WaterskinFull')
    expect(recipe?.result).toBe('HerbTea')

    const base = makeInitialState(content)
    const herbId = 'i_herb' as ItemId
    const skinId = 'i_skin' as ItemId
    let state: GameState = {
      ...base,
      nowMs: 5_000_000,
      party: {
        ...base.party,
        inventory: { cols: 10, rows: 2, slots: Array.from({ length: 20 }, () => null) },
        items: {
          [herbId]: { id: herbId, defId: 'HerbLeaf', qty: 1 },
          [skinId]: { id: skinId, defId: 'WaterskinFull', qty: 1 },
        },
      },
      ui: { ...base.ui, crafting: undefined },
    }
    state.party.inventory.slots[0] = herbId
    state.party.inventory.slots[1] = skinId

    state = startCrafting(state, herbId, skinId, { ...recipe!, craftMs: 0, dc: 1, failDestroyChancePct: 0 })
    const c = state.ui.crafting!
    state = { ...state, nowMs: c.endsAtMs + 1 }

    const next = maybeFinishCrafting(state)
    expect(next.party.items[herbId]).toBeUndefined()
    expect(next.party.items[skinId]).toBeUndefined()
    expect(Object.values(next.party.items).some((it) => it.defId === 'HerbTea')).toBe(true)
    expect(Object.values(next.party.items).some((it) => it.defId === 'WaterskinEmpty')).toBe(true)
    expect(Object.values(next.party.items).some((it) => it.defId === 'WaterskinFull')).toBe(false)
  })

  it('MortarMeal + TravelFlaskFull leaves TravelFlaskEmpty and crafts Flourball', () => {
    const recipe = findRecipe('MortarMeal', 'TravelFlaskFull')
    expect(recipe?.result).toBe('Flourball')

    const base = makeInitialState(content)
    const mealId = 'i_meal' as ItemId
    const flaskId = 'i_flask' as ItemId
    let state: GameState = {
      ...base,
      nowMs: 6_000_000,
      party: {
        ...base.party,
        inventory: { cols: 10, rows: 2, slots: Array.from({ length: 20 }, () => null) },
        items: {
          [mealId]: { id: mealId, defId: 'MortarMeal', qty: 1 },
          [flaskId]: { id: flaskId, defId: 'TravelFlaskFull', qty: 1 },
        },
      },
      ui: { ...base.ui, crafting: undefined },
    }
    state.party.inventory.slots[0] = mealId
    state.party.inventory.slots[1] = flaskId

    state = startCrafting(state, mealId, flaskId, { ...recipe!, craftMs: 0, dc: 1, failDestroyChancePct: 0 })
    const c = state.ui.crafting!
    state = { ...state, nowMs: c.endsAtMs + 1 }

    const next = maybeFinishCrafting(state)
    expect(next.party.items[mealId]).toBeUndefined()
    expect(next.party.items[flaskId]).toBeUndefined()
    expect(Object.values(next.party.items).some((it) => it.defId === 'Flourball')).toBe(true)
    expect(Object.values(next.party.items).some((it) => it.defId === 'TravelFlaskEmpty')).toBe(true)
    expect(Object.values(next.party.items).some((it) => it.defId === 'TravelFlaskFull')).toBe(false)
  })

  it('KuratkoEgg + WaterbagFull leaves WaterbagEmpty and crafts BoiledKuratkoEgg', () => {
    const recipe = findRecipe('KuratkoEgg', 'WaterbagFull')
    expect(recipe?.result).toBe('BoiledKuratkoEgg')

    const base = makeInitialState(content)
    const eggId = 'i_egg' as ItemId
    const bagId = 'i_bag' as ItemId
    let state: GameState = {
      ...base,
      nowMs: 7_000_000,
      party: {
        ...base.party,
        inventory: { cols: 10, rows: 2, slots: Array.from({ length: 20 }, () => null) },
        items: {
          [eggId]: { id: eggId, defId: 'KuratkoEgg', qty: 1 },
          [bagId]: { id: bagId, defId: 'WaterbagFull', qty: 1 },
        },
      },
      ui: { ...base.ui, crafting: undefined },
    }
    state.party.inventory.slots[0] = eggId
    state.party.inventory.slots[1] = bagId

    state = startCrafting(state, eggId, bagId, { ...recipe!, craftMs: 0, dc: 1, failDestroyChancePct: 0 })
    const c = state.ui.crafting!
    state = { ...state, nowMs: c.endsAtMs + 1 }

    const next = maybeFinishCrafting(state)
    expect(next.party.items[eggId]).toBeUndefined()
    expect(next.party.items[bagId]).toBeUndefined()
    expect(Object.values(next.party.items).some((it) => it.defId === 'BoiledKuratkoEgg')).toBe(true)
    expect(Object.values(next.party.items).some((it) => it.defId === 'WaterbagEmpty')).toBe(true)
    expect(Object.values(next.party.items).some((it) => it.defId === 'WaterbagFull')).toBe(false)
  })
})
