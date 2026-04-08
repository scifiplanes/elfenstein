import type { Tile, Vec2 } from '../game/types'
import type { Rng } from './seededRng'
import { bfsDistances, floodFillReachable, inBounds, isWalkable, shortestPathLatticeStats } from './validate'
import type { GenRoom } from './types'

export type Rect = { x: number; y: number; w: number; h: number }

export function center(r: Rect): Vec2 {
  return { x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) }
}

export function carveRect(tiles: Tile[], w: number, r: Rect) {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      tiles[x + y * w] = 'floor'
    }
  }
}

export function carveCorridor(tiles: Tile[], w: number, ax: number, ay: number, bx: number, by: number, horizFirst: boolean) {
  if (horizFirst) {
    carveLine(tiles, w, ax, ay, bx, ay)
    carveLine(tiles, w, bx, ay, bx, by)
  } else {
    carveLine(tiles, w, ax, ay, ax, by)
    carveLine(tiles, w, ax, by, bx, by)
  }
}

function carveLineThick(tiles: Tile[], w: number, h: number, x0: number, y0: number, x1: number, y1: number, ox: number, oy: number) {
  const dx = Math.sign(x1 - x0)
  const dy = Math.sign(y1 - y0)
  let x = x0
  let y = y0
  const stamp = (sx: number, sy: number) => {
    if (sx <= 0 || sy <= 0 || sx >= w - 1 || sy >= h - 1) return
    tiles[sx + sy * w] = 'floor'
    const tx = sx + ox
    const ty = sy + oy
    if (tx <= 0 || ty <= 0 || tx >= w - 1 || ty >= h - 1) return
    tiles[tx + ty * w] = 'floor'
  }
  stamp(x, y)
  while (x !== x1 || y !== y1) {
    if (x !== x1) x += dx
    if (y !== y1) y += dy
    stamp(x, y)
  }
}

/**
 * Carves a 2-wide L corridor by thickening the carved line by one tile in a deterministic direction.
 * Offsets `ox/oy` should be one of {±1,0} or {0,±1}.
 */
export function carveCorridorThick(
  tiles: Tile[],
  w: number,
  h: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  horizFirst: boolean,
  ox: number,
  oy: number,
) {
  if (horizFirst) {
    carveLineThick(tiles, w, h, ax, ay, bx, ay, ox, oy)
    carveLineThick(tiles, w, h, bx, ay, bx, by, ox, oy)
  } else {
    carveLineThick(tiles, w, h, ax, ay, ax, by, ox, oy)
    carveLineThick(tiles, w, h, ax, by, bx, by, ox, oy)
  }
}

export function carveLine(tiles: Tile[], w: number, x0: number, y0: number, x1: number, y1: number) {
  const dx = Math.sign(x1 - x0)
  const dy = Math.sign(y1 - y0)
  let x = x0
  let y = y0
  tiles[x + y * w] = 'floor'
  while (x !== x1 || y !== y1) {
    if (x !== x1) x += dx
    if (y !== y1) y += dy
    tiles[x + y * w] = 'floor'
  }
}

export function isGoodSpawn(tiles: Tile[], w: number, h: number, pos: Vec2): boolean {
  if (!inBounds(pos, w, h)) return false
  const t = tiles[pos.x + pos.y * w]
  return isWalkable(t)
}

export function randomFloorCell(args: { tiles: Tile[]; w: number; h: number; rng: Pick<Rng, 'int'> }): Vec2 | null {
  const { tiles, w, h, rng } = args
  for (let i = 0; i < 200; i++) {
    const x = rng.int(1, Math.max(2, w - 1))
    const y = rng.int(1, Math.max(2, h - 1))
    const t = tiles[x + y * w]
    if (t === 'floor') return { x, y }
  }
  return null
}

export function pickEntranceExit(args: {
  tiles: Tile[]
  w: number
  h: number
  rooms: GenRoom[]
  rng: Pick<Rng, 'int' | 'next'>
}): { entrance: Vec2; exit: Vec2 } {
  const { tiles, w, h, rooms, rng } = args

  const preferred = rooms.length ? rooms[rng.int(0, rooms.length)].center : null
  const entrance =
    preferred && isGoodSpawn(tiles, w, h, preferred) ? preferred : (randomFloorCell({ tiles, w, h, rng }) ?? { x: 1, y: 1 })

  const dist = bfsDistances(tiles, w, h, entrance)
  let bestIdx = entrance.x + entrance.y * w
  let bestD = -1
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i]
    if (d > bestD && tiles[i] === 'floor') {
      bestD = d
      bestIdx = i
    }
  }
  const exit = { x: bestIdx % w, y: Math.floor(bestIdx / w) }
  return { entrance: { ...entrance }, exit: { ...exit } }
}

export function repairConnectivity(tiles: Tile[], w: number, h: number, rng: Pick<Rng, 'int' | 'next'>) {
  let startIdx = -1
  for (let i = 0; i < tiles.length; i++) {
    if (isWalkable(tiles[i])) {
      startIdx = i
      break
    }
  }
  if (startIdx < 0) return
  const start = { x: startIdx % w, y: Math.floor(startIdx / w) }

  for (let pass = 0; pass < 24; pass++) {
    const reach = floodFillReachable(tiles, w, h, start)
    let unreachableIdx = -1
    for (let i = 0; i < tiles.length; i++) {
      if (isWalkable(tiles[i]) && !reach[i]) {
        unreachableIdx = i
        break
      }
    }
    if (unreachableIdx < 0) return

    const target = { x: unreachableIdx % w, y: Math.floor(unreachableIdx / w) }
    const anchor = findNearestReachable(reach, w, h, target)
    if (!anchor) return
    carveCorridor(tiles, w, anchor.x, anchor.y, target.x, target.y, rng.next() < 0.5)
  }
}

function manhattan(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

export function countReachableFloorJunctions(
  tiles: Tile[],
  w: number,
  h: number,
  start: Vec2,
): { reachableFloors: number; junctions: number } {
  const reach = floodFillReachable(tiles, w, h, start)
  let reachableFloors = 0
  let junctions = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = x + y * w
      if (!reach[i] || tiles[i] !== 'floor') continue
      reachableFloors++
      let n = 0
      if (isWalkable(tiles[i + 1])) n++
      if (isWalkable(tiles[i - 1])) n++
      if (isWalkable(tiles[i + w])) n++
      if (isWalkable(tiles[i - w])) n++
      if (n >= 3) junctions++
    }
  }
  return { reachableFloors, junctions }
}

export function countReachableDeadEnds(tiles: Tile[], w: number, h: number, start: Vec2): number {
  const reach = floodFillReachable(tiles, w, h, start)
  let deadEnds = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = x + y * w
      if (!reach[i] || tiles[i] !== 'floor') continue
      let n = 0
      if (isWalkable(tiles[i + 1])) n++
      if (isWalkable(tiles[i - 1])) n++
      if (isWalkable(tiles[i + w])) n++
      if (isWalkable(tiles[i - w])) n++
      if (n <= 1) deadEnds++
    }
  }
  return deadEnds
}

function pointInRect(p: Vec2, r: { x: number; y: number; w: number; h: number }): boolean {
  return p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h
}

function nearestRoomIndexByCenter(rooms: GenRoom[], p: Vec2): number {
  let best = -1
  let bestD = 1e9
  for (let i = 0; i < rooms.length; i++) {
    const c = rooms[i].center
    const d = Math.abs(c.x - p.x) + Math.abs(c.y - p.y)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

function roomIndexForPoint(rooms: GenRoom[], p: Vec2): number {
  for (let i = 0; i < rooms.length; i++) {
    if (pointInRect(p, rooms[i].rect)) return i
  }
  return nearestRoomIndexByCenter(rooms, p)
}

function corridorSampleStats(args: {
  tiles: Tile[]
  w: number
  ax: number
  ay: number
  bx: number
  by: number
  horizFirst: boolean
}): { total: number; alreadyFloor: number } {
  const { tiles, w, ax, ay, bx, by, horizFirst } = args
  let total = 0
  let alreadyFloor = 0
  const count = (x: number, y: number) => {
    total++
    const t = tiles[x + y * w]
    if (t === 'floor' || t === 'door' || t === 'lockedDoor') alreadyFloor++
  }
  if (horizFirst) {
    const dx = Math.sign(bx - ax)
    for (let x = ax; x !== bx; x += dx) count(x, ay)
    count(bx, ay)
    const dy = Math.sign(by - ay)
    for (let y = ay; y !== by; y += dy) count(bx, y)
    count(bx, by)
  } else {
    const dy = Math.sign(by - ay)
    for (let y = ay; y !== by; y += dy) count(ax, y)
    count(ax, by)
    const dx = Math.sign(bx - ax)
    for (let x = ax; x !== bx; x += dx) count(x, by)
    count(bx, by)
  }
  return { total, alreadyFloor }
}

/**
 * Deterministically carve a small number of extra connectors (loops) to widen the
 * entrance→exit shortest-path lattice and reduce “single spine” layouts.
 *
 * This mutates `tiles` in place and should run on the `streams.layout` RNG.
 */
export function injectLoops(args: {
  tiles: Tile[]
  w: number
  h: number
  rooms: GenRoom[]
  entrance: Vec2
  exit: Vec2
  rng: Pick<Rng, 'int' | 'next'>
  maxLoops?: number
}): { added: number } {
  const { tiles, w, h, rooms, entrance, exit, rng } = args
  if (w <= 0 || h <= 0 || tiles.length !== w * h) return { added: 0 }

  const maxLoops = Math.max(0, Math.min(6, Math.floor(args.maxLoops ?? 2)))
  if (maxLoops === 0) return { added: 0 }

  const keyOf = (p: Vec2) => `${p.x},${p.y}`
  const candidates: Vec2[] = []
  const seen = new Set<string>()
  const push = (p: Vec2) => {
    if (!inBounds(p, w, h)) return
    if (tiles[p.x + p.y * w] !== 'floor') return
    const k = keyOf(p)
    if (seen.has(k)) return
    seen.add(k)
    candidates.push({ ...p })
  }

  // Primary candidates: room centers
  for (const r of rooms) push(r.center)

  // Secondary candidates: a handful of random floor cells (bounded attempts)
  for (let i = 0; i < 14; i++) {
    const p = randomFloorCell({ tiles, w, h, rng })
    if (p) push(p)
  }

  if (candidates.length < 2) return { added: 0 }

  const base = shortestPathLatticeStats(tiles, w, h, entrance, exit)
  let bestWideness = base.shortestLen >= 0 ? base.latticeCells - base.shortestLen : 0
  const baseJ = countReachableFloorJunctions(tiles, w, h, entrance).junctions
  let bestJ = baseJ
  const baseDeadEnds = countReachableDeadEnds(tiles, w, h, entrance)
  let bestDeadEnds = baseDeadEnds

  let added = 0
  const minD = Math.max(5, Math.min(12, Math.floor((w + h) / 6)))
  const maxD = Math.max(minD + 4, Math.min(w + h, Math.floor((w + h) * 0.75)))

  const maxTries = 48 + maxLoops * 28
  for (let attempt = 0; attempt < maxTries && added < maxLoops; attempt++) {
    const a = candidates[rng.int(0, candidates.length)]
    const b = candidates[rng.int(0, candidates.length)]
    if (a.x === b.x && a.y === b.y) continue

    const d = manhattan(a, b)
    if (d < minD || d > maxD) continue

    // Prefer connecting distinct rooms when room data exists (reduces “micro-loops” inside one room).
    if (rooms.length >= 2) {
      const ra = roomIndexForPoint(rooms, a)
      const rb = roomIndexForPoint(rooms, b)
      if (ra === rb && rng.next() < 0.8) continue
    }

    const horizFirst = rng.next() < 0.5
    const sample = corridorSampleStats({ tiles, w, ax: a.x, ay: a.y, bx: b.x, by: b.y, horizFirst })
    const alreadyRatio = sample.total > 0 ? sample.alreadyFloor / sample.total : 1
    if (alreadyRatio > 0.6) continue

    const beforeTiles = tiles.slice()
    // Occasionally carve 2-wide connectors for spatial variety (kept rare and deterministic).
    const thick = rng.next() < 0.15
    if (thick) {
      // Pick a deterministic thickening direction (avoid diagonals).
      const dir = rng.int(0, 4)
      const ox = dir === 0 ? 1 : dir === 1 ? -1 : 0
      const oy = dir === 2 ? 1 : dir === 3 ? -1 : 0
      carveCorridorThick(tiles, w, h, a.x, a.y, b.x, b.y, horizFirst, ox, oy)
    } else {
      carveCorridor(tiles, w, a.x, a.y, b.x, b.y, horizFirst)
    }

    const after = shortestPathLatticeStats(tiles, w, h, entrance, exit)
    const afterWideness = after.shortestLen >= 0 ? after.latticeCells - after.shortestLen : 0
    const afterJ = countReachableFloorJunctions(tiles, w, h, entrance).junctions
    const afterDeadEnds = countReachableDeadEnds(tiles, w, h, entrance)

    const widened = afterWideness > bestWideness
    const moreJunctions = afterJ > bestJ
    const fewerDeadEnds = afterDeadEnds < bestDeadEnds

    if (widened || moreJunctions || fewerDeadEnds) {
      added++
      bestWideness = Math.max(bestWideness, afterWideness)
      bestJ = Math.max(bestJ, afterJ)
      bestDeadEnds = Math.min(bestDeadEnds, afterDeadEnds)
      continue
    }

    // Revert if it didn't help.
    for (let i = 0; i < tiles.length; i++) tiles[i] = beforeTiles[i]
  }

  return { added }
}

export function findNearestReachable(reach: boolean[], w: number, h: number, target: Vec2): Vec2 | null {
  const maxR = w + h
  for (let r = 1; r <= maxR; r++) {
    for (let dx = -r; dx <= r; dx++) {
      const dy = r - Math.abs(dx)
      const cand = [
        { x: target.x + dx, y: target.y + dy },
        { x: target.x + dx, y: target.y - dy },
      ]
      for (const p of cand) {
        if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) continue
        const i = p.x + p.y * w
        if (reach[i]) return p
      }
    }
  }
  return null
}

export function smoothWallsCarveOnly(tiles: Tile[], w: number, h: number, passes: number) {
  const p = Math.max(0, Math.min(4, Math.floor(passes)))
  if (p === 0) return
  for (let pass = 0; pass < p; pass++) {
    const next = tiles.slice()
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = x + y * w
        if (tiles[i] !== 'wall') continue
        let floors = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            const t = tiles[(x + dx) + (y + dy) * w]
            if (t === 'floor' || t === 'door' || t === 'lockedDoor') floors++
          }
        }
        if (floors >= 6) next[i] = 'floor'
      }
    }
    for (let i = 0; i < tiles.length; i++) tiles[i] = next[i]
  }
}

export function findNearestFloor(tiles: Tile[], w: number, h: number, start: Vec2): Vec2 | null {
  const maxR = w + h
  for (let r = 0; r <= maxR; r++) {
    for (let dx = -r; dx <= r; dx++) {
      const dy = r - Math.abs(dx)
      const cand = [
        { x: start.x + dx, y: start.y + dy },
        { x: start.x + dx, y: start.y - dy },
      ]
      for (const p of cand) {
        if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) continue
        if (tiles[p.x + p.y * w] === 'floor') return p
      }
    }
  }
  return null
}

export function findNearestUnusedFloor(
  tiles: Tile[],
  w: number,
  h: number,
  start: Vec2,
  occupied: Set<string>,
): Vec2 | null {
  const maxR = w + h
  for (let r = 0; r <= maxR; r++) {
    for (let dx = -r; dx <= r; dx++) {
      const dy = r - Math.abs(dx)
      const cand = [
        { x: start.x + dx, y: start.y + dy },
        { x: start.x + dx, y: start.y - dy },
      ]
      for (const p of cand) {
        if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) continue
        if (tiles[p.x + p.y * w] !== 'floor') continue
        if (occupied.has(`${p.x},${p.y}`)) continue
        return p
      }
    }
  }
  return null
}

export function pickClosestDistanceCell(
  dist: Int32Array,
  tiles: Tile[],
  w: number,
  targetD: number,
  used: Set<string>,
): Vec2 | null {
  let bestIdx = -1
  let bestErr = 1e9
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i]
    if (d < 0) continue
    if (tiles[i] !== 'floor') continue
    const x = i % w
    const y = Math.floor(i / w)
    if (used.has(`${x},${y}`)) continue
    const err = Math.abs(d - targetD)
    if (err < bestErr) {
      bestErr = err
      bestIdx = i
    }
  }
  if (bestIdx < 0) return null
  return { x: bestIdx % w, y: Math.floor(bestIdx / w) }
}

export function pickFarthestUnusedFloor(dist: Int32Array, tiles: Tile[], w: number, used: Set<string>): Vec2 | null {
  let bestIdx = -1
  let bestD = -1
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i]
    if (d <= bestD) continue
    if (tiles[i] !== 'floor') continue
    const x = i % w
    const y = Math.floor(i / w)
    if (used.has(`${x},${y}`)) continue
    bestD = d
    bestIdx = i
  }
  if (bestIdx < 0) return null
  return { x: bestIdx % w, y: Math.floor(bestIdx / w) }
}
