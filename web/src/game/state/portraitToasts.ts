import type { CharacterId, GameState, Id, PortraitToastKind } from '../types'

/** Max rows kept in `ui.portraitToasts` and shown per character in `PortraitPanel` (after filter). */
export const PORTRAIT_TOAST_QUEUE_CAP = 24

export function pushPortraitToast(
  state: GameState,
  args: { characterId: CharacterId; kind: PortraitToastKind; text: string; ttlMs?: number },
): GameState {
  const ttlMs = args.ttlMs ?? Math.max(400, Math.round(Number(state.render.portraitToastTtlMs ?? 1600)))
  const id = `pt_${state.nowMs}_${Math.random().toString(36).slice(2, 9)}` as Id
  const startedAtMs = state.nowMs
  const untilMs = state.nowMs + ttlMs
  const cur = state.ui.portraitToasts ?? []
  const row = { id, characterId: args.characterId, kind: args.kind, text: args.text, startedAtMs, untilMs }
  const merged = cur.filter((t) => t.untilMs > state.nowMs).concat([row])
  const next = merged.length > PORTRAIT_TOAST_QUEUE_CAP ? merged.slice(-PORTRAIT_TOAST_QUEUE_CAP) : merged
  return { ...state, ui: { ...state.ui, portraitToasts: next } }
}

export function prunePortraitToasts(state: GameState, nowMs: number): GameState {
  const cur = state.ui.portraitToasts
  if (!cur?.length) return state
  const next = cur.filter((t) => t.untilMs > nowMs)
  if (next.length === cur.length) return state
  return { ...state, ui: { ...state.ui, portraitToasts: next.length ? next : undefined } }
}
