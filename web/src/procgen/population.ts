import { npcKindHpMax } from '../game/content/npcCombat'
import { cellKey } from '../game/state/playerFloorCell'
import type { FloorPoi, ItemDefId, NpcLanguage, Tile, Vec2 } from '../game/types'
import type { Rng } from './seededRng'
import type { FloorProperty, FloorType, GenNpc, GenRoom } from './types'
import { pickFloorItemDefFromTable, pickNpcKindFromTable } from './spawnTables'
import { shortestPathIndices } from './locks'
import { bfsDistances, exitNeighborReachableWithPoiBlocking, floorCellTouchesOrthogonalWall } from './validate'
import { findNearestFloor, pickClosestDistanceCell, pickFarthestUnusedFloor } from './layoutPasses'
import { buildRoomAdjacency } from './districtsTags'

function shortestPathCellSet(tiles: Tile[], w: number, h: number, entrance: Vec2, exit: Vec2): Set<string> {
  const path = shortestPathIndices(tiles, w, h, entrance, exit)
  if (!path) return new Set()
  const s = new Set<string>()
  for (const idx of path) {
    s.add(`${idx % w},${((idx / w) | 0)}`)
  }
  return s
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
}): FloorPoi[] {
  const { tiles, w, h, rooms, entrance, exit } = args
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
  const isBedRoomOk = (r: GenRoom) => {
    const f = r.tags?.roomFunction
    const p = r.tags?.roomProperties
    // Keep bed out of connector/junction rooms (pre-tagged Passage).
    if (r.id.startsWith('r_junc_')) return false
    return (f === 'Habitat' || f === 'Communal') && p !== 'Burning' && p !== 'Infected'
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
    const p = r.tags?.roomProperties
    if (p === 'Burning' || p === 'Infected') return false
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

  const exitPos = ok(exit) ? exit : (findNearestFloor(tiles, w, h, exit) ?? exit)
  markUsed(exitPos)

  return [
    { id: 'poi_well', kind: 'Well', pos: wellPos },
    { id: 'poi_bed', kind: 'Bed', pos: bedPos },
    { id: 'poi_chest', kind: 'Chest', pos: chestPos, opened: false },
    { id: 'poi_barrel', kind: 'Barrel', pos: barrelPos, opened: false },
    { id: 'poi_crate', kind: 'Crate', pos: cratePos, opened: false },
    ...(shrinePos ? ([{ id: 'poi_shrine', kind: 'Shrine', pos: shrinePos }] as const) : []),
    ...(crackedPos ? ([{ id: 'poi_crackedWall', kind: 'CrackedWall', pos: crackedPos }] as const) : []),
    { id: 'poi_exit', kind: 'Exit', pos: exitPos },
  ]
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
}): { npcs: GenNpc[]; floorItems: Array<{ defId: ItemDefId; pos: Vec2; qty?: number }> } {
  const { tiles, w, h, rooms, entrance, exit, occupied, rng, floorType } = args
  const floorProperties = args.floorProperties ?? []

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
    .filter((r) => isFreeFloor(r.center))
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

  const npcRooms = candidates.slice(0, Math.min(4, candidates.length)).map((x) => x.r)
  const nearRooms = candidates.slice(-Math.min(2, candidates.length)).map((x) => x.r)

  const langList: NpcLanguage[] = ['DeepGnome', 'Zalgo', 'Mojibake']
  const wants: ItemDefId[] = ['Mushrooms', 'Foodroot', 'Ash', 'Sulfur', 'Stick', 'Stone']
  const hated: ItemDefId[] = ['Stone', 'Stick', 'Mushrooms', 'Foodroot']

  const pickQuest = (i: number) => {
    const wId = wants[i % wants.length]
    const h1 = hated[(i + 1) % hated.length]
    const h2 = hated[(i + 2) % hated.length]
    const hs = Array.from(new Set([h1, h2].filter((x) => x !== wId)))
    return { wants: wId, hated: hs.length ? hs : ['Stone'] }
  }

  const npcFromRoom = (room: GenRoom, idx: number, isNear: boolean): GenNpc | null => {
    const pos = room.center
    if (!isFreeFloor(pos)) return null
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

    const status: GenNpc['status'] = kind === 'Skeleton' ? 'hostile' : isNear ? 'neutral' : rng.next() < 0.25 ? 'hostile' : 'neutral'
    const language = langList[(idx * 17 + (kind.charCodeAt(0) % 7)) % langList.length]
    const name = kind
    const hpMax = npcKindHpMax(kind)
    const hp = hpMax
    return {
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
  }

  let idx = 0
  for (const r of npcRooms) {
    if (npcs.length >= 3) break
    const npc = npcFromRoom(r, idx++, false)
    if (!npc) continue
    npcs.push(npc)
    occupied.add(keyOf(npc.pos))
  }
  for (const r of nearRooms) {
    if (npcs.length >= 4) break
    const npc = npcFromRoom(r, idx++, true)
    if (!npc) continue
    if (npcs.some((n) => n.status !== 'hostile')) break
    npcs.push(npc)
    occupied.add(keyOf(npc.pos))
  }

  const itemRooms = candidates
    .filter((x) => x.d > 0)
    .map((x) => x.r)
    .slice(0, 6)
  for (const r of itemRooms) {
    if (floorItems.length >= 4) break
    const defId = pickFloorItemDefFromTable(
      { floorProperties, room: r, isOnEntranceExitShortestPath: pathCells.has(keyOf(r.center)), neighborRoomFunctions: neighborRoomFunctions(r) },
      rng,
    )
    const pos = r.center
    if (!isFreeFloor(pos)) continue
    floorItems.push({ defId, pos, qty: 1 })
    occupied.add(keyOf(pos))
  }

  occupied.add(keyOf(exit))

  return { npcs, floorItems }
}

/** Item defs referenced in neutral NPC `quest.wants` / `quest.hated` (procgen population). */
export const PROCgen_NPC_QUEST_WANT_ITEM_DEF_IDS: readonly ItemDefId[] = [
  'Mushrooms',
  'Foodroot',
  'Ash',
  'Sulfur',
  'Stick',
  'Stone',
]
export const PROCgen_NPC_QUEST_HATED_ITEM_DEF_IDS: readonly ItemDefId[] = ['Stone', 'Stick', 'Mushrooms', 'Foodroot']

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
export const PROCgen_POI_IDS_OPTIONAL = ['poi_shrine', 'poi_crackedWall'] as const
