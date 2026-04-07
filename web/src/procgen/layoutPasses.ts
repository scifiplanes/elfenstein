import type { Tile, Vec2 } from '../game/types'
import type { Rng } from './seededRng'
import { bfsDistances, floodFillReachable, inBounds, isWalkable } from './validate'
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
