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
  Dungeon: [
    { id: 'Wurglepup', w: 4 },
    { id: 'Bobr', w: 2 },
    { id: 'Catoctopus', w: 2 },
    { id: 'Skeleton', w: 2 },
    { id: 'Chumbo', w: 1 },
    { id: 'Kuratko', w: 1 },
    { id: 'Bok', w: 1 },
    { id: 'BigHands', w: 1 },
  ],
  Cave: [
    { id: 'Wurglepup', w: 4 },
    { id: 'Bobr', w: 3 },
    { id: 'Catoctopus', w: 2 },
    { id: 'Skeleton', w: 1 },
    { id: 'Grub', w: 2 },
    { id: 'Kerekere', w: 2 },
    { id: 'Bulba', w: 1 },
  ],
  Ruins: [
    { id: 'Wurglepup', w: 3 },
    { id: 'Skeleton', w: 3 },
    { id: 'Catoctopus', w: 2 },
    { id: 'Bobr', w: 2 },
    { id: 'Elder', w: 2 },
    { id: 'Gargantula', w: 1 },
    { id: 'RegularBok', w: 1 },
  ],
  Jungle: [
    { id: 'Bulba', w: 3 },
    { id: 'Snailord', w: 2 },
    { id: 'Wurglepup', w: 3 },
    { id: 'Bobr', w: 2 },
    { id: 'Grub', w: 2 },
    { id: 'Chumbo', w: 1 },
    { id: 'Kerekere', w: 1 },
  ],
  LivingBio: [
    { id: 'Wurglepup', w: 4 },
    { id: 'Bulba', w: 3 },
    { id: 'Grub', w: 3 },
    { id: 'Catoctopus', w: 2 },
    { id: 'Snailord', w: 2 },
    { id: 'Gargantula', w: 1 },
  ],
  Bunker: [
    { id: 'Wurglepup', w: 4 },
    { id: 'Kuratko', w: 2 },
    { id: 'Grechka', w: 2 },
    { id: 'BigHands', w: 2 },
    { id: 'Skeleton', w: 2 },
    { id: 'Bobr', w: 1 },
  ],
  Catacombs: [
    { id: 'Skeleton', w: 4 },
    { id: 'Elder', w: 2 },
    { id: 'Gargantula', w: 2 },
    { id: 'Wurglepup', w: 2 },
    { id: 'Bobr', w: 1 },
    { id: 'BigHands', w: 1 },
  ],
  Golem: [
    { id: 'Catoctopus', w: 4 },
    { id: 'Kuratko', w: 2 },
    { id: 'Elder', w: 2 },
    { id: 'Wurglepup', w: 3 },
    { id: 'Skeleton', w: 1 },
    { id: 'Gargantula', w: 1 },
  ],
  Palace: [
    { id: 'Bok', w: 3 },
    { id: 'RegularBok', w: 2 },
    { id: 'Elder', w: 2 },
    { id: 'Bobr', w: 2 },
    { id: 'Skeleton', w: 2 },
    { id: 'BigHands', w: 1 },
    { id: 'Grechka', w: 1 },
    { id: 'Snailord', w: 1 },
  ],
}

/**
 * Every `ItemDefId` `pickFloorItemDefFromTable` may return (for audits / coverage checks).
 * Update when changing spawn logic.
 */
export const PROCgen_FLOOR_SPAWN_TABLE_ITEM_DEF_IDS: ItemDefId[] = [
  'AntitoxinVial',
  'Ash',
  'BitterHerb',
  'BobrJuice',
  'Bone',
  'Chisel',
  'Club',
  'ClothScrap',
  'Foodroot',
  'Fungus',
  'Gem',
  'GlassVial',
  'Glowbug',
  'Grubling',
  'HerbCirclet',
  'HerbLeaf',
  'HerbPoultice',
  'Hive',
  'Mold',
  'MortarMeal',
  'Moss',
  'Mucus',
  'Mushrooms',
  'Salt',
  'Sling',
  'Slime',
  'SporeCap',
  'Stone',
  'StoneShard',
  'Stick',
  'Sulfur',
  'Sweetroot',
  'Twine',
  'WaterbagEmpty',
  'WoolCap',
]

/** NPC kinds the default table + overrides can produce (Swarm via Infested rules only). */
export const PROCgen_ALL_NPC_KINDS: NpcKind[] = [
  'Wurglepup',
  'Bobr',
  'Skeleton',
  'Catoctopus',
  'Swarm',
  'Chumbo',
  'Grub',
  'Kuratko',
  'Grechka',
  'Snailord',
  'Bulba',
  'Elder',
  'Kerekere',
  'Bok',
  'RegularBok',
  'BigHands',
  'Gargantula',
]

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
  if (prop === 'Burning') return 'Catoctopus'
  if (prop === 'Flooded') return 'Bobr'
  if (prop === 'SporeMist') return rng.next() < 0.45 ? 'Wurglepup' : 'Bobr'
  if (prop === 'NanoHaze') return 'Catoctopus'
  if (prop === 'Unstable') return rng.next() < 0.55 ? 'Skeleton' : 'Wurglepup'
  if (prop === 'Haunted') return 'Skeleton'
  if (prop === 'RoyalMiasma') return rng.next() < 0.5 ? 'Bobr' : 'Catoctopus'
  if (func === 'Workshop') return 'Catoctopus'
  if (func === 'Storage') return 'Bobr'

  let kind = pickWeighted(rng, NPC_DEFAULT_WEIGHTS_BY_FLOOR[ctx.floorType])
  if (func === 'Habitat' && (neigh?.Habitat ?? 0) >= 2 && kind === 'Wurglepup' && rng.next() < 0.28) kind = 'Bobr'
  if (func === 'Passage' && (neigh?.Passage ?? 0) >= 2 && kind === 'Wurglepup' && rng.next() < 0.22) kind = 'Catoctopus'
  if (distTag === 'Ruin' && rng.next() < 0.35) kind = 'Skeleton'
  if (distTag === 'Core' && kind === 'Wurglepup' && rng.next() < 0.25) kind = 'Catoctopus'

  if (status === 'Destroyed' && kind === 'Wurglepup' && rng.next() < 0.4) kind = 'Skeleton'
  if (fp.includes('Infested') && kind === 'Wurglepup' && rng.next() < 0.45) kind = 'Skeleton'
  // Hive/Swarm ecosystem: Infested floors can spawn Swarms (rare), especially in Habitat clusters.
  if (fp.includes('Infested') && kind === 'Wurglepup') {
    const bias = (func === 'Habitat' ? 0.22 : 0.12) + ((neigh?.Habitat ?? 0) >= 2 ? 0.08 : 0)
    if (rng.next() < bias) kind = 'Swarm'
  }
  if (fp.includes('Cursed') && distTag === 'Ruin' && kind !== 'Skeleton' && rng.next() < 0.25) kind = 'Skeleton'
  if (fp.includes('Cursed') && prop === 'Flooded' && kind === 'Bobr' && rng.next() < 0.3) kind = 'Catoctopus'
  if (ctx.isOnEntranceExitShortestPath && kind === 'Wurglepup' && rng.next() < 0.18) kind = 'Bobr'

  return kind
}

/** Deterministic floor item def from room tags and district. */
export function pickFloorItemDefFromTable(ctx: ItemSpawnContext, rng: Rng): ItemDefId {
  const func = ctx.room.tags?.roomFunction
  const prop = ctx.room.tags?.roomProperties
  const status = ctx.room.tags?.roomStatus
  const fp = ctx.floorProperties
  const neigh = ctx.neighborRoomFunctions

  if (prop === 'Flooded') {
    // Early deterministic “water utility” drop; gives Flooded rooms a clear identity.
    return fp.includes('Cursed') ? 'AntitoxinVial' : 'WaterbagEmpty'
  }
  if (prop === 'Burning') {
    // Burning rooms skew toward combustibles; district still nudges sulfur.
    if (ctx.room.district === 'EastWing') return 'Sulfur'
    return rng.next() < 0.75 ? 'Ash' : 'Sulfur'
  }
  if (prop === 'Infected') {
    // Even if Infected rooms are already dangerous, drop a counterplay item sometimes.
    return fp.includes('Cursed') ? 'HerbPoultice' : 'AntitoxinVial'
  }
  if (prop === 'SporeMist') return rng.next() < 0.45 ? 'Moss' : 'Mushrooms'
  if (prop === 'NanoHaze') return rng.next() < 0.5 ? 'Slime' : 'GlassVial'
  if (prop === 'Unstable') return rng.next() < 0.5 ? 'Stone' : 'StoneShard'
  if (prop === 'Haunted') return rng.next() < 0.45 ? 'Bone' : 'Twine'
  if (prop === 'RoyalMiasma') return rng.next() < 0.4 ? 'Salt' : 'Sweetroot'

  if (status === 'Overgrown' && func === 'Habitat') return 'Mushrooms'
  if (fp.includes('Destroyed') && func === 'Storage') return 'Stone'
  if (fp.includes('Overgrown') && func === 'Communal') return 'Foodroot'

  let defId = (func && ITEM_BY_ROOM_FUNCTION[func]) || (rng.next() < 0.5 ? 'Stick' : 'Stone')
  if (func === 'Workshop' && (neigh?.Workshop ?? 0) >= 1 && rng.next() < 0.35) defId = 'Ash'
  if (ctx.room.district === 'EastWing' && rng.next() < 0.3) defId = 'Sulfur'
  if (ctx.room.district === 'NorthWing' && defId === 'Stick' && rng.next() < 0.22) defId = 'Stone'
  if (ctx.room.district === 'SouthWing' && defId === 'Stone' && rng.next() < 0.18) defId = 'Stick'
  if (ctx.isOnEntranceExitShortestPath && rng.next() < 0.22) defId = rng.next() < 0.5 ? 'Stick' : 'Ash'

  // Extra material variety (same RNG stream as before this block; order affects determinism).
  if (func === 'Passage' && rng.next() < 0.16) defId = rng.next() < 0.55 ? 'Twine' : 'ClothScrap'
  if (func === 'Workshop') {
    const rw = rng.next()
    if (rw < 0.08) defId = 'Chisel'
    else if (rw < 0.15) defId = 'StoneShard'
    else if (rw < 0.22) defId = 'Sling'
  }
  if (func === 'Storage' && rng.next() < 0.09) defId = 'Club'
  if (func === 'Communal' && rng.next() < 0.07) defId = 'MortarMeal'
  if (fp.includes('Cursed') && ctx.room.district === 'Ruin' && rng.next() < 0.12) {
    defId = rng.next() < 0.5 ? 'BitterHerb' : 'GlassVial'
  }
  if (fp.includes('Infested') && func === 'Workshop' && rng.next() < 0.12) defId = 'Hive'
  if (ctx.room.district === 'WestWing' && rng.next() < 0.18) defId = 'HerbLeaf'

  // Headwear: low chance in cloth- / gathering-adjacent room functions.
  if (func === 'Passage' && rng.next() < 0.07) {
    const h = rng.next()
    if (h < 0.34) defId = 'WoolCap'
    else if (h < 0.67) defId = 'HerbCirclet'
    else defId = 'SporeCap'
  } else if (func === 'Communal' && rng.next() < 0.05) {
    defId = rng.next() < 0.5 ? 'WoolCap' : 'HerbCirclet'
  } else if (func === 'Habitat' && rng.next() < 0.06) {
    defId = rng.next() < 0.55 ? 'SporeCap' : 'HerbCirclet'
  }

  return defId
}
