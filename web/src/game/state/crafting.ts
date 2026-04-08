import type { GameState, ItemId } from '../types'
import type { RecipeDef } from '../content/recipes'
import { recipeKey } from '../content/recipes'
import { consumeItem } from './inventory'
import { pushActivityLog } from './activityLog'
import { makeDropJitter } from './dropJitter'

export function startCrafting(
  state: GameState,
  srcItemId: ItemId,
  dstItemId: ItemId,
  recipe: RecipeDef,
  opts?: { dstSlotIndex?: number },
): GameState {
  if (state.ui.crafting) return state
  const startedAtMs = state.nowMs
  return pushActivityLog(
    {
      ...state,
      ui: {
        ...state.ui,
        crafting: {
          startedAtMs,
          endsAtMs: startedAtMs + recipe.craftMs,
          srcItemId,
          dstItemId,
          dstSlotIndex: opts?.dstSlotIndex,
          resultDefId: recipe.result,
          aDefId: recipe.a,
          bDefId: recipe.b,
          failDestroyChancePct: recipe.failDestroyChancePct,
          recipeKey: recipeKey(recipe.a, recipe.b),
          skill: recipe.skill,
          dc: recipe.dc,
        },
      },
    },
    'Crafting…',
  )
}

export function maybeFinishCrafting(state: GameState): GameState {
  const c = state.ui.crafting
  if (!c) return state
  if (state.nowMs < c.endsAtMs) return state

  const src = state.party.items[c.srcItemId]
  const dst = state.party.items[c.dstItemId]
  if (!src || !dst) {
    return pushActivityLog({ ...state, ui: { ...state.ui, crafting: undefined } }, 'Craft canceled.')
  }

  const bestSkill = state.party.chars.reduce((best, ch) => Math.max(best, Number(ch.skills?.[c.skill] ?? 0)), 0)

  // Deterministic roll derived from floor seed + stable ids + recipe params (multiplayer-sane direction).
  const seed = hashStr(`${state.floor.seed}:craft:${c.srcItemId}:${c.dstItemId}:${c.resultDefId}:${c.skill}:${c.dc}`)
  const d20 = (seed % 20) + 1 // 1..20
  const total = d20 + bestSkill
  const success = total >= c.dc

  let next: GameState = { ...state, ui: { ...state.ui, crafting: undefined } }

  if (!success) {
    // Failure: chance to destroy one involved item (as brief).
    const destroySeed = hashStr(`${state.floor.seed}:craftDestroy:${c.srcItemId}:${c.dstItemId}:${c.resultDefId}:${c.skill}:${c.dc}`)
    const destroyRoll = (destroySeed % 100) + 1
    const destroy = destroyRoll <= c.failDestroyChancePct
    if (destroy) {
      const destroySrc = ((destroySeed >>> 8) & 1) === 0
      next = consumeItem(next, destroySrc ? c.srcItemId : c.dstItemId)
      const q = next.ui.sfxQueue ?? []
      return pushActivityLog(
        {
          ...next,
          ui: {
            ...next.ui,
            sfxQueue: q.concat([{ id: `s_${state.nowMs}_${q.length}`, kind: 'reject' }]),
            shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 180, magnitude: 0.35 },
          },
        },
        'Craft failed. Something broke.',
      )
    }
    const q = next.ui.sfxQueue ?? []
    return pushActivityLog(
      {
        ...next,
        ui: {
          ...next.ui,
          sfxQueue: q.concat([{ id: `s_${state.nowMs}_${q.length}`, kind: 'reject' }]),
        },
      },
      'Craft failed.',
    )
  }

  // Success: consume both and mint result item into an inventory slot.
  next = consumeItem(next, c.srcItemId)
  next = consumeItem(next, c.dstItemId)

  const wasKnown = Boolean(state.ui.knownRecipes?.[c.recipeKey])
  const knownRecipes = { ...(next.ui.knownRecipes ?? {}), [c.recipeKey]: true as const }
  next = { ...next, ui: { ...next.ui, knownRecipes } }

  const newId = (`i_${c.resultDefId}_${state.floor.seed}_${(seed >>> 0).toString(16)}` as unknown) as ItemId
  const items = { ...next.party.items, [newId]: { id: newId, defId: c.resultDefId, qty: 1 } }
  const inv = next.party.inventory
  const free = inv.slots.findIndex((s) => s == null)
  const nextSlots = inv.slots.slice()
  if (free >= 0) {
    nextSlots[free] = newId
  } else {
    const jitter = makeDropJitter({
      floorSeed: next.floor.seed,
      itemId: newId,
      nonce: Math.floor(next.nowMs),
      radius: next.render.dropJitterRadius ?? 0.28,
    })
    const itemsOnFloor = next.floor.itemsOnFloor.concat([{ id: newId, pos: { ...next.floor.playerPos }, jitter }])
    next = { ...next, floor: { ...next.floor, itemsOnFloor, floorGeomRevision: next.floor.floorGeomRevision + 1 } }
  }

  const withItems: GameState = {
    ...next,
    party: { ...next.party, items, inventory: { ...inv, slots: nextSlots } },
    ui: {
      ...next.ui,
      sfxQueue: (next.ui.sfxQueue ?? []).concat([{ id: `s_${state.nowMs}_${(next.ui.sfxQueue ?? []).length}`, kind: 'pickup' }]),
    },
  }

  const withDiscovery = wasKnown ? withItems : pushActivityLog(withItems, `Discovered: ${c.aDefId} + ${c.bDefId} → ${c.resultDefId}.`)
  return pushActivityLog(withDiscovery, `Crafted ${c.resultDefId}.`)
}

function hashStr(s: string) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

