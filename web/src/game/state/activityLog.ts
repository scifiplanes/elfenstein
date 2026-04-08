import type { GameState } from '../types'

export const ACTIVITY_LOG_MAX_ENTRIES = 100
/** Entries older than this (by `atMs` vs `state.nowMs`) are removed each `time/tick` (except on the death screen). */
export const ACTIVITY_LOG_ENTRY_TTL_MS = 10_000

export function pruneExpiredActivityLog(state: GameState): GameState {
  if (state.ui.death) return state
  const log = state.ui.activityLog
  if (!log?.length) return state
  const cutoff = state.nowMs - ACTIVITY_LOG_ENTRY_TTL_MS
  const next = log.filter((e) => e.atMs >= cutoff)
  if (next.length === log.length) return state
  return { ...state, ui: { ...state.ui, activityLog: next } }
}

export function pushActivityLog(state: GameState, text: string): GameState {
  const id = `l_${state.nowMs}_${(state.ui.activityLog?.length ?? 0)}_${Math.random().toString(36).slice(2, 8)}`
  const nextEntries = [...(state.ui.activityLog ?? []), { id, text, atMs: state.nowMs }].slice(-ACTIVITY_LOG_MAX_ENTRIES)
  return { ...state, ui: { ...state.ui, activityLog: nextEntries } }
}
