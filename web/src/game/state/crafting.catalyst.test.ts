import { describe, expect, it } from 'vitest'
import { ContentDB } from '../content/contentDb'
import { findRecipe } from '../content/recipes'
import type { GameState, ItemId } from '../types'
import { makeInitialState } from './initialState'
import { maybeFinishCrafting, startCrafting } from './crafting'

const content = ContentDB.createDefault()

describe('crafting persistent catalyst (preserveA / preserveB)', () => {
  it('on success consumes only non-preserved slots (preserveB keeps dst)', () => {
    const base = makeInitialState(content)
    const stickId = 'i_stick' as ItemId
    const stoneId = 'i_stone' as ItemId
    let state: GameState = {
      ...base,
      nowMs: 1_000_000,
      party: {
        ...base.party,
        items: {
          ...base.party.items,
          [stickId]: { id: stickId, defId: 'Stick', qty: 1 },
          [stoneId]: { id: stoneId, defId: 'Stone', qty: 1 },
        },
      },
      ui: { ...base.ui, crafting: undefined },
    }
    state = startCrafting(state, stickId, stoneId, {
      a: 'Stick',
      b: 'Stone',
      result: 'Spear',
      craftMs: 0,
      failDestroyChancePct: 0,
      skill: 'chipping',
      dc: 1,
      preserveB: true,
    })
    const c = state.ui.crafting!
    state = { ...state, nowMs: c.endsAtMs + 1, party: { ...state.party, chars: state.party.chars.map((ch, i) => (i === 0 ? { ...ch, skills: { ...ch.skills, chipping: 10 } } : ch)) } }

    const next = maybeFinishCrafting(state)
    expect(next.party.items[stickId]).toBeUndefined()
    expect(next.party.items[stoneId]?.defId).toBe('Stone')
    const crafted = Object.values(next.party.items).find((it) => it.defId === 'Spear')
    expect(crafted).toBeDefined()
    expect(next.ui.crafting).toBeUndefined()
  })

  it('on failure destroy only targets a non-preserved slot when preserveB', () => {
    const base = makeInitialState(content)
    const stickId = 'i_stick' as ItemId
    const stoneId = 'i_stone' as ItemId
    let state: GameState = {
      ...base,
      nowMs: 2_000_000,
      floor: { ...base.floor, seed: 42 },
      party: {
        ...base.party,
        items: {
          ...base.party.items,
          [stickId]: { id: stickId, defId: 'Stick', qty: 1 },
          [stoneId]: { id: stoneId, defId: 'Stone', qty: 1 },
        },
      },
      ui: { ...base.ui, crafting: undefined },
    }
    state = startCrafting(state, stickId, stoneId, {
      a: 'Stick',
      b: 'Stone',
      result: 'Spear',
      craftMs: 0,
      failDestroyChancePct: 100,
      skill: 'chipping',
      dc: 99,
      preserveB: true,
    })
    const c = state.ui.crafting!
    state = { ...state, nowMs: c.endsAtMs + 1 }

    const next = maybeFinishCrafting(state)
    expect(next.party.items[stoneId]?.defId).toBe('Stone')
    expect(next.party.items[stickId]).toBeUndefined()
    const log = next.ui.activityLog?.map((e) => e.text).join(' | ')
    expect(log).toContain('Something broke')
  })

  it('content Stone+Chisel row preserves chisel on success (findRecipe)', () => {
    const recipe = findRecipe('Stone', 'Chisel')
    expect(recipe).not.toBeNull()
    expect(recipe!.preserveB).toBe(true)

    const base = makeInitialState(content)
    const stoneId = 'i_stone' as ItemId
    const chiselId = 'i_chisel' as ItemId
    let state: GameState = {
      ...base,
      nowMs: 3_000_000,
      party: {
        ...base.party,
        items: {
          ...base.party.items,
          [stoneId]: { id: stoneId, defId: 'Stone', qty: 1 },
          [chiselId]: { id: chiselId, defId: 'Chisel', qty: 1 },
        },
      },
      ui: { ...base.ui, crafting: undefined },
    }
    state = startCrafting(state, stoneId, chiselId, recipe!)
    const c = state.ui.crafting!
    state = { ...state, nowMs: c.endsAtMs + 1, party: { ...state.party, chars: state.party.chars.map((ch, i) => (i === 0 ? { ...ch, skills: { ...ch.skills, chipping: 10 } } : ch)) } }

    const next = maybeFinishCrafting(state)
    expect(next.party.items[chiselId]?.defId).toBe('Chisel')
    expect(next.party.items[stoneId]).toBeUndefined()
    expect(Object.values(next.party.items).some((it) => it.defId === 'StoneShard')).toBe(true)
  })
})

describe('spore garden order-sensitive findRecipe', () => {
  it('Salt + SporePaste → Mold (reverse of brining)', () => {
    const r = findRecipe('Salt', 'SporePaste')
    expect(r?.result).toBe('Mold')
  })
  it('Mold + Mushrooms → BitterHerb (Mushrooms + Mold stays SporePaste)', () => {
    expect(findRecipe('Mold', 'Mushrooms')?.result).toBe('BitterHerb')
    expect(findRecipe('Mushrooms', 'Mold')?.result).toBe('SporePaste')
  })
})

describe('Glowbug jar recipe', () => {
  it('GlassVial + Glowbug → GlowbugJar', () => {
    expect(findRecipe('GlassVial', 'Glowbug')?.result).toBe('GlowbugJar')
  })
  it('Glowbug + GlowbugJar and reverse both enrich the jar recipe', () => {
    expect(findRecipe('Glowbug', 'GlowbugJar')?.result).toBe('GlowbugJar')
    expect(findRecipe('GlowbugJar', 'Glowbug')?.result).toBe('GlowbugJar')
  })

  it('GlassVial + Glowbug mints GlowbugJar with glowbugs 1', () => {
    const base = makeInitialState(content)
    const vialId = 'i_vial_gb' as ItemId
    const bugId = 'i_bug_gb' as ItemId
    const slots = base.party.inventory.slots.slice()
    slots[0] = vialId
    slots[1] = bugId
    let state: GameState = {
      ...base,
      nowMs: 8_000_000,
      floor: { ...base.floor, seed: 77 },
      party: {
        ...base.party,
        chars: base.party.chars.map((ch, i) => (i === 0 ? { ...ch, skills: { ...ch.skills, weaving: 10 } } : ch)),
        items: {
          ...base.party.items,
          [vialId]: { id: vialId, defId: 'GlassVial', qty: 1 },
          [bugId]: { id: bugId, defId: 'Glowbug', qty: 1 },
        },
        inventory: { ...base.party.inventory, slots },
      },
      ui: { ...base.ui, crafting: undefined },
    }
    const recipe = findRecipe('GlassVial', 'Glowbug')!
    state = startCrafting(state, vialId, bugId, { ...recipe, craftMs: 0, dc: 1, failDestroyChancePct: 0 })
    const c = state.ui.crafting!
    state = { ...state, nowMs: c.endsAtMs + 1 }
    const next = maybeFinishCrafting(state)
    const jar = Object.values(next.party.items).find((it) => it.defId === 'GlowbugJar')
    expect(jar?.glowbugs).toBe(1)
  })

  it('Glowbug + GlowbugJar consumes bug and increments glowbugs on same jar id', () => {
    const base = makeInitialState(content)
    const jarId = 'i_jar_gb' as ItemId
    const bugId = 'i_bug_gb2' as ItemId
    const slots = base.party.inventory.slots.slice()
    slots[0] = bugId
    slots[1] = jarId
    let state: GameState = {
      ...base,
      nowMs: 8_100_000,
      floor: { ...base.floor, seed: 78 },
      party: {
        ...base.party,
        chars: base.party.chars.map((ch, i) => (i === 0 ? { ...ch, skills: { ...ch.skills, weaving: 10 } } : ch)),
        items: {
          ...base.party.items,
          [jarId]: { id: jarId, defId: 'GlowbugJar', qty: 1, glowbugs: 2 },
          [bugId]: { id: bugId, defId: 'Glowbug', qty: 1 },
        },
        inventory: { ...base.party.inventory, slots },
      },
      ui: { ...base.ui, crafting: undefined },
    }
    const recipe = findRecipe('Glowbug', 'GlowbugJar')!
    state = startCrafting(state, bugId, jarId, { ...recipe, craftMs: 0, dc: 1, failDestroyChancePct: 0 })
    const c = state.ui.crafting!
    state = { ...state, nowMs: c.endsAtMs + 1 }
    const next = maybeFinishCrafting(state)
    expect(next.party.items[jarId]?.glowbugs).toBe(3)
    expect(next.party.items[bugId]).toBeUndefined()
  })
})

describe('Snailing recipes', () => {
  it('Snailing + Chisel → SnailingShell', () => {
    expect(findRecipe('Snailing', 'Chisel')?.result).toBe('SnailingShell')
  })
  it('Snailing + Salt → PickledSnailing', () => {
    expect(findRecipe('Snailing', 'Salt')?.result).toBe('PickledSnailing')
  })
  it('Snailing + Moss → PickledSnailing', () => {
    expect(findRecipe('Snailing', 'Moss')?.result).toBe('PickledSnailing')
  })
  it('Snailing + Slime → SnailSlimePaste', () => {
    expect(findRecipe('Snailing', 'Slime')?.result).toBe('SnailSlimePaste')
  })
  it('SnailingShell + StoneShard → ShellSpike', () => {
    expect(findRecipe('SnailingShell', 'StoneShard')?.result).toBe('ShellSpike')
  })
  it('SnailingShell + Twine → ShellCharm', () => {
    expect(findRecipe('SnailingShell', 'Twine')?.result).toBe('ShellCharm')
  })
})
