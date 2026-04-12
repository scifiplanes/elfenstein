import type { GameState } from '../types'
import { staminaRatio } from './partyStamina'
import { pushPortraitToast } from './portraitToasts'

const HUNGER_THIRST_CAP = 100

export function applyLowVitalPortraitWarnings(state: GameState): GameState {
  const r = state.render
  const cd = Math.max(0, r.lowVitalWarnCooldownMs)
  const cool = { ...(state.ui.vitalLowWarnUntil ?? {}) }
  let next = state

  for (const c of state.party.chars) {
    if (c.hp <= 0) continue
    const unblock = cool[c.id] ?? 0
    if (state.nowMs < unblock) continue

    const stFrac = staminaRatio(state, c.id)
    const huFrac = c.hunger / HUNGER_THIRST_CAP
    const thFrac = c.thirst / HUNGER_THIRST_CAP

    let text: string | null = null
    if (stFrac < r.lowStaminaWarnFrac) text = 'Tired'
    else if (huFrac < r.lowHungerWarnFrac) text = 'Hungry'
    else if (thFrac < r.lowThirstWarnFrac) text = 'Thirsty'

    if (!text) continue
    const ttl = Math.max(400, Math.round(Number(r.portraitToastTtlMs ?? 1600)))
    next = pushPortraitToast(next, { characterId: c.id, kind: 'lowStat', text, ttlMs: ttl })
    cool[c.id] = state.nowMs + cd
  }

  return { ...next, ui: { ...next.ui, vitalLowWarnUntil: cool } }
}
