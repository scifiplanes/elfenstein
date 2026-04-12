import type { GameState, ItemId } from '../types'
import { ContentDB } from '../content/contentDb'
import type { RecipeDef } from '../content/recipes'
import { FULL_WATER_VESSEL_TO_EMPTY, GLOWBUG_JAR_MAX_GLOWBUGS, recipeKey } from '../content/recipes'
import { inventoryItemFromDef } from './itemDurability'
import { consumeFeedLeavingEmpty, consumeItem } from './inventory'
import { pushActivityLog } from './activityLog'
import { applyXpWithActivityLog, xpForCraftSuccess } from './runProgression'
import { makeDropJitter } from './dropJitter'

const CRAFT_CONTENT = ContentDB.createDefault()

export function startCrafting(
  state: GameState,
  srcItemId: ItemId,
  dstItemId: ItemId,
  recipe: RecipeDef,
  opts?: { dstSlotIndex?: number },
): GameState {
  if (state.ui.crafting) return state
  const startedAtMs = state.nowMs
  const craftMs = Math.max(0, Math.round(recipe.craftMs * Number(state.render.craftDurationScale ?? 1)))
  return pushActivityLog(
    {
      ...state,
      ui: {
        ...state.ui,
        crafting: {
          startedAtMs,
          endsAtMs: startedAtMs + craftMs,
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
          preserveA: recipe.preserveA === true,
          preserveB: recipe.preserveB === true,
        },
      },
    },
    'Crafting…',
  )
}

export function maybeFinishCrafting(state: GameState): GameState {
  const c = state.ui.crafting
  if (!c) return state
  if (state.combat) return state
  if (state.nowMs < c.endsAtMs) return state

  const src = state.party.items[c.srcItemId]
  const dst = state.party.items[c.dstItemId]
  if (!src || !dst) {
    return pushActivityLog({ ...state, ui: { ...state.ui, crafting: undefined } }, 'Craft canceled.')
  }

  const bestSkill = state.party.chars.reduce((best, ch) => Math.max(best, Number(ch.skills?.[c.skill] ?? 0)), 0)

  // Deterministic roll: same outcome for a given completed craft session; new `startedAtMs` each `startCrafting` so retries reroll.
  const seed = hashStr(
    `${state.floor.seed}:craft:${c.srcItemId}:${c.dstItemId}:${c.resultDefId}:${c.skill}:${c.dc}:${c.startedAtMs}`,
  )
  const d20 = (seed % 20) + 1 // 1..20
  const total = d20 + bestSkill
  const success = total >= c.dc

  const preserveA = c.preserveA === true
  const preserveB = c.preserveB === true

  let next: GameState = { ...state, ui: { ...state.ui, crafting: undefined } }

  if (!success) {
    // Failure: chance to destroy one involved item (as brief).
    const destroySeed = hashStr(
      `${state.floor.seed}:craftDestroy:${c.srcItemId}:${c.dstItemId}:${c.resultDefId}:${c.skill}:${c.dc}:${c.startedAtMs}`,
    )
    const destroyRoll = (destroySeed % 100) + 1
    const destroy = destroyRoll <= c.failDestroyChancePct
    if (destroy) {
      const candSrc = !preserveA ? c.srcItemId : null
      const candDst = !preserveB ? c.dstItemId : null
      const candidates = [candSrc, candDst].filter((x): x is ItemId => x != null)
      if (candidates.length === 1) {
        next = consumeItem(next, candidates[0]!)
      } else if (candidates.length === 2) {
        const destroySrc = ((destroySeed >>> 8) & 1) === 0
        next = consumeItem(next, destroySrc ? candidates[0]! : candidates[1]!)
      }
      if (candidates.length > 0) {
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

  // Glowbug jar: add a glowbug to an existing jar (same itemId; do not mint a second jar).
  const enrichGlowbugJar =
    c.resultDefId === 'GlowbugJar' &&
    ((src.defId === 'GlowbugJar' && dst.defId === 'Glowbug') || (src.defId === 'Glowbug' && dst.defId === 'GlowbugJar'))
  if (enrichGlowbugJar) {
    const jarId = src.defId === 'GlowbugJar' ? c.srcItemId : c.dstItemId
    const bugId = src.defId === 'Glowbug' ? c.srcItemId : c.dstItemId
    let after = consumeItem(next, bugId)
    const jar = after.party.items[jarId]
    if (!jar || jar.defId !== 'GlowbugJar') {
      return pushActivityLog({ ...state, ui: { ...state.ui, crafting: undefined } }, 'Craft canceled.')
    }
    const nextGlow = Math.min(GLOWBUG_JAR_MAX_GLOWBUGS, (jar.glowbugs ?? 1) + 1)
    after = {
      ...after,
      party: {
        ...after.party,
        items: { ...after.party.items, [jarId]: { ...jar, glowbugs: nextGlow } },
      },
    }
    const wasKnownEnrich = Boolean(state.ui.knownRecipes?.[c.recipeKey])
    const knownRecipesEnrich = { ...(after.ui.knownRecipes ?? {}), [c.recipeKey]: true as const }
    after = { ...after, ui: { ...after.ui, knownRecipes: knownRecipesEnrich } }
    const withSfx: GameState = {
      ...after,
      ui: {
        ...after.ui,
        sfxQueue: (after.ui.sfxQueue ?? []).concat([{ id: `s_${state.nowMs}_${(after.ui.sfxQueue ?? []).length}`, kind: 'pickup' }]),
      },
    }
    const withDiscovery = wasKnownEnrich
      ? withSfx
      : pushActivityLog(withSfx, `Discovered: ${c.aDefId} + ${c.bDefId} → ${c.resultDefId}.`)
    const craftXpEnrich = xpForCraftSuccess(c.dc)
    return applyXpWithActivityLog(withDiscovery, craftXpEnrich, `Stowed a glowbug in the jar. (+${craftXpEnrich} XP)`)
  }

  // Success: consume non-preserved ingredients and mint result (full water vessels → matching empty, like feed).
  if (!preserveA) {
    const emptyA = FULL_WATER_VESSEL_TO_EMPTY[src.defId as keyof typeof FULL_WATER_VESSEL_TO_EMPTY]
    next = emptyA ? consumeFeedLeavingEmpty(next, c.srcItemId, emptyA) : consumeItem(next, c.srcItemId)
  }
  if (!preserveB) {
    const emptyB = FULL_WATER_VESSEL_TO_EMPTY[dst.defId as keyof typeof FULL_WATER_VESSEL_TO_EMPTY]
    next = emptyB ? consumeFeedLeavingEmpty(next, c.dstItemId, emptyB) : consumeItem(next, c.dstItemId)
  }

  const wasKnown = Boolean(state.ui.knownRecipes?.[c.recipeKey])
  const knownRecipes = { ...(next.ui.knownRecipes ?? {}), [c.recipeKey]: true as const }
  next = { ...next, ui: { ...next.ui, knownRecipes } }

  const newId = (`i_${c.resultDefId}_${state.floor.seed}_${(seed >>> 0).toString(16)}` as unknown) as ItemId
  const baseRow = inventoryItemFromDef(CRAFT_CONTENT, c.resultDefId, newId, 1)
  const newRow = c.resultDefId === 'GlowbugJar' ? { ...baseRow, glowbugs: 1 } : baseRow
  const items = { ...next.party.items, [newId]: newRow }
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
  const craftXp = xpForCraftSuccess(c.dc)
  return applyXpWithActivityLog(withDiscovery, craftXp, `Crafted ${c.resultDefId}. (+${craftXp} XP)`)
}

function hashStr(s: string) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

