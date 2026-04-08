import type { GameState } from '../types'

export const ACTIVITY_LOG_MAX_ENTRIES = 100

export function pushActivityLog(state: GameState, text: string): GameState {
  const id = `l_${state.nowMs}_${(state.ui.activityLog?.length ?? 0)}_${Math.random().toString(36).slice(2, 8)}`
  const nextEntries = [...(state.ui.activityLog ?? []), { id, text, atMs: state.nowMs }].slice(-ACTIVITY_LOG_MAX_ENTRIES)
  return { ...state, ui: { ...state.ui, activityLog: nextEntries } }
}
