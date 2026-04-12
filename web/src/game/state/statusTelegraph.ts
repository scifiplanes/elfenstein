import { DEFAULT_STATUSES } from '../content/statuses'
import type { GameState, StatusEffectId } from '../types'
import { addStatus, removeStatus } from './status'
import { pushPortraitToast } from './portraitToasts'

function statusLabel(id: StatusEffectId): string {
  return DEFAULT_STATUSES.find((s) => s.id === id)?.name ?? id
}

export function addStatusWithPortraitToast(
  state: GameState,
  characterId: string,
  statusId: StatusEffectId,
  absoluteUntilMs?: number,
): GameState {
  const until =
    absoluteUntilMs ??
    (statusId === 'Blessed' ? state.nowMs + 45_000
    : statusId === 'Drowsy' ? state.nowMs + 18_000
    : state.nowMs + 30_000)
  const next = addStatus(state, characterId, statusId, until)
  if (next === state) return state
  return pushPortraitToast(next, {
    characterId,
    kind: 'status',
    text: `+${statusLabel(statusId)}`,
  })
}

export function removeStatusWithPortraitToast(state: GameState, characterId: string, statusId: StatusEffectId): GameState {
  const next = removeStatus(state, characterId, statusId)
  if (next === state) return state
  return pushPortraitToast(next, {
    characterId,
    kind: 'status',
    text: `−${statusLabel(statusId)}`,
  })
}
