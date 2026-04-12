import { DEFAULT_STATUSES } from '../content/statuses'
import type { Character, CharacterId, GameState, StatusEffectId } from '../types'
import { addStatus, removeStatus } from './status'
import { pushPortraitToast } from './portraitToasts'

/** Ignore multi-second tab background gaps so one tick does not dump whole vitals. */
const VITALS_DRAIN_DT_MS_CAP = 2000

export function characterHasActiveStatus(c: Character, state: GameState, id: StatusEffectId): boolean {
  return c.statuses.some((s) => s.id === id && (s.untilMs == null || s.untilMs > state.nowMs))
}

function statusLabel(id: StatusEffectId): string {
  return DEFAULT_STATUSES.find((s) => s.id === id)?.name ?? id
}

/**
 * Passive hunger/thirst drain while `ui.screen === 'game'`.
 * `prev.nowMs` is the previous tick time; `nextNowMs` is the new wall time.
 */
export function applyVitalsTimeDrain(prev: GameState, nextNowMs: number): GameState {
  if (prev.ui.screen !== 'game') return prev
  const hunR = Math.max(0, Number(prev.render.vitalsHungerDrainPerGameMin ?? 0))
  const thrR = Math.max(0, Number(prev.render.vitalsThirstDrainPerGameMin ?? 0))
  if (hunR <= 0 && thrR <= 0) return prev

  const dtRaw = Math.max(0, nextNowMs - prev.nowMs)
  const dtMs = Math.min(VITALS_DRAIN_DT_MS_CAP, dtRaw)
  if (dtMs <= 0) return prev

  const dhAcc = (hunR / 60_000) * dtMs
  const dtAcc = (thrR / 60_000) * dtMs

  const accMap: Partial<Record<CharacterId, { hunger: number; thirst: number }>> = {
    ...(prev.run.vitalsDrainAccByChar ?? {}),
  }

  const chars = prev.party.chars.map((c) => {
    if (c.hp <= 0) return c
    const cur = accMap[c.id] ?? { hunger: 0, thirst: 0 }
    let ha = cur.hunger + (hunR > 0 ? dhAcc : 0)
    let ta = cur.thirst + (thrR > 0 ? dtAcc : 0)
    let hunger = c.hunger
    let thirst = c.thirst
    while (hunR > 0 && hunger > 0 && ha >= 1) {
      ha -= 1
      hunger -= 1
    }
    while (thrR > 0 && thirst > 0 && ta >= 1) {
      ta -= 1
      thirst -= 1
    }
    accMap[c.id] = { hunger: ha, thirst: ta }
    if (hunger === c.hunger && thirst === c.thirst) return c
    return { ...c, hunger, thirst }
  })

  return {
    ...prev,
    party: { ...prev.party, chars },
    run: { ...prev.run, vitalsDrainAccByChar: accMap },
  }
}

/** Add/remove `Starving` / `Dehydrated` from vitals; permanent until fed (`untilMs` unset). Toast only on transitions. */
export function syncStarvationDehydrationStatuses(state: GameState): GameState {
  const ttl = Math.max(400, Math.round(Number(state.render.portraitToastTtlMs ?? 1600)))
  let next = state

  for (const id of next.party.chars.map((c) => c.id)) {
    let c = next.party.chars.find((x) => x.id === id)
    if (!c || c.hp <= 0) continue

    const hasStarving = characterHasActiveStatus(c, next, 'Starving')
    if (c.hunger <= 0 && !hasStarving) {
      next = addStatus(next, id, 'Starving', undefined)
      next = pushPortraitToast(next, {
        characterId: id,
        kind: 'status',
        text: `+${statusLabel('Starving')}`,
        ttlMs: ttl,
      })
    } else if (c.hunger > 0 && hasStarving) {
      next = removeStatus(next, id, 'Starving')
      next = pushPortraitToast(next, {
        characterId: id,
        kind: 'status',
        text: `−${statusLabel('Starving')}`,
        ttlMs: ttl,
      })
    }

    c = next.party.chars.find((x) => x.id === id)!
    const hasDehyd = characterHasActiveStatus(c, next, 'Dehydrated')
    if (c.thirst <= 0 && !hasDehyd) {
      next = addStatus(next, id, 'Dehydrated', undefined)
      next = pushPortraitToast(next, {
        characterId: id,
        kind: 'status',
        text: `+${statusLabel('Dehydrated')}`,
        ttlMs: ttl,
      })
    } else if (c.thirst > 0 && hasDehyd) {
      next = removeStatus(next, id, 'Dehydrated')
      next = pushPortraitToast(next, {
        characterId: id,
        kind: 'status',
        text: `−${statusLabel('Dehydrated')}`,
        ttlMs: ttl,
      })
    }
  }

  return next
}

/** Extra integer STA charged on a step pacing tick when starving/dehydrated (F2-tunable). */
export function staminaStepVitalsBumpForCharacter(state: GameState, c: Character): number {
  const r = state.render
  let b = 0
  if (characterHasActiveStatus(c, state, 'Starving')) {
    b += Math.max(0, Math.round(Number(r.vitalsDrainStaminaStepPenaltyStarving ?? 0)))
  }
  if (characterHasActiveStatus(c, state, 'Dehydrated')) {
    b += Math.max(0, Math.round(Number(r.vitalsDrainStaminaStepPenaltyDehydrated ?? 0)))
  }
  return Math.min(20, b)
}
