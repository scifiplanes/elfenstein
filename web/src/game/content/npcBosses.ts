import type { NpcKind, Resistances } from '../types'
import type { FloorProperty, FloorType, GenRoom } from '../../procgen/types'
import type { Rng } from '../../procgen/seededRng'
import { npcCombatTuningFromContent, type NpcCombatRow } from './npcCombat'

/** Deterministic split from population stream; must stay constant for stable procgen. */
export const BOSS_RNG_SUBSTREAM = 0xb055_1700

/** Max boss NPC placements per floor (global). */
export const BOSS_PLACEMENT_CAP = 3

export type BossTrait =
  | 'default'
  /** Primary hostile boss: no other same-room hostiles join (trigger still fights). */
  | 'soloEncounter'
  /** Stronger Poisoned on hit (Gargantula / Swarm-style). */
  | 'amplifyPoisonStatus'
  /** Hotter hits: +1 flat damage after multipliers (Skeleton-style). */
  | 'amplifyFireDamage'

export type BossSpawnContext = {
  floorType: FloorType
  floorIndex: number
  floorProperties: readonly FloorProperty[]
  rng: Rng
  /** BFS steps from entrance to room center; -1 if unreachable. */
  roomDist: number
  /** Room center on shortest entrance→exit path (pre-locks). */
  onPath: boolean
  neighborRoomFunctions: Partial<Record<'Passage' | 'Habitat' | 'Workshop' | 'Communal' | 'Storage', number>>
  /** Precomputed: roomDist must be >= this value (deep bosses). */
  deepDistThreshold: number
  /** Precomputed: roomDist must be <= this value (shallow bosses). */
  shallowDistMax: number
}

export type BossDefinition = {
  bossTraitId: string
  kind: NpcKind
  enabled: boolean
  instanceBudgetPerFloor: number
  /** Weight when picking among eligible definitions each placement iteration. */
  pickWeight: number
  minFloorIndex: number
  /** If set, floor type must be one of these. */
  floorTypes?: readonly FloorType[]
  /** Require at least one of these floor properties. */
  floorPropertiesAny?: readonly FloorProperty[]
  trait: BossTrait
  hpMul: number
  damageMul: number
  armorFlat: number
  speedFlat: number
  resistMul: number
  /** Visual scale vs normal billboard for this kind. */
  visualScale: number
  /** Extra percent added to base drop chance (still capped at 100 in loot). */
  lootDropBonusPct: number
  /** Room must be at least this deep (BFS dist >= deepDistThreshold). */
  requireDeep: boolean
  /** Room must be shallow (BFS dist <= shallowDistMax). */
  requireShallow: boolean
  /** When true, room center must lie on entrance→exit shortest path. */
  requireOnPath: boolean
  /** When true, room center must NOT lie on that path. */
  requireOffPath: boolean
  /** Minimum adjacent Habitat rooms (for nest bosses). */
  minNeighborHabitat: number
  /** Allowed room functions; omit = any. */
  roomFunctions?: readonly NonNullable<NonNullable<GenRoom['tags']>['roomFunction']>[]
  /** Allowed districts; omit = any. */
  districts?: readonly import('../../procgen/types').DistrictTag[]
  /**
   * When true, room matches if it has one of `roomFunctions` **or** is deep enough (`roomDist >= deepDistThreshold`).
   * When false, `roomFunctions` (if set) is required as before.
   */
  matchStorageOrDeep?: boolean
  /** When `instanceBudgetPerFloor` > 1, each placement uses a different `room.id`. */
  distinctRoomsWhenRepeated?: boolean
}

const BOSS_DEFS: BossDefinition[] = [
  {
    bossTraitId: 'boss_gargantula',
    kind: 'Gargantula',
    enabled: true,
    instanceBudgetPerFloor: 1,
    pickWeight: 2,
    minFloorIndex: 0,
    floorTypes: ['Ruins', 'LivingBio', 'Catacombs', 'Golem', 'Jungle'],
    trait: 'amplifyPoisonStatus',
    hpMul: 1.42,
    damageMul: 1.18,
    armorFlat: 1,
    speedFlat: 0,
    resistMul: 1.12,
    visualScale: 1.22,
    lootDropBonusPct: 15,
    requireDeep: true,
    requireShallow: false,
    requireOnPath: false,
    requireOffPath: true,
    minNeighborHabitat: 0,
  },
  {
    bossTraitId: 'boss_big_hands',
    kind: 'BigHands',
    enabled: true,
    instanceBudgetPerFloor: 1,
    pickWeight: 2,
    minFloorIndex: 0,
    floorTypes: ['Dungeon', 'Bunker', 'Palace', 'Catacombs'],
    trait: 'soloEncounter',
    hpMul: 1.48,
    damageMul: 1.22,
    armorFlat: 2,
    speedFlat: -1,
    resistMul: 1.08,
    visualScale: 1.28,
    lootDropBonusPct: 12,
    requireDeep: false,
    requireShallow: false,
    requireOnPath: false,
    requireOffPath: false,
    minNeighborHabitat: 0,
    roomFunctions: ['Storage'],
    matchStorageOrDeep: true,
  },
  {
    bossTraitId: 'boss_skeleton',
    kind: 'Skeleton',
    enabled: true,
    instanceBudgetPerFloor: 1,
    pickWeight: 3,
    minFloorIndex: 0,
    trait: 'amplifyFireDamage',
    hpMul: 1.38,
    damageMul: 1.16,
    armorFlat: 1,
    speedFlat: 1,
    resistMul: 1.08,
    visualScale: 1.18,
    lootDropBonusPct: 10,
    requireDeep: false,
    requireShallow: false,
    requireOnPath: true,
    requireOffPath: false,
    minNeighborHabitat: 0,
    floorPropertiesAny: ['Infested', 'Cursed'],
  },
  {
    bossTraitId: 'boss_swarm',
    kind: 'Swarm',
    enabled: true,
    instanceBudgetPerFloor: 3,
    pickWeight: 1,
    minFloorIndex: 1,
    floorPropertiesAny: ['Infested'],
    trait: 'amplifyPoisonStatus',
    hpMul: 1.22,
    damageMul: 1.14,
    armorFlat: 0,
    speedFlat: 1,
    resistMul: 1.06,
    visualScale: 1.12,
    lootDropBonusPct: 8,
    requireDeep: false,
    requireShallow: false,
    requireOnPath: false,
    requireOffPath: false,
    minNeighborHabitat: 2,
    roomFunctions: ['Habitat'],
    distinctRoomsWhenRepeated: true,
  },
]

const byTraitId = new Map(BOSS_DEFS.map((d) => [d.bossTraitId, d]))
const byKind = new Map<NpcKind, BossDefinition[]>()
for (const d of BOSS_DEFS) {
  const arr = byKind.get(d.kind) ?? []
  arr.push(d)
  byKind.set(d.kind, arr)
}

export function bossDefinitionsEnabled(): BossDefinition[] {
  return BOSS_DEFS.filter((d) => d.enabled)
}

export function getBossDefinitionByTraitId(id: string): BossDefinition | undefined {
  return byTraitId.get(id)
}

export function getBossDefinitionForNpc(npc: {
  variant?: 'boss'
  kind: NpcKind
  bossTraitId?: string
}): BossDefinition | undefined {
  if (npc.variant !== 'boss') return undefined
  if (npc.bossTraitId) return byTraitId.get(npc.bossTraitId)
  return byKind.get(npc.kind)?.[0]
}

export function bossSpawnMatchesRoom(def: BossDefinition, ctx: BossSpawnContext, room: GenRoom): boolean {
  if (ctx.floorIndex < def.minFloorIndex) return false
  if (def.floorTypes && !def.floorTypes.includes(ctx.floorType)) return false
  if (def.floorPropertiesAny?.length) {
    const ok = def.floorPropertiesAny.some((p) => ctx.floorProperties.includes(p))
    if (!ok) return false
  }
  if (def.roomFunctions?.length) {
    const f = room.tags?.roomFunction
    const hasFn = f != null && def.roomFunctions.includes(f)
    if (def.matchStorageOrDeep) {
      const deep = ctx.roomDist >= ctx.deepDistThreshold
      if (!hasFn && !deep) return false
    } else {
      if (!hasFn) return false
    }
  }
  if (def.districts?.length) {
    const dist = room.district
    if (!dist || !def.districts.includes(dist)) return false
  }
  if (def.requireDeep && ctx.roomDist < ctx.deepDistThreshold) return false
  if (def.requireShallow && ctx.roomDist > ctx.shallowDistMax) return false
  if (def.requireOnPath && !ctx.onPath) return false
  if (def.requireOffPath && ctx.onPath) return false
  if (def.minNeighborHabitat > 0 && (ctx.neighborRoomFunctions.Habitat ?? 0) < def.minNeighborHabitat) return false
  return true
}

type NpcCombatTuning = Omit<NpcCombatRow, 'hpMax'>

function scaleResists(r: Resistances, mul: number): Resistances {
  if (mul === 1) return r
  const out: Resistances = { ...r }
  for (const k of Object.keys(out) as (keyof Resistances)[]) {
    const v = out[k]
    if (typeof v === 'number') out[k] = Math.min(0.95, v * mul) as any
  }
  return out
}

function amplifyPoisonOnHitList(
  list: NpcCombatTuning['statusOnHit'],
): NpcCombatTuning['statusOnHit'] {
  if (!list?.length) return list
  return list.map((e) =>
    e.status === 'Poisoned'
      ? {
          ...e,
          pct: Math.min(100, Math.round(e.pct * 1.55)),
          durationMs: e.durationMs != null ? Math.round(e.durationMs * 1.2) : e.durationMs,
        }
      : e,
  )
}

/** Combat tuning for a concrete floor NPC (boss scaling + traits). */
export function resolveNpcCombatTuning(npc: {
  kind: NpcKind
  variant?: 'boss'
  bossTraitId?: string
}): NpcCombatTuning {
  const base = npcCombatTuningFromContent(npc.kind)
  const def = getBossDefinitionForNpc(npc)
  if (!def) return base

  let speed = Math.max(1, Math.round(base.speed + def.speedFlat))
  let baseDamage = Math.max(1, Math.round(base.baseDamage * def.damageMul))
  if (def.trait === 'amplifyFireDamage' && base.damageType === 'Fire') {
    baseDamage += 1
  }
  const armor = Math.max(0, base.armor + def.armorFlat)
  const resistances = scaleResists(base.resistances ?? {}, def.resistMul)
  let statusOnHit = base.statusOnHit?.map((e) => ({ ...e }))
  if (def.trait === 'amplifyPoisonStatus') {
    statusOnHit = amplifyPoisonOnHitList(statusOnHit)
  }

  return {
    speed,
    baseDamage,
    damageType: base.damageType,
    armor,
    resistances,
    statusOnHit,
  }
}

export function bossTraitSoloEncounter(npc: { variant?: 'boss'; bossTraitId?: string; kind: NpcKind }): boolean {
  const d = getBossDefinitionForNpc(npc)
  return d?.trait === 'soloEncounter'
}

export function bossVisualScale(npc: { variant?: 'boss'; bossTraitId?: string; kind: NpcKind }): number {
  const d = getBossDefinitionForNpc(npc)
  return d?.visualScale ?? 1
}

export function bossLootDropBonusPct(npc: { variant?: 'boss'; bossTraitId?: string; kind: NpcKind }): number {
  const d = getBossDefinitionForNpc(npc)
  return d?.lootDropBonusPct ?? 0
}
