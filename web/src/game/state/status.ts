import type { GameState } from '../types'

export function applyStatusDecay(state: GameState): GameState {
  const nowMs = state.nowMs
  let changed = false

  const chars = state.party.chars.map((c) => {
    const nextStatuses = c.statuses.filter((s) => (s.untilMs == null ? true : s.untilMs > nowMs))
    if (nextStatuses.length !== c.statuses.length) changed = true
    return nextStatuses === c.statuses ? c : { ...c, statuses: nextStatuses }
  })

  if (!changed) return state
  return { ...state, party: { ...state.party, chars } }
}

export function removeStatus(state: GameState, characterId: string, statusId: string): GameState {
  const idx = state.party.chars.findIndex((c) => c.id === characterId)
  if (idx < 0) return state
  const chars = state.party.chars.slice()
  const c = chars[idx]
  const nextStatuses = c.statuses.filter((s) => s.id !== (statusId as any))
  if (nextStatuses.length === c.statuses.length) return state
  chars[idx] = { ...c, statuses: nextStatuses }
  return { ...state, party: { ...state.party, chars } }
}

export function addStatus(state: GameState, characterId: string, statusId: string, untilMs?: number): GameState {
  const idx = state.party.chars.findIndex((c) => c.id === characterId)
  if (idx < 0) return state
  const chars = state.party.chars.slice()
  const c = chars[idx]
  chars[idx] = { ...c, statuses: c.statuses.concat([{ id: statusId as any, untilMs }]) }
  return { ...state, party: { ...state.party, chars } }
}

