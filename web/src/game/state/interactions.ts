import type { GameState, ItemId } from '../types'
import { consumeItem } from './inventory'
import { removeStatus } from './status'

export function inspectCharacter(state: GameState, characterId: string, itemId: ItemId): GameState {
  const item = state.party.items[itemId]
  if (!item) return state
  const c = state.party.chars.find((x) => x.id === characterId)
  if (!c) return state
  const tunedMs = Math.max(0, (state.render.portraitShakeLengthMs ?? 0) + (state.render.portraitShakeDecayMs ?? 0))
  const durMs = Math.max(130, tunedMs)
  return {
    ...state,
    ui: {
      ...state.ui,
      toast: { id: `t_${state.nowMs}`, text: `${c.name} inspects ${item.defId}.`, untilMs: state.nowMs + 1400 },
      portraitShake: { characterId, startedAtMs: state.nowMs, untilMs: state.nowMs + durMs, magnitude: 0.14 },
    },
  }
}

export function feedCharacter(state: GameState, characterId: string, itemId: ItemId): GameState {
  const item = state.party.items[itemId]
  if (!item) return state
  const cIdx = state.party.chars.findIndex((x) => x.id === characterId)
  if (cIdx < 0) return state

  const tunedMs = Math.max(0, (state.render.portraitShakeLengthMs ?? 0) + (state.render.portraitShakeDecayMs ?? 0))
  const durMs = Math.max(200, tunedMs)
  const hz = Math.max(0, Number(state.render.portraitMouthFlickerHz ?? 0))
  // Amount is interpreted as number of visible “chomps” (mouth-on pulses), not raw on/off toggles.
  const amount = Math.max(0, Math.round(Number(state.render.portraitMouthFlickerAmount ?? 0)))
  const steps = amount * 2
  const computedBurstMs = hz > 0 && steps > 0 ? Math.round((steps * 1000) / hz) : 0
  // The HUD is captured to a texture asynchronously; very short bursts can end before multiple captures land.
  // Keep a minimum window so flicker is actually visible.
  // Keep a minimum window so flicker is actually visible (capture-to-texture is async).
  const burstMs = Math.max(650, Math.min(8000, computedBurstMs || 650))
  const withMouth: GameState = {
    ...state,
    ui: {
      ...state.ui,
      portraitMouth: { characterId, startedAtMs: state.nowMs, untilMs: state.nowMs + burstMs },
      portraitShake: { characterId, startedAtMs: state.nowMs, untilMs: state.nowMs + durMs, magnitude: 0.2 },
      sfxQueue: (state.ui.sfxQueue ?? []).concat([{ id: `s_${state.nowMs}_${(state.ui.sfxQueue ?? []).length}`, kind: 'ui' }]),
    },
  }

  // The UI will surface the “mouth” affordance even for non-food; we handle rejection here.
  // We don’t have direct access to ContentDB inside state; implement minimal hardcoded mappings for MVP.
  const isDrink = item.defId === 'WaterbagFull'
  const isFood = item.defId === 'Mushrooms' || item.defId === 'Foodroot' || isDrink || isRemedy(item.defId)
  if (!isFood) {
    return {
      ...withMouth,
      ui: { ...withMouth.ui, toast: { id: `t_${state.nowMs}`, text: `They refuse to eat that.`, untilMs: state.nowMs + 1400 } },
    }
  }

  const chars = state.party.chars.slice()
  const c = chars[cIdx]

  const hungerDelta = item.defId === 'Mushrooms' ? 18 : item.defId === 'Foodroot' ? 24 : 0
  const thirstDelta = item.defId === 'WaterbagFull' ? 30 : 0
  const hpDelta = item.defId === 'Foodroot' ? 10 : item.defId === 'Mushrooms' ? 4 : 0
  const staminaDelta = item.defId === 'Mushrooms' || item.defId === 'Foodroot' ? 6 : 0

  const next = {
    ...c,
    hunger: Math.min(100, c.hunger + hungerDelta),
    thirst: Math.min(100, c.thirst + thirstDelta),
    hp: Math.min(100, c.hp + hpDelta),
    stamina: Math.min(100, c.stamina + staminaDelta),
  }
  chars[cIdx] = next

  let nextState: GameState = { ...withMouth, party: { ...state.party, chars } }

  // Tiny deterministic “chance” based on time seed (good enough for MVP feel).
  const roll = (Math.floor(state.nowMs) % 100) / 100
  if (item.defId === 'Mushrooms') {
    if (next.species === 'Mycyclops' && roll < 0.04) {
      nextState = addStatus(nextState, characterId, 'Blessed')
    } else if (roll < 0.06) {
      nextState = addStatus(nextState, characterId, 'Sick')
    }
  }

  // Remedies (proposals)
  if (item.defId === 'BandageStrip') {
    nextState = removeStatus(nextState, characterId, 'Bleeding')
  }
  if (item.defId === 'AntitoxinVial') {
    nextState = removeStatus(nextState, characterId, 'Poisoned')
  }
  if (item.defId === 'HerbPoultice') {
    nextState = removeStatus(nextState, characterId, 'Sick')
    // Small chance to apply Drowsy.
    const roll2 = (Math.floor(state.nowMs / 7) % 100) / 100
    if (roll2 < 0.12) nextState = addStatus(nextState, characterId, 'Drowsy')
  }

  nextState = consumeItem(nextState, itemId)
  const q = nextState.ui.sfxQueue ?? []
  const withSfx: GameState = { ...nextState, ui: { ...nextState.ui, sfxQueue: q.concat([{ id: `s_${state.nowMs}_${q.length}`, kind: 'munch' }]) } }
  return { ...withSfx, ui: { ...withSfx.ui, toast: { id: `t_${state.nowMs}`, text: `${c.name} eats.`, untilMs: state.nowMs + 1000 } } }
}

function addStatus(state: GameState, characterId: string, status: any): GameState {
  const idx = state.party.chars.findIndex((c) => c.id === characterId)
  if (idx < 0) return state
  const chars = state.party.chars.slice()
  const c = chars[idx]
  const untilMs =
    status === 'Blessed' ? state.nowMs + 45_000
    : status === 'Drowsy' ? state.nowMs + 18_000
    : state.nowMs + 30_000
  chars[idx] = { ...c, statuses: c.statuses.concat([{ id: status, untilMs }]) }
  return { ...state, party: { ...state.party, chars } }
}

function isRemedy(defId: string) {
  return defId === 'BandageStrip' || defId === 'AntitoxinVial' || defId === 'HerbPoultice'
}

