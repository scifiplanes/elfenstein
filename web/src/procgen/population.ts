import type { FloorPoi, ItemDefId, NpcLanguage, Tile, Vec2 } from '../game/types'
import type { Rng } from './seededRng'
import type { FloorProperty, FloorType, GenNpc, GenRoom } from './types'
import { pickFloorItemDefFromTable, pickNpcKindFromTable } from './spawnTables'
import { shortestPathIndices } from './locks'
import { bfsDistances } from './validate'
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
}): FloorPoi[] {
  const { tiles, w, h, rooms, entrance, exit } = args

  const used = new Set<string>()
  const markUsed = (p: Vec2) => used.add(`${p.x},${p.y}`)
  const ok = (p: Vec2) => p.x >= 0 && p.y >= 0 && p.x < w && p.y < h && tiles[p.x + p.y * w] === 'floor' && !used.has(`${p.x},${p.y}`)

  const wellPos = ok(entrance) ? entrance : (findNearestFloor(tiles, w, h, entrance) ?? entrance)
  markUsed(wellPos)

  const dist = bfsDistances(tiles, w, h, entrance)

  const pickStorageLikePos = (fallback: Vec2) => {
    const storageRooms = rooms
      .filter((r) => r.tags?.roomFunction === 'Storage')
      .sort((a, b) => a.rect.w * a.rect.h - (b.rect.w * b.rect.h))
    for (const r of storageRooms) {
      if (ok(r.center)) return r.center
    }
    return pickFarthestUnusedFloor(dist, tiles, w, used) ?? fallback
  }
  const exitIdx = exit.x + exit.y * w
  const maxD = exitIdx >= 0 && exitIdx < dist.length ? dist[exitIdx] : -1
  const targetD = Math.max(0, Math.floor(maxD * 0.45))
  const isBedRoomOk = (r: GenRoom) => {
    const f = r.tags?.roomFunction
    const p = r.tags?.roomProperties
    return (f === 'Habitat' || f === 'Communal') && p !== 'Burning' && p !== 'Infected'
  }
  const bedCandidateRooms = rooms
    .filter((r) => isBedRoomOk(r) && ok(r.center))
    .map((r) => r.center)
  let bedPos: Vec2 | null = null
  if (bedCandidateRooms.length) {
    let best: Vec2 | null = null
    let bestErr = 1e9
    for (const p of bedCandidateRooms) {
      const i = p.x + p.y * w
      const d = i >= 0 && i < dist.length ? dist[i] : -1
      if (d < 0) continue
      const err = Math.abs(d - targetD)
      if (err < bestErr) {
        bestErr = err
        best = p
      }
    }
    bedPos = best
  }
  bedPos = bedPos ?? pickClosestDistanceCell(dist, tiles, w, targetD, used) ?? wellPos
  markUsed(bedPos)

  const pathCells = shortestPathCellSet(tiles, w, h, entrance, exit)

  const storageRooms = rooms
    .filter((r) => r.tags?.roomFunction === 'Storage')
    .sort((a, b) => a.rect.w * a.rect.h - (b.rect.w * b.rect.h))
  let chestPos: Vec2 | null = null
  for (const r of storageRooms) {
    if (ok(r.center)) {
      // Prefer off-path storage so chest feels like a side objective.
      if (!pathCells.has(`${r.center.x},${r.center.y}`)) {
        chestPos = r.center
        break
      }
      if (!chestPos) chestPos = r.center
    }
  }
  if (!chestPos) {
    chestPos = pickFarthestUnusedFloor(dist, tiles, w, used) ?? bedPos
  }
  markUsed(chestPos)

  const barrelPos = pickStorageLikePos(chestPos)
  markUsed(barrelPos)

  const cratePos = pickStorageLikePos(barrelPos)
  markUsed(cratePos)

  const exitPos = ok(exit) ? exit : (findNearestFloor(tiles, w, h, exit) ?? exit)
  markUsed(exitPos)

  return [
    { id: 'poi_well', kind: 'Well', pos: wellPos },
    { id: 'poi_bed', kind: 'Bed', pos: bedPos },
    { id: 'poi_chest', kind: 'Chest', pos: chestPos, opened: false },
    { id: 'poi_barrel', kind: 'Barrel', pos: barrelPos, opened: false },
    { id: 'poi_crate', kind: 'Crate', pos: cratePos, opened: false },
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
    const hp = kind === 'Skeleton' ? 18 : kind === 'Bobr' ? 24 : kind === 'Catoctopus' ? 22 : 20
    return {
      id: `g_npc_${kind}_${idx}_${pos.x}_${pos.y}`,
      kind,
      name,
      pos,
      status,
      hp,
      language,
      quest: status === 'hostile' ? undefined : pickQuest(idx),
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
