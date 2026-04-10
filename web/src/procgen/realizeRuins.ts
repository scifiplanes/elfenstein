import type { Tile } from '../game/types'
import type { Rng } from './seededRng'
import type { GenRoom } from './types'
import { LEGACY_RUINS_TUNING, type RuinsLayoutTuning } from './floorTopologyTuning'
import { carveRect, center, type Rect } from './layoutPasses'

function idx(x: number, y: number, w: number): number {
  return x + y * w
}

function floorMassNear(tiles: Tile[], w: number, h: number, x: number, y: number): number {
  let m = 0
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx
      const ny = y + dy
      if (nx <= 0 || ny <= 0 || nx >= w - 1 || ny >= h - 1) continue
      if (tiles[idx(nx, ny, w)] === 'floor') m++
    }
  }
  return m
}

function rectDistanceChebyshev(a: GenRoom['rect'], b: GenRoom['rect']): number {
  // 0 means overlap; 1 means touch within one tile gap.
  const ax2 = a.x + a.w - 1
  const ay2 = a.y + a.h - 1
  const bx2 = b.x + b.w - 1
  const by2 = b.y + b.h - 1
  const dx = a.x > bx2 ? a.x - bx2 : b.x > ax2 ? b.x - ax2 : 0
  const dy = a.y > by2 ? a.y - by2 : b.y > ay2 ? b.y - ay2 : 0
  return Math.max(dx, dy)
}

function unionFind(n: number) {
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]!
      x = parent[x]!
    }
    return x
  }
  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[rb] = ra
  }
  return { parent, find, union }
}

function clusterRoomsToMacro(rooms: GenRoom[], maxClusters: number): GenRoom[] {
  if (rooms.length <= 2) return rooms
  const sorted = [...rooms].sort((a, b) => a.id.localeCompare(b.id))
  const uf = unionFind(sorted.length)

  // Adjacency: within a small rect gap. (Stamps are macro-cell sized, so this approximates macro-cell neighbors.)
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (rectDistanceChebyshev(sorted[i]!.rect, sorted[j]!.rect) <= 2) uf.union(i, j)
    }
  }

  const groups = new Map<number, number[]>()
  for (let i = 0; i < sorted.length; i++) {
    const r = uf.find(i)
    const g = groups.get(r) ?? []
    g.push(i)
    groups.set(r, g)
  }

  let comps = Array.from(groups.values()).sort((a, b) => b.length - a.length)

  // If we ended up with too many components, merge the smallest into nearest larger ones by rect distance.
  while (comps.length > maxClusters) {
    const small = comps.pop()
    if (!small?.length) break
    let bestIdx = 0
    let bestD = 1e9
    const sRoom = sorted[small[0]!]!
    for (let i = 0; i < comps.length; i++) {
      const tgt = sorted[comps[i]![0]!]!
      const d = rectDistanceChebyshev(sRoom.rect, tgt.rect)
      if (d < bestD) {
        bestD = d
        bestIdx = i
      }
    }
    comps[bestIdx] = comps[bestIdx]!.concat(small)
  }

  const macro: GenRoom[] = []
  for (let gi = 0; gi < comps.length; gi++) {
    const idxs = comps[gi]!.slice().sort((a, b) => a - b)
    let minX = 1e9,
      minY = 1e9,
      maxX = -1,
      maxY = -1
    let bestCenter = sorted[idxs[0]!]!.center
    let bestArea = -1
    for (const ii of idxs) {
      const r = sorted[ii]!
      minX = Math.min(minX, r.rect.x)
      minY = Math.min(minY, r.rect.y)
      maxX = Math.max(maxX, r.rect.x + r.rect.w - 1)
      maxY = Math.max(maxY, r.rect.y + r.rect.h - 1)
      const a = r.rect.w * r.rect.h
      if (a > bestArea) {
        bestArea = a
        bestCenter = r.center
      }
    }
    const rect = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
    macro.push({ id: `r_macro_${gi}`, rect, center: { ...bestCenter }, leafDepth: 0 })
  }

  // Keep stable output ordering.
  macro.sort((a, b) => a.id.localeCompare(b.id))
  return macro
}

/** Macro-cell stamp: grid of potential chambers with random doorways. */
export function runRuinsLayout(
  w: number,
  h: number,
  rng: Rng,
  tuning: RuinsLayoutTuning = LEGACY_RUINS_TUNING,
): { tiles: Tile[]; genRooms: GenRoom[] } {
  const cell = Math.max(3, Math.min(8, Math.floor(tuning.cellSize)))
  const tiles: Tile[] = Array.from({ length: w * h }, () => 'wall')
  const genRooms: GenRoom[] = []
  const stamped = new Set<string>()

  for (let cy = 1; cy + cell < h - 1; cy += cell) {
    for (let cx = 1; cx + cell < w - 1; cx += cell) {
      if (rng.next() < tuning.stampSkipChance) continue
      const rw = cell - (rng.next() < tuning.shrinkRoomChance ? 1 : 0)
      const rh = cell - (rng.next() < tuning.shrinkRoomChance ? 1 : 0)
      const rx = cx + rng.int(0, Math.max(1, cell - rw))
      const ry = cy + rng.int(0, Math.max(1, cell - rh))
      const room: Rect = { x: rx, y: ry, w: rw, h: rh }
      if (room.x + room.w >= w - 1 || room.y + room.h >= h - 1) continue
      carveRect(tiles, w, room)
      genRooms.push({ id: `r_${genRooms.length}`, rect: { ...room }, center: center(room), leafDepth: 1 })
      stamped.add(`${cx},${cy}`)
    }
  }

  // Doorways between adjacent stamped macro-cells.
  // This is more legible than random “wall punches” because we only connect where
  // there is floor mass on both sides of the boundary.
  for (let cy = 1; cy + cell < h - 1; cy += cell) {
    for (let cx = 1; cx + cell < w - 1; cx += cell) {
      if (!stamped.has(`${cx},${cy}`)) continue

      // Right neighbor
      if (stamped.has(`${cx + cell},${cy}`) && rng.next() < tuning.doorwayChance) {
        const by = cy + 1 + rng.int(0, Math.max(1, cell - 2))
        const ax = cx + cell - 1
        const bx = cx + cell
        const leftMass = floorMassNear(tiles, w, h, ax - 1, by)
        const rightMass = floorMassNear(tiles, w, h, bx + 1, by)
        if (leftMass >= 5 && rightMass >= 5) {
          tiles[idx(ax, by, w)] = 'floor'
          tiles[idx(bx, by, w)] = 'floor'
        }
      }

      // Down neighbor
      if (stamped.has(`${cx},${cy + cell}`) && rng.next() < tuning.doorwayChance) {
        const bx = cx + 1 + rng.int(0, Math.max(1, cell - 2))
        const ay = cy + cell - 1
        const by = cy + cell
        const upMass = floorMassNear(tiles, w, h, bx, ay - 1)
        const downMass = floorMassNear(tiles, w, h, bx, by + 1)
        if (upMass >= 5 && downMass >= 5) {
          tiles[idx(bx, ay, w)] = 'floor'
          tiles[idx(bx, by, w)] = 'floor'
        }
      }
    }
  }

  if (!genRooms.length) {
    const room: Rect = { x: Math.max(1, Math.floor(w / 2) - 4), y: Math.max(1, Math.floor(h / 2) - 4), w: 8, h: 8 }
    carveRect(tiles, w, room)
    genRooms.push({ id: 'r_0', rect: { ...room }, center: center(room), leafDepth: 0 })
  }

  const maxMacro = Math.max(2, Math.min(24, Math.floor(tuning.maxMacroClusters)))
  const macroRooms = clusterRoomsToMacro(genRooms, maxMacro)
  return { tiles, genRooms: macroRooms }
}
