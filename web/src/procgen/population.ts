import {
  BOSS_PLACEMENT_CAP,
  BOSS_RNG_SUBSTREAM,
  bossDefinitionsEnabled,
  bossSpawnMatchesRoom,
  type BossDefinition,
  type BossSpawnContext,
} from '../game/content/npcBosses'
import { npcKindHpMax } from '../game/content/npcCombat'
import { pickFloorFriendlyNpcTrade } from '../game/content/trading'
import { clampNpcSpawnCountRange } from '../game/npcSpawnTuning'
import { cellKey } from '../game/state/playerFloorCell'
import type { FloorPoi, ItemDefId, NpcLanguage, Tile, Vec2 } from '../game/types'
import { mulberry32, splitSeed, type Rng } from './seededRng'
import type { FloorProperty, FloorType, GenNpc, GenRoom } from './types'
import { pickFloorItemDefFromTable, pickNpcKindFromTable } from './spawnTables'
import { shortestPathIndices } from './locks'
import { bfsDistances, exitNeighborReachableWithPoiBlocking, floorCellTouchesOrthogonalWall } from './validate'
import { findNearestFloor, pickClosestDistanceCell, pickFarthestUnusedFloor } from './layoutPasses'
import { buildRoomAdjacency } from './districtsTags'

/** Deterministic 32-bit hash (no RNG); used for Kuratko nest egg count so `placePois` does not consume `popRng`. */
function hashStrU32(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const KURATKO_NEST_FLOOR_TYPES = new Set<FloorType>(['Cave', 'Jungle', 'LivingBio', 'Ruins'])

/**
 * For `floorIndex >= 1`, well spawns with `drained: true` when `hash(floorSeed:well:drained) % 100` is below this.
 * Floor 0 always spawns filled so the first floor reliably supports vessel fills.
 */
const WELL_SPAWN_DRAINED_THRESHOLD = 30

/** Item defs referenced in neutral NPC `quest.wants` / `quest.hated` (procgen population). */
export const PROCgen_NPC_QUEST_WANT_ITEM_DEF_IDS: readonly ItemDefId[] = [
  'Mushrooms',
  'Foodroot',
  'Ash',
  'Sulfur',
  'Stick',
  'Stone',
  'Glowbug',
  'Salt',
  'Gem',
  'Sweetroot',
  'Figurine',
]
export const PROCgen_NPC_QUEST_HATED_ITEM_DEF_IDS: readonly ItemDefId[] = ['Stone', 'Stick', 'Mushrooms', 'Foodroot']

/** Item defs that spawn as multi-cell forage patches (see `spawnNpcsAndItems`). */
export const FORAGE_PATCH_ITEM_DEF_IDS: ReadonlySet<ItemDefId> = new Set([
  'Mushrooms',
  'Fungus',
  'Foodroot',
  'Grubling',
])

const MAX_PROCgen_POP_FLOOR_ITEMS = 16

function manhattanDist(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function pickForagePatchCells(args: {
  rect: { x: number; y: number; w: number; h: number }
  anchor: Vec2
  tiles: Tile[]
  w: number
  h: number
  occupied: Set<string>
  keyOf: (p: Vec2) => string
  rng: Rng
  want: number
}): Vec2[] {
  const { rect, anchor, tiles, w, h, occupied, keyOf, rng, want } = args
  const candidates: Vec2[] = []
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue
      if (tiles[x + y * w] !== 'floor') continue
      const p = { x, y }
      if (occupied.has(keyOf(p))) continue
      if (manhattanDist(p, anchor) > 2) continue
      candidates.push(p)
    }
  }
  if (candidates.length === 0) return []
  shuffleSpawnSlots(candidates, rng)
  return candidates.slice(0, Math.min(want, candidates.length))
}

function shortestPathCellSet(tiles: Tile[], w: number, h: number, entrance: Vec2, exit: Vec2): Set<string> {
  const path = shortestPathIndices(tiles, w, h, entrance, exit)
  if (!path) return new Set()
  const s = new Set<string>()
  for (const idx of path) {
    s.add(`${idx % w},${((idx / w) | 0)}`)
  }
  return s
}

function collectFloorCellsInRect(
  rect: { x: number; y: number; w: number; h: number },
  tiles: Tile[],
  w: number,
  h: number,
  occupied: Set<string>,
  keyOf: (p: Vec2) => string,
): Vec2[] {
  const out: Vec2[] = []
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue
      const p = { x, y }
      if (tiles[x + y * w] !== 'floor') continue
      if (occupied.has(keyOf(p))) continue
      out.push(p)
    }
  }
  return out
}

/** True if the rect contains at least one floor tile not in `occupied` (same rules as NPC slot collection). */
function rectHasAnyFreeFloorCell(
  rect: { x: number; y: number; w: number; h: number },
  tiles: Tile[],
  w: number,
  h: number,
  occupied: Set<string>,
  keyOf: (p: Vec2) => string,
): boolean {
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue
      const p = { x, y }
      if (tiles[x + y * w] !== 'floor') continue
      if (occupied.has(keyOf(p))) continue
      return true
    }
  }
  return false
}

function shuffleSpawnSlots<T>(arr: T[], rng: Rng): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    const t = arr[i]!
    arr[i] = arr[j]!
    arr[j] = t
  }
}

export function placePois(args: {
  tiles: Tile[]
  w: number
  h: number
  rooms: GenRoom[]
  entrance: Vec2
  exit: Vec2
  rng: Pick<Rng, 'next'>
  floorProperties?: readonly FloorProperty[]
  /** Layout attempt seed; used for deterministic PoI payloads (e.g. nest egg count) without consuming `rng`. */
  floorSeed: number
  floorType: FloorType
  /** 0-based; floor 0 never spawns a drained well. */
  floorIndex?: number
}): FloorPoi[] {
  const { tiles, w, h, rooms, entrance, exit, floorSeed, floorType } = args
  const floorIndex = args.floorIndex ?? 0
  const floorProperties = args.floorProperties ?? []

  const used = new Set<string>()
  const markUsed = (p: Vec2) => used.add(cellKey(p.x, p.y))
  const ok = (p: Vec2) =>
    p.x >= 0 && p.y >= 0 && p.x < w && p.y < h && tiles[p.x + p.y * w] === 'floor' && !used.has(cellKey(p.x, p.y))

  const poiKeysBlockingProgress = (extra: Vec2 | null): Set<string> => {
    const s = new Set(used)
    if (extra) s.add(cellKey(extra.x, extra.y))
    return s
  }

  const progressionOkWithPoiAt = (extra: Vec2 | null) =>
    exitNeighborReachableWithPoiBlocking(tiles, w, h, entrance, exit, poiKeysBlockingProgress(extra))

  const wellPos = ok(entrance) ? entrance : (findNearestFloor(tiles, w, h, entrance) ?? entrance)
  markUsed(wellPos)

  const dist = bfsDistances(tiles, w, h, entrance)

  const pickFarthestUnusedFloorProgressionOk = (): Vec2 | null => {
    let bestIdx = -1
    let bestD = -1
    for (let i = 0; i < dist.length; i++) {
      const d = dist[i]
      if (d <= bestD) continue
      if (tiles[i] !== 'floor') continue
      const x = i % w
      const y = (i / w) | 0
      if (used.has(cellKey(x, y))) continue
      const p = { x, y }
      if (!progressionOkWithPoiAt(p)) continue
      bestD = d
      bestIdx = i
    }
    if (bestIdx < 0) return null
    return { x: bestIdx % w, y: (bestIdx / w) | 0 }
  }

  const pickClosestDistanceCellProgressionOk = (targetD: number): Vec2 | null => {
    let bestIdx = -1
    let bestErr = 1e9
    for (let i = 0; i < dist.length; i++) {
      const d = dist[i]
      if (d < 0) continue
      if (tiles[i] !== 'floor') continue
      const x = i % w
      const y = (i / w) | 0
      if (used.has(cellKey(x, y))) continue
      const p = { x, y }
      if (!progressionOkWithPoiAt(p)) continue
      const err = Math.abs(d - targetD)
      if (err < bestErr) {
        bestErr = err
        bestIdx = i
      }
    }
    if (bestIdx < 0) return null
    return { x: bestIdx % w, y: (bestIdx / w) | 0 }
  }

  const firstUnusedFloorProgressionOkScan = (): Vec2 | null => {
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i] !== 'floor') continue
      const x = i % w
      const y = (i / w) | 0
      if (used.has(cellKey(x, y))) continue
      const p = { x, y }
      if (progressionOkWithPoiAt(p)) return p
    }
    return null
  }

  const storageRoomsSorted = rooms
    .filter((r) => r.tags?.roomFunction === 'Storage')
    .sort((a, b) => a.rect.w * a.rect.h - (b.rect.w * b.rect.h))

  const pickStorageLikePos = (fallback: Vec2) => {
    for (const r of storageRoomsSorted) {
      if (ok(r.center) && progressionOkWithPoiAt(r.center)) return r.center
    }
    return pickFarthestUnusedFloorProgressionOk() ?? pickFarthestUnusedFloor(dist, tiles, w, used) ?? fallback
  }
  const exitIdx = exit.x + exit.y * w
  const maxD = exitIdx >= 0 && exitIdx < dist.length ? dist[exitIdx] : -1
  const targetD = Math.max(0, Math.floor(maxD * 0.45))
  const harshRoomProperties = (p: GenRoom['tags'] | undefined) => {
    const x = p?.roomProperties
    return (
      x === 'Burning' ||
      x === 'Infected' ||
      x === 'SporeMist' ||
      x === 'NanoHaze' ||
      x === 'Unstable' ||
      x === 'Haunted' ||
      x === 'RoyalMiasma'
    )
  }

  const isBedRoomOk = (r: GenRoom) => {
    const f = r.tags?.roomFunction
    // Keep bed out of connector/junction rooms (pre-tagged Passage).
    if (r.id.startsWith('r_junc_')) return false
    return (f === 'Habitat' || f === 'Communal') && !harshRoomProperties(r.tags)
  }
  const bedRoomScored = rooms
    .filter((r) => isBedRoomOk(r) && ok(r.center))
    .map((r) => {
      const p = r.center
      const i = p.x + p.y * w
      const d = i >= 0 && i < dist.length ? dist[i] : -1
      return { p, d, err: d >= 0 ? Math.abs(d - targetD) : 1e9 }
    })
    .filter((x) => x.d >= 0)
    .sort((a, b) => (a.err !== b.err ? a.err - b.err : a.p.x !== b.p.x ? a.p.x - b.p.x : a.p.y - b.p.y))

  let bedPos: Vec2 | null = null
  for (const x of bedRoomScored) {
    if (progressionOkWithPoiAt(x.p)) {
      bedPos = x.p
      break
    }
  }
  bedPos =
    bedPos ??
    pickClosestDistanceCellProgressionOk(targetD) ??
    firstUnusedFloorProgressionOkScan() ??
    pickClosestDistanceCell(dist, tiles, w, targetD, used) ??
    wellPos
  markUsed(bedPos)

  const pathCells = shortestPathCellSet(tiles, w, h, entrance, exit)

  let chestPos: Vec2 | null = null
  for (const r of storageRoomsSorted) {
    if (r.id.startsWith('r_junc_')) continue
    if (ok(r.center) && progressionOkWithPoiAt(r.center)) {
      // Prefer off-path storage so chest feels like a side objective.
      if (!pathCells.has(cellKey(r.center.x, r.center.y))) {
        chestPos = r.center
        break
      }
      if (!chestPos) chestPos = r.center
    }
  }
  if (!chestPos) {
    chestPos = pickFarthestUnusedFloorProgressionOk() ?? pickFarthestUnusedFloor(dist, tiles, w, used) ?? bedPos
  }
  markUsed(chestPos)

  const barrelPos = pickStorageLikePos(chestPos)
  markUsed(barrelPos)

  const cratePos = pickStorageLikePos(barrelPos)
  markUsed(cratePos)

  const isJunc = (r: GenRoom) => r.id.startsWith('r_junc_')
  const keyOf = (p: Vec2) => `${p.x},${p.y}`

  // For optional POIs we try to keep them off the main path when possible.
  const pickTaggedRoomCenter = (predicate: (r: GenRoom) => boolean): Vec2 | null => {
    const candidates = rooms
      .filter((r) => !isJunc(r) && predicate(r) && ok(r.center) && progressionOkWithPoiAt(r.center))
      .map((r) => {
        const i = r.center.x + r.center.y * w
        const d = i >= 0 && i < dist.length ? dist[i] : -1
        return { r, d, onPath: pathCells.has(keyOf(r.center)) }
      })
      .filter((x) => x.d >= 0)
      .sort((a, b) => {
        // Prefer off-path, then farther from entrance, then stable tie-break by room id.
        if (a.onPath !== b.onPath) return a.onPath ? 1 : -1
        if (a.d !== b.d) return b.d - a.d
        return a.r.id.localeCompare(b.r.id)
      })
    return candidates[0]?.r.center ?? null
  }

  const pickWallAdjacentInRoom = (room: GenRoom): Vec2 | null => {
    const { x, y, w: rw, h: rh } = room.rect
    // Deterministic scan order; does not consume RNG so downstream population stays stable.
    for (let yy = y; yy < y + rh; yy++) {
      for (let xx = x; xx < x + rw; xx++) {
        const p = { x: xx, y: yy }
        if (!ok(p)) continue
        if (!floorCellTouchesOrthogonalWall(tiles, w, h, p)) continue
        if (!progressionOkWithPoiAt(p)) continue
        // Prefer off-path placements when possible.
        if (pathCells.has(keyOf(p))) continue
        return p
      }
    }
    // Fallback: allow on-path if no off-path wall-adjacent tile exists.
    for (let yy = y; yy < y + rh; yy++) {
      for (let xx = x; xx < x + rw; xx++) {
        const p = { x: xx, y: yy }
        if (!ok(p)) continue
        if (!floorCellTouchesOrthogonalWall(tiles, w, h, p)) continue
        if (!progressionOkWithPoiAt(p)) continue
        return p
      }
    }
    return null
  }

  // Optional POIs: Shrine and CrackedWall.
  // Shrine: prefer communal spaces and cursed floors.
  const shrineCenter = pickTaggedRoomCenter((r) => {
    const f = r.tags?.roomFunction
    if (harshRoomProperties(r.tags)) return false
    if (floorProperties.includes('Cursed')) return f === 'Communal' || f === 'Habitat'
    return f === 'Communal'
  })
  const shrinePos = shrineCenter && ok(shrineCenter) ? shrineCenter : null
  if (shrinePos) markUsed(shrinePos)

  // CrackedWall: prefer collapsed/destroyed rooms or destroyed floors; try to place adjacent to a wall.
  const crackedRoom = rooms
    .filter((r) => !isJunc(r))
    .filter((r) => {
      const s = r.tags?.roomStatus
      const f = r.tags?.roomFunction
      if (floorProperties.includes('Destroyed')) return f === 'Storage' || f === 'Workshop' || f === 'Passage'
      return s === 'Collapsed' || s === 'Destroyed'
    })
    .sort((a, b) => a.id.localeCompare(b.id))[0]
  let crackedPos: Vec2 | null = null
  if (crackedRoom) crackedPos = pickWallAdjacentInRoom(crackedRoom)
  if (crackedPos) markUsed(crackedPos)

  let kuratkoNestPos: Vec2 | null = null
  if (KURATKO_NEST_FLOOR_TYPES.has(floorType)) {
    const nestCenter = pickTaggedRoomCenter((r) => {
      if (harshRoomProperties(r.tags)) return false
      return r.tags?.roomFunction === 'Habitat'
    })
    if (nestCenter && ok(nestCenter) && progressionOkWithPoiAt(nestCenter)) {
      kuratkoNestPos = nestCenter
      markUsed(nestCenter)
    }
  }

  const exitPos = ok(exit) ? exit : (findNearestFloor(tiles, w, h, exit) ?? exit)
  markUsed(exitPos)

  const kuratkoNestPoi: FloorPoi | null =
    kuratkoNestPos != null
      ? {
          id: 'poi_kuratkoNest',
          kind: 'KuratkoNest',
          pos: kuratkoNestPos,
          eggsLeft: 2 + (hashStrU32(`${floorSeed >>> 0}:kuratkoNest:poi_kuratkoNest`) % 3),
          opened: false,
        }
      : null

  const wellDrained =
    floorIndex > 0 && hashStrU32(`${floorSeed >>> 0}:well:drained`) % 100 < WELL_SPAWN_DRAINED_THRESHOLD

  return [
    { id: 'poi_well', kind: 'Well', pos: wellPos, ...(wellDrained ? { drained: true } : {}) },
    { id: 'poi_bed', kind: 'Bed', pos: bedPos, opened: false },
    { id: 'poi_chest', kind: 'Chest', pos: chestPos, opened: false },
    { id: 'poi_barrel', kind: 'Barrel', pos: barrelPos, opened: false },
    { id: 'poi_crate', kind: 'Crate', pos: cratePos, opened: false },
    ...(shrinePos ? ([{ id: 'poi_shrine', kind: 'Shrine', pos: shrinePos }] as const) : []),
    ...(crackedPos ? ([{ id: 'poi_crackedWall', kind: 'CrackedWall', pos: crackedPos }] as const) : []),
    ...(kuratkoNestPoi ? [kuratkoNestPoi] : []),
    { id: 'poi_exit', kind: 'Exit', pos: exitPos },
  ]
}

function posInGenRoomRect(pos: Vec2, rect: { x: number; y: number; w: number; h: number }): boolean {
  return pos.x >= rect.x && pos.x < rect.x + rect.w && pos.y >= rect.y && pos.y < rect.y + rect.h
}

/** When a Kuratko nest POI exists, ensure the containing room has at least one non-boss Kuratko (retune or +1 inject). */
function ensureKuratkoInNestRoom(args: {
  npcs: GenNpc[]
  occupied: Set<string>
  rooms: GenRoom[]
  tiles: Tile[]
  w: number
  h: number
  kuratkoNestPos: Vec2 | null | undefined
  keyOf: (p: Vec2) => string
}): void {
  const { npcs, occupied, rooms, tiles, w, h, kuratkoNestPos, keyOf } = args
  if (kuratkoNestPos == null) return

  const nestRoom = rooms.find((r) => posInGenRoomRect(kuratkoNestPos, r.rect))
  if (!nestRoom) return

  const { rect } = nestRoom
  const inNestRoom = (p: Vec2) => posInGenRoomRect(p, rect)

  if (npcs.some((n) => inNestRoom(n.pos) && n.kind === 'Kuratko' && n.variant !== 'boss')) return

  const retuneCandidates = npcs
    .filter((n) => inNestRoom(n.pos) && n.variant !== 'boss')
    .sort((a, b) => a.id.localeCompare(b.id))
  if (retuneCandidates.length > 0) {
    const n = retuneCandidates[0]!
    const hpMax = npcKindHpMax('Kuratko')
    n.kind = 'Kuratko'
    n.name = 'Kuratko'
    n.hp = hpMax
    n.hpMax = hpMax
    n.status = 'hostile'
    n.quest = undefined
    n.trade = undefined
    return
  }

  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue
      if (tiles[x + y * w] !== 'floor') continue
      const p = { x, y }
      if (occupied.has(keyOf(p))) continue
      const hpMax = npcKindHpMax('Kuratko')
      const langList: NpcLanguage[] = ['DeepGnome', 'Zalgo', 'Mojibake']
      const language = langList[(0 * 17 + ('Kuratko'.charCodeAt(0) % 7)) % langList.length]
      npcs.push({
        id: `g_npc_Kuratko_nest_${x}_${y}`,
        kind: 'Kuratko',
        name: 'Kuratko',
        pos: p,
        status: 'hostile',
        hp: hpMax,
        hpMax,
        language,
        quest: undefined,
        statuses: [],
      })
      occupied.add(keyOf(p))
      return
    }
  }
}

export function spawnNpcsAndItems(args: {
  tiles: Tile[]
  w: number
  h: number
  rooms: GenRoom[]
  entrance: Vec2
  exit: Vec2
  occupied: Set<string>
  rng: Rng
  floorType: FloorType
  floorProperties?: readonly FloorProperty[]
  npcSpawnCountMin?: number
  npcSpawnCountMax?: number
  /** 0-based; used for boss spawn gates. */
  floorIndex?: number
  /** Population RNG stream seed (`streams.population`); splits boss RNG without consuming main `rng`. */
  populationStreamSeed?: number
  /** Default true; set false in unit tests that assert exact NPC counts. */
  spawnBosses?: boolean
  /**
   * When set (surviving **Kuratko nest** POI center), guarantees ≥1 non-boss **Kuratko** in that room
   * (retune an existing spawn, or inject one on a free floor cell — may exceed `npcCap` by 1).
   */
  kuratkoNestPos?: Vec2 | null
}): { npcs: GenNpc[]; floorItems: Array<{ defId: ItemDefId; pos: Vec2; qty?: number }> } {
  const { tiles, w, h, rooms, entrance, exit, occupied, rng, floorType } = args
  const floorProperties = args.floorProperties ?? []
  const floorIndex = args.floorIndex ?? 0

  const npcs: GenNpc[] = []
  const floorItems: Array<{ defId: ItemDefId; pos: Vec2; qty?: number }> = []

  const pathCells = shortestPathCellSet(tiles, w, h, entrance, exit)

  const keyOf = (p: Vec2) => `${p.x},${p.y}`
  const isFreeFloor = (p: Vec2) =>
    p.x >= 0 && p.y >= 0 && p.x < w && p.y < h && tiles[p.x + p.y * w] === 'floor' && !occupied.has(keyOf(p))

  const dist = bfsDistances(tiles, w, h, entrance)
  const roomScore = (r: GenRoom) => {
    const i = r.center.x + r.center.y * w
    return i >= 0 && i < dist.length ? dist[i] : -1
  }
  const candidates = rooms
    .filter((r) => rectHasAnyFreeFloorCell(r.rect, tiles, w, h, occupied, keyOf))
    .map((r) => ({ r, d: roomScore(r) }))
    .filter((x) => x.d >= 0)
    .sort((a, b) => b.d - a.d)

  const adj = buildRoomAdjacency(rooms, tiles, w)
  const roomsById = new Map<string, GenRoom>(rooms.map((r) => [r.id, r]))

  const neighborRoomFunctions = (room: GenRoom) => {
    const counts: Partial<Record<'Passage' | 'Habitat' | 'Workshop' | 'Communal' | 'Storage', number>> = {}
    const neigh = adj.get(room.id) ?? []
    for (const nid of neigh) {
      const n = roomsById.get(nid)
      const f = n?.tags?.roomFunction
      if (!f) continue
      counts[f] = (counts[f] ?? 0) + 1
    }
    return counts
  }

  const dsSorted = candidates.map((c) => c.d).sort((a, b) => a - b)
  const distQuantileAsc = (sortedAsc: number[], q: number) => {
    if (sortedAsc.length === 0) return 0
    const i = Math.min(sortedAsc.length - 1, Math.max(0, Math.floor(q * (sortedAsc.length - 1))))
    return sortedAsc[i]!
  }
  const deepDistThreshold = distQuantileAsc(dsSorted, 0.72)
  const shallowDistMax = distQuantileAsc(dsSorted, 0.28)

  const spawnBosses = args.spawnBosses !== false
  const bossRng = mulberry32(splitSeed(args.populationStreamSeed ?? 0, BOSS_RNG_SUBSTREAM))
  const placedPerTrait = new Map<string, number>()
  const roomsUsedPerTrait = new Map<string, Set<string>>()
  let bossIdx = 0
  for (let round = 0; spawnBosses && round < BOSS_PLACEMENT_CAP; round++) {
    type BossOpt = { def: BossDefinition; room: GenRoom; pos: Vec2; pickWeight: number }
    const options: BossOpt[] = []
    for (const def of bossDefinitionsEnabled()) {
      const used = placedPerTrait.get(def.bossTraitId) ?? 0
      if (used >= def.instanceBudgetPerFloor) continue
      for (const { r, d } of candidates) {
        const roomCenterPath = pathCells.has(keyOf(r.center))
        const ctx: BossSpawnContext = {
          floorType,
          floorIndex,
          floorProperties,
          rng: bossRng,
          roomDist: d,
          onPath: roomCenterPath,
          neighborRoomFunctions: neighborRoomFunctions(r),
          deepDistThreshold,
          shallowDistMax,
        }
        if (!bossSpawnMatchesRoom(def, ctx, r)) continue
        if (def.distinctRoomsWhenRepeated && def.instanceBudgetPerFloor > 1) {
          const seen = roomsUsedPerTrait.get(def.bossTraitId)
          if (seen?.has(r.id)) continue
        }
        const cells = collectFloorCellsInRect(r.rect, tiles, w, h, occupied, keyOf)
        for (const pos of cells) {
          if (!isFreeFloor(pos)) continue
          options.push({ def, room: r, pos, pickWeight: def.pickWeight })
        }
      }
    }
    if (options.length === 0) break
    const totalW = options.reduce((s, o) => s + o.pickWeight, 0)
    let roll = bossRng.next() * totalW
    let chosen = options[0]!
    for (const o of options) {
      roll -= o.pickWeight
      if (roll <= 0) {
        chosen = o
        break
      }
    }
    const def = chosen.def
    const hpBase = npcKindHpMax(def.kind)
    const hpMax = Math.max(1, Math.round(hpBase * def.hpMul))
    const id = `g_npc_boss_${def.bossTraitId}_${bossIdx}_${chosen.pos.x}_${chosen.pos.y}`
    bossIdx++
    npcs.push({
      id,
      kind: def.kind,
      name: def.kind,
      pos: chosen.pos,
      status: 'hostile',
      hp: hpMax,
      hpMax,
      language: 'DeepGnome',
      quest: undefined,
      statuses: [],
      variant: 'boss',
      bossTraitId: def.bossTraitId,
    })
    occupied.add(keyOf(chosen.pos))
    placedPerTrait.set(def.bossTraitId, (placedPerTrait.get(def.bossTraitId) ?? 0) + 1)
    if (def.distinctRoomsWhenRepeated && def.instanceBudgetPerFloor > 1) {
      const s = roomsUsedPerTrait.get(def.bossTraitId) ?? new Set<string>()
      s.add(chosen.room.id)
      roomsUsedPerTrait.set(def.bossTraitId, s)
    }
  }

  const nearMaxD =
    dsSorted.length === 0 ? 0 : dsSorted[Math.max(0, Math.floor(0.25 * (dsSorted.length - 1)))]!

  type NpcSpawnSlot = { room: GenRoom; pos: Vec2; roomDist: number }
  const slots: NpcSpawnSlot[] = []
  const slotCellSeen = new Set<string>()
  for (const { r, d } of candidates) {
    for (const pos of collectFloorCellsInRect(r.rect, tiles, w, h, occupied, keyOf)) {
      const k = keyOf(pos)
      if (slotCellSeen.has(k)) continue
      slotCellSeen.add(k)
      slots.push({ room: r, pos, roomDist: d })
    }
  }
  shuffleSpawnSlots(slots, rng)

  const { min: smin, max: smax } = clampNpcSpawnCountRange(args.npcSpawnCountMin, args.npcSpawnCountMax)
  const targetNpcCount = rng.int(smin, smax + 1)
  const npcCap = Math.min(targetNpcCount, slots.length)

  const langList: NpcLanguage[] = ['DeepGnome', 'Zalgo', 'Mojibake']
  const wants: ItemDefId[] = [...PROCgen_NPC_QUEST_WANT_ITEM_DEF_IDS]
  const hated: ItemDefId[] = ['Stone', 'Stick', 'Mushrooms', 'Foodroot']

  const pickQuest = (i: number) => {
    const wId = wants[i % wants.length]
    const h1 = hated[(i + 1) % hated.length]
    const h2 = hated[(i + 2) % hated.length]
    const hs = Array.from(new Set([h1, h2].filter((x) => x !== wId)))
    return { wants: wId, hated: hs.length ? hs : ['Stone'] }
  }

  const npcFromSpawn = (room: GenRoom, pos: Vec2, roomDist: number, idx: number): GenNpc | null => {
    if (!isFreeFloor(pos)) return null
    const isNear = roomDist <= nearMaxD
    const onPath = pathCells.has(keyOf(pos))
    const kind = pickNpcKindFromTable(
      {
        floorType,
        floorProperties,
        room,
        idx,
        isNear,
        isOnEntranceExitShortestPath: onPath,
        neighborRoomFunctions: neighborRoomFunctions(room),
      },
      rng,
    )

    const forceHostile =
      kind === 'Skeleton' ||
      kind === 'Gargantula' ||
      kind === 'BigHands' ||
      kind === 'Grub' ||
      kind === 'SporeGrub' ||
      kind === 'SunGrub' ||
      kind === 'Chumbo' ||
      kind === 'Kuratko'
    const preferFriendly =
      kind === 'Elder' || kind === 'Snailord' || kind === 'Bok' || kind === 'RegularBok' || kind === 'Grechka'

    let status: GenNpc['status']
    if (forceHostile) status = 'hostile'
    else if (preferFriendly) status = isNear ? 'friendly' : 'neutral'
    else status = isNear ? 'neutral' : rng.next() < 0.25 ? 'hostile' : 'neutral'
    const language = langList[(idx * 17 + (kind.charCodeAt(0) % 7)) % langList.length]
    const name = kind
    const hpMax = npcKindHpMax(kind)
    const hp = hpMax
    const base: GenNpc = {
      id: `g_npc_${kind}_${idx}_${pos.x}_${pos.y}`,
      kind,
      name,
      pos,
      status,
      hp,
      hpMax,
      language,
      quest: status === 'hostile' ? undefined : pickQuest(idx),
      statuses: [],
    }
    if (status === 'friendly' && preferFriendly) {
      return { ...base, trade: pickFloorFriendlyNpcTrade(rng, idx) }
    }
    return base
  }

  let idx = 0
  for (let s = 0; s < npcCap; s++) {
    const slot = slots[s]!
    const npc = npcFromSpawn(slot.room, slot.pos, slot.roomDist, idx++)
    if (!npc) continue
    npcs.push(npc)
    occupied.add(keyOf(npc.pos))
  }

  const itemRooms = candidates
    .filter((x) => x.d > 0)
    .map((x) => x.r)
    .slice(0, 6)
  let itemSpawnPasses = 0
  for (const r of itemRooms) {
    if (itemSpawnPasses >= 4) break
    if (floorItems.length >= MAX_PROCgen_POP_FLOOR_ITEMS) break
    const defId = pickFloorItemDefFromTable(
      {
        floorType,
        floorProperties,
        room: r,
        isOnEntranceExitShortestPath: pathCells.has(keyOf(r.center)),
        neighborRoomFunctions: neighborRoomFunctions(r),
      },
      rng,
    )

    if (!FORAGE_PATCH_ITEM_DEF_IDS.has(defId)) {
      const pos = r.center
      if (!isFreeFloor(pos)) continue
      floorItems.push({ defId, pos, qty: 1 })
      occupied.add(keyOf(pos))
      itemSpawnPasses++
      continue
    }

    let anchor: Vec2 | null = null
    if (isFreeFloor(r.center)) anchor = r.center
    else {
      const cells = collectFloorCellsInRect(r.rect, tiles, w, h, occupied, keyOf)
      if (cells.length === 0) continue
      anchor = cells[rng.int(0, cells.length)]!
    }

    const remainingBudget = MAX_PROCgen_POP_FLOOR_ITEMS - floorItems.length
    if (remainingBudget < 1) break
    let want = rng.int(2, 6)
    want = Math.min(want, remainingBudget)

    const patchCells = pickForagePatchCells({
      rect: r.rect,
      anchor,
      tiles,
      w,
      h,
      occupied,
      keyOf,
      rng,
      want,
    })
    if (patchCells.length === 0) continue
    for (const pos of patchCells) {
      floorItems.push({ defId, pos, qty: 1 })
      occupied.add(keyOf(pos))
    }
    itemSpawnPasses++
  }

  occupied.add(keyOf(exit))

  ensureKuratkoInNestRoom({
    npcs,
    occupied,
    rooms,
    tiles,
    w,
    h,
    kuratkoNestPos: args.kuratkoNestPos,
    keyOf,
  })

  return { npcs, floorItems }
}

/** POI ids always emitted by `placePois`. */
export const PROCgen_POI_IDS_ALWAYS = [
  'poi_well',
  'poi_bed',
  'poi_chest',
  'poi_barrel',
  'poi_crate',
  'poi_exit',
] as const

/** POI ids only present when placement heuristics succeed. */
export const PROCgen_POI_IDS_OPTIONAL = ['poi_shrine', 'poi_crackedWall', 'poi_kuratkoNest'] as const
