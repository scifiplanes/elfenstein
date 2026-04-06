import type { GameState, ItemDefId, ItemId } from '../types'
import { consumeItem } from './inventory'

export type Recipe = {
  a: ItemDefId
  b: ItemDefId
  result: ItemDefId
  craftMs: number
  failDestroyChancePct: number
}

export const RECIPES: Recipe[] = [
  // Minimal starting example (extend later).
  { a: 'Stick', b: 'Stone', result: 'Spear', craftMs: 1800, failDestroyChancePct: 25 },
  { a: 'Ash', b: 'Sulfur', result: 'Firebolt', craftMs: 1200, failDestroyChancePct: 20 },
  { a: 'Sulfur', b: 'Ash', result: 'Fireshield', craftMs: 1200, failDestroyChancePct: 20 },
]

export function findRecipe(defA: ItemDefId, defB: ItemDefId): Recipe | null {
  for (const r of RECIPES) {
    // Recipes are order-sensitive for some interactions, so we keep the list explicit.
    if (r.a === defA && r.b === defB) return r
  }
  return null
}

export function startCrafting(state: GameState, srcItemId: ItemId, dstItemId: ItemId, recipe: Recipe): GameState {
  if (state.ui.crafting) return state
  const startedAtMs = state.nowMs
  return {
    ...state,
    ui: {
      ...state.ui,
      crafting: {
        startedAtMs,
        endsAtMs: startedAtMs + recipe.craftMs,
        srcItemId,
        dstItemId,
        resultDefId: recipe.result,
        failDestroyChancePct: recipe.failDestroyChancePct,
      },
      toast: { id: `t_${state.nowMs}`, text: 'Crafting…', untilMs: state.nowMs + 700 },
    },
  }
}

export function maybeFinishCrafting(state: GameState): GameState {
  const c = state.ui.crafting
  if (!c) return state
  if (state.nowMs < c.endsAtMs) return state

  const src = state.party.items[c.srcItemId]
  const dst = state.party.items[c.dstItemId]
  if (!src || !dst) {
    return { ...state, ui: { ...state.ui, crafting: undefined, toast: { id: `t_${state.nowMs}`, text: 'Craft canceled.', untilMs: state.nowMs + 900 } } }
  }

  // Deterministic-ish roll using time + ids (replace with seeded RNG stream later).
  const seed = (Math.floor(state.nowMs) ^ hashStr(c.srcItemId) ^ (hashStr(c.dstItemId) * 31)) >>> 0
  const roll = (seed % 100) + 1 // 1..100
  const success = roll > 20 // MVP: 80% base success

  let next: GameState = { ...state, ui: { ...state.ui, crafting: undefined } }

  if (!success) {
    // Failure: chance to destroy one involved item (as brief).
    const destroyRoll = ((seed >>> 8) % 100) + 1
    const destroy = destroyRoll <= c.failDestroyChancePct
    if (destroy) {
      const destroySrc = ((seed >>> 16) & 1) === 0
      next = consumeItem(next, destroySrc ? c.srcItemId : c.dstItemId)
      const q = next.ui.sfxQueue ?? []
      return {
        ...next,
        ui: {
          ...next.ui,
          toast: { id: `t_${state.nowMs}`, text: 'Craft failed. Something broke.', untilMs: state.nowMs + 1200 },
          sfxQueue: q.concat([{ id: `s_${state.nowMs}_${q.length}`, kind: 'reject' }]),
          shake: { untilMs: state.nowMs + 180, magnitude: 0.35 },
        },
      }
    }
    const q = next.ui.sfxQueue ?? []
    return {
      ...next,
      ui: {
        ...next.ui,
        toast: { id: `t_${state.nowMs}`, text: 'Craft failed.', untilMs: state.nowMs + 1000 },
        sfxQueue: q.concat([{ id: `s_${state.nowMs}_${q.length}`, kind: 'reject' }]),
      },
    }
  }

  // Success: consume both and mint result item into an inventory slot.
  next = consumeItem(next, c.srcItemId)
  next = consumeItem(next, c.dstItemId)

  const newId = `i_${c.resultDefId}_${Math.floor(state.nowMs)}` as ItemId
  const items = { ...next.party.items, [newId]: { id: newId, defId: c.resultDefId, qty: 1 } }
  const inv = next.party.inventory
  const free = inv.slots.findIndex((s) => s == null)
  const nextSlots = inv.slots.slice()
  if (free >= 0) nextSlots[free] = newId

  return {
    ...next,
    party: { ...next.party, items, inventory: { ...inv, slots: nextSlots } },
    ui: {
      ...next.ui,
      toast: { id: `t_${state.nowMs}`, text: `Crafted ${c.resultDefId}.`, untilMs: state.nowMs + 1200 },
      sfxQueue: (next.ui.sfxQueue ?? []).concat([{ id: `s_${state.nowMs}_${(next.ui.sfxQueue ?? []).length}`, kind: 'pickup' }]),
    },
  }
}

function hashStr(s: string) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

