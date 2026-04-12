import { DEFAULT_STATUSES } from '../content/statuses'
import type { GameState, StatusEffectId } from '../types'
import { pushPortraitToast } from './portraitToasts'

function statusToastLabel(id: StatusEffectId): string {
  return DEFAULT_STATUSES.find((s) => s.id === id)?.name ?? id
}

export function applyStatusDecay(state: GameState): GameState {
  const nowMs = state.nowMs
  let charsChanged = false
  let nextState = state

  const chars = state.party.chars.map((c) => {
    const dropped = c.statuses.filter((s) => s.untilMs != null && s.untilMs <= nowMs)
    const nextStatuses = c.statuses.filter((s) => (s.untilMs == null ? true : s.untilMs > nowMs))
    if (nextStatuses.length !== c.statuses.length) charsChanged = true
    if (dropped.length && c.hp > 0) {
      for (const s of dropped) {
        nextState = pushPortraitToast(nextState, {
          characterId: c.id,
          kind: 'status',
          text: `−${statusToastLabel(s.id)}`,
        })
      }
    }
    return nextStatuses === c.statuses ? c : { ...c, statuses: nextStatuses }
  })

  let npcsChanged = false
  const npcs = state.floor.npcs.map((n) => {
    const cur = n.statuses ?? []
    const nextStatuses = cur.filter((s) => (s.untilMs == null ? true : s.untilMs > nowMs))
    if (nextStatuses.length !== cur.length) npcsChanged = true
    return nextStatuses.length === cur.length ? n : { ...n, statuses: nextStatuses }
  })

  if (!charsChanged && !npcsChanged) return nextState
  return {
    ...nextState,
    party: charsChanged ? { ...nextState.party, chars } : nextState.party,
    floor: npcsChanged ? { ...nextState.floor, npcs, floorGeomRevision: nextState.floor.floorGeomRevision + 1 } : nextState.floor,
  }
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

export function addStatusToNpc(state: GameState, npcId: string, statusId: string, untilMs?: number): GameState {
  const idx = state.floor.npcs.findIndex((n) => n.id === npcId)
  if (idx < 0) return state
  const npcs = state.floor.npcs.slice()
  const n = npcs[idx]
  const cur = n.statuses ?? []
  npcs[idx] = { ...n, statuses: cur.concat([{ id: statusId as any, untilMs }]) }
  return { ...state, floor: { ...state.floor, npcs, floorGeomRevision: state.floor.floorGeomRevision + 1 } }
}

