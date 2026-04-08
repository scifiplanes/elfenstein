import type { ItemDefId, NpcKind } from '../game/types'
import type { Rng } from './seededRng'
import type { FloorProperty, FloorType, GenRoom } from './types'

export type NpcSpawnContext = {
  floorType: FloorType
  /** Infested / Cursed / etc.; biases spawns without changing earlier procgen phases. */
  floorProperties: readonly FloorProperty[]
  room: GenRoom
  idx: number
  isNear: boolean
  /** Room center lies on a shortest entrance→exit path (pre-locks). */
  isOnEntranceExitShortestPath: boolean
  /** Counts of adjacent rooms by function (for cluster-aware spawns). */
  neighborRoomFunctions?: Partial<Record<'Passage' | 'Habitat' | 'Workshop' | 'Communal' | 'Storage', number>>
  /** Connected-component id for rooms sharing the same `roomFunction` (optional). */
  functionClusterId?: number
}

export type ItemSpawnContext = {
  floorProperties: readonly FloorProperty[]
  room: GenRoom
  isOnEntranceExitShortestPath: boolean
  neighborRoomFunctions?: Partial<Record<'Passage' | 'Habitat' | 'Workshop' | 'Communal' | 'Storage', number>>
  functionClusterId?: number
}

function pickWeighted<T extends string>(rng: Pick<Rng, 'next'>, entries: Array<{ id: T; w: number }>): T {
  const active = entries.filter((e) => e.w > 0)
  if (active.length === 0) return entries[0]!.id
  if (active.length === 1) return active[0]!.id
  const total = active.reduce((s, e) => s + e.w, 0)
  let r = rng.next() * total
  for (const e of active) {
    r -= e.w
    if (r <= 0) return e.id
  }
  return active[active.length - 1]!.id
}

const ITEM_BY_ROOM_FUNCTION: Partial<
  Record<'Passage' | 'Habitat' | 'Workshop' | 'Communal' | 'Storage', ItemDefId>
> = {
  Habitat: 'Mushrooms',
  Workshop: 'Ash',
  Storage: 'Stone',
  Communal: 'Foodroot',
}

/**
 * Default NPC when room tags do not force a kind. Single-entry floors consume no RNG (matches legacy procgen).
 * Add weights per floor type to bias spawns without changing other phases’ RNG streams.
 */
export const NPC_DEFAULT_WEIGHTS_BY_FLOOR: Record<FloorType, Array<{ id: NpcKind; w: number }>> = {
  Dungeon: [{ id: 'Wurglepup', w: 1 }],
  Cave: [{ id: 'Wurglepup', w: 1 }],
  Ruins: [{ id: 'Wurglepup', w: 1 }],
}

/**
 * Deterministic NPC kind from floor type, room tags, and district (same RNG sequence as prior `population.ts`).
 */
export function pickNpcKindFromTable(ctx: NpcSpawnContext, rng: Rng): NpcKind {
  const func = ctx.room.tags?.roomFunction
  const prop = ctx.room.tags?.roomProperties
  const status = ctx.room.tags?.roomStatus
  const distTag = ctx.room.district
  const fp = ctx.floorProperties
  const neigh = ctx.neighborRoomFunctions

  if (prop === 'Infected') return 'Skeleton'
  if (func === 'Workshop') return 'Catoctopus'
  if (func === 'Storage') return 'Bobr'

  let kind = pickWeighted(rng, NPC_DEFAULT_WEIGHTS_BY_FLOOR[ctx.floorType])
  if (func === 'Habitat' && (neigh?.Habitat ?? 0) >= 2 && kind === 'Wurglepup' && rng.next() < 0.28) kind = 'Bobr'
  if (func === 'Passage' && (neigh?.Passage ?? 0) >= 2 && kind === 'Wurglepup' && rng.next() < 0.22) kind = 'Catoctopus'
  if (distTag === 'Ruin' && rng.next() < 0.35) kind = 'Skeleton'
  if (distTag === 'Core' && kind === 'Wurglepup' && rng.next() < 0.25) kind = 'Catoctopus'

  if (status === 'Destroyed' && kind === 'Wurglepup' && rng.next() < 0.4) kind = 'Skeleton'
  if (fp.includes('Infested') && kind === 'Wurglepup' && rng.next() < 0.45) kind = 'Skeleton'
  if (fp.includes('Cursed') && prop === 'Flooded' && kind === 'Bobr' && rng.next() < 0.3) kind = 'Catoctopus'
  if (ctx.isOnEntranceExitShortestPath && kind === 'Wurglepup' && rng.next() < 0.18) kind = 'Bobr'

  return kind
}

/** Deterministic floor item def from room tags and district. */
export function pickFloorItemDefFromTable(ctx: ItemSpawnContext, rng: Rng): ItemDefId {
  const func = ctx.room.tags?.roomFunction
  const status = ctx.room.tags?.roomStatus
  const fp = ctx.floorProperties
  const neigh = ctx.neighborRoomFunctions

  if (status === 'Overgrown' && func === 'Habitat') return 'Mushrooms'
  if (fp.includes('Destroyed') && func === 'Storage') return 'Stone'

  let defId = (func && ITEM_BY_ROOM_FUNCTION[func]) || (rng.next() < 0.5 ? 'Stick' : 'Stone')
  if (func === 'Workshop' && (neigh?.Workshop ?? 0) >= 1 && rng.next() < 0.35) defId = 'Ash'
  if (ctx.room.district === 'EastWing' && rng.next() < 0.3) defId = 'Sulfur'
  if (fp.includes('Overgrown') && func === 'Communal' && rng.next() < 0.35) defId = 'Foodroot'
  if (ctx.isOnEntranceExitShortestPath && rng.next() < 0.22) defId = rng.next() < 0.5 ? 'Stick' : 'Ash'
  return defId
}
