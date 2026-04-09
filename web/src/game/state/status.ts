import type { GameState } from '../types'

export function applyStatusDecay(state: GameState): GameState {
  const nowMs = state.nowMs
  let charsChanged = false

  const chars = state.party.chars.map((c) => {
    const nextStatuses = c.statuses.filter((s) => (s.untilMs == null ? true : s.untilMs > nowMs))
    if (nextStatuses.length !== c.statuses.length) charsChanged = true
    return nextStatuses === c.statuses ? c : { ...c, statuses: nextStatuses }
  })

  let npcsChanged = false
  const npcs = state.floor.npcs.map((n) => {
    const cur = n.statuses ?? []
    const nextStatuses = cur.filter((s) => (s.untilMs == null ? true : s.untilMs > nowMs))
    if (nextStatuses.length !== cur.length) npcsChanged = true
    return nextStatuses.length === cur.length ? n : { ...n, statuses: nextStatuses }
  })

  if (!charsChanged && !npcsChanged) return state
  return {
    ...state,
    party: charsChanged ? { ...state.party, chars } : state.party,
    floor: npcsChanged ? { ...state.floor, npcs, floorGeomRevision: state.floor.floorGeomRevision + 1 } : state.floor,
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

