import { cellKey, nearestFloorCellAvoidingBlocked } from '../game/state/playerFloorCell'
import type { Tile, Vec2 } from '../game/types'

export function inBounds(pos: Vec2, w: number, h: number): boolean {
  return pos.x >= 0 && pos.y >= 0 && pos.x < w && pos.y < h
}

export function idxOf(pos: Vec2, w: number): number {
  return pos.x + pos.y * w
}

export function isWalkable(t: Tile): boolean {
  // Doors are treated as walkable space for reachability checks (locked logic is handled separately).
  return t === 'floor' || t === 'door' || t === 'lockedDoor'
}

export function isWalkableWithLocks(t: Tile, opts: { lockedDoorsAreWalkable: boolean }): boolean {
  if (t === 'floor' || t === 'door') return true
  if (t === 'lockedDoor') return opts.lockedDoorsAreWalkable
  return false
}

/** Orthogonal neighbor is `wall`, or the map edge in that direction (treated as wall). Doors are not walls. */
export function floorCellTouchesOrthogonalWall(tiles: Tile[], w: number, h: number, pos: Vec2): boolean {
  const { x, y } = pos
  const i = x + y * w
  const north = y > 0 ? tiles[i - w] : 'wall'
  const south = y < h - 1 ? tiles[i + w] : 'wall'
  const east = x < w - 1 ? tiles[i + 1] : 'wall'
  const west = x > 0 ? tiles[i - 1] : 'wall'
  return north === 'wall' || south === 'wall' || east === 'wall' || west === 'wall'
}

export function floodFillReachable(tiles: Tile[], w: number, h: number, start: Vec2): boolean[] {
  const out = Array.from({ length: tiles.length }, () => false)
  if (!inBounds(start, w, h)) return out
  const startIdx = idxOf(start, w)
  if (startIdx < 0 || startIdx >= tiles.length) return out
  if (!isWalkable(tiles[startIdx])) return out

  const qx: number[] = [start.x]
  const qy: number[] = [start.y]
  out[startIdx] = true

  for (let qi = 0; qi < qx.length; qi++) {
    const x = qx[qi]
    const y = qy[qi]
    const n = [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ]
    for (const p of n) {
      if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) continue
      const i = p.x + p.y * w
      if (out[i]) continue
      if (!isWalkable(tiles[i])) continue
      out[i] = true
      qx.push(p.x)
      qy.push(p.y)
    }
  }

  return out
}

export function floodFillReachableWithLocks(
  tiles: Tile[],
  w: number,
  h: number,
  start: Vec2,
  opts: { lockedDoorsAreWalkable: boolean },
): boolean[] {
  const out = Array.from({ length: tiles.length }, () => false)
  if (!inBounds(start, w, h)) return out
  const startIdx = idxOf(start, w)
  if (startIdx < 0 || startIdx >= tiles.length) return out
  if (!isWalkableWithLocks(tiles[startIdx], opts)) return out

  const qx: number[] = [start.x]
  const qy: number[] = [start.y]
  out[startIdx] = true

  for (let qi = 0; qi < qx.length; qi++) {
    const x = qx[qi]
    const y = qy[qi]
    const n = [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ]
    for (const p of n) {
      if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) continue
      const i = p.x + p.y * w
      if (out[i]) continue
      if (!isWalkableWithLocks(tiles[i], opts)) continue
      out[i] = true
      qx.push(p.x)
      qy.push(p.y)
    }
  }

  return out
}

export function allReachableWithLocks(
  tiles: Tile[],
  w: number,
  h: number,
  start: Vec2,
  targets: Vec2[],
  opts: { lockedDoorsAreWalkable: boolean },
): boolean {
  const reach = floodFillReachableWithLocks(tiles, w, h, start, opts)
  for (const t of targets) {
    if (!inBounds(t, w, h)) return false
    const i = idxOf(t, w)
    if (!reach[i]) return false
  }
  return true
}

export function allReachable(tiles: Tile[], w: number, h: number, start: Vec2, targets: Vec2[]): boolean {
  const reach = floodFillReachable(tiles, w, h, start)
  for (const t of targets) {
    if (!inBounds(t, w, h)) return false
    const i = idxOf(t, w)
    if (!reach[i]) return false
  }
  return true
}

/**
 * True when the player can reach at least one orthogonal neighbor of `exit` (to use the Exit POI)
 * after nudging off the entrance if it is blocked, using `isWalkable` tiles except those in
 * `poiBlockedKeys`, and always treating the exit cell as non-traversable (stairs PoI blocks it).
 */
export function exitNeighborReachableWithPoiBlocking(
  tiles: Tile[],
  w: number,
  h: number,
  entrance: Vec2,
  exit: Vec2,
  poiBlockedKeys: ReadonlySet<string>,
): boolean {
  const blocked = new Set(poiBlockedKeys)
  blocked.add(cellKey(exit.x, exit.y))

  const spawn = nearestFloorCellAvoidingBlocked(tiles, w, h, entrance, blocked)
  const sx = spawn.x
  const sy = spawn.y
  if (!inBounds(spawn, w, h)) return false
  const startIdx = sx + sy * w
  if (startIdx < 0 || startIdx >= tiles.length || !isWalkable(tiles[startIdx]) || blocked.has(cellKey(sx, sy))) {
    return false
  }

  const seen = new Uint8Array(tiles.length)
  const qx: number[] = [sx]
  const qy: number[] = [sy]
  seen[startIdx] = 1

  for (let qi = 0; qi < qx.length; qi++) {
    const x = qx[qi]!
    const y = qy[qi]!
    const neigh = [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ]
    for (const p of neigh) {
      if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) continue
      const j = p.x + p.y * w
      if (seen[j]) continue
      if (!isWalkable(tiles[j])) continue
      if (blocked.has(cellKey(p.x, p.y))) continue
      seen[j] = 1
      qx.push(p.x)
      qy.push(p.y)
    }
  }

  const exitNeighbors: Vec2[] = [
    { x: exit.x + 1, y: exit.y },
    { x: exit.x - 1, y: exit.y },
    { x: exit.x, y: exit.y + 1 },
    { x: exit.x, y: exit.y - 1 },
  ]
  for (const t of exitNeighbors) {
    if (!inBounds(t, w, h)) continue
    const ti = idxOf(t, w)
    if (ti < 0 || ti >= tiles.length || !isWalkable(tiles[ti]) || blocked.has(cellKey(t.x, t.y))) continue
    if (seen[ti]) return true
  }
  return false
}

/** Cells on any shortest entrance→exit path satisfy distFromEntrance + distFromExit === shortestLen. */
export function shortestPathLatticeStats(
  tiles: Tile[],
  w: number,
  h: number,
  entrance: Vec2,
  exit: Vec2,
): { shortestLen: number; latticeCells: number } {
  const distE = bfsDistances(tiles, w, h, entrance)
  const distX = bfsDistances(tiles, w, h, exit)
  const exitIdx = idxOf(exit, w)
  const L = exitIdx >= 0 && exitIdx < distE.length ? distE[exitIdx] : -1
  if (L < 0) return { shortestLen: -1, latticeCells: 0 }
  let latticeCells = 0
  for (let i = 0; i < tiles.length; i++) {
    if (!isWalkable(tiles[i])) continue
    const de = distE[i]
    const dx = distX[i]
    if (de >= 0 && dx >= 0 && de + dx === L) latticeCells++
  }
  return { shortestLen: L, latticeCells }
}

export function bfsDistances(tiles: Tile[], w: number, h: number, start: Vec2): Int32Array {
  const dist = new Int32Array(tiles.length)
  dist.fill(-1)
  if (!inBounds(start, w, h)) return dist
  const startIdx = idxOf(start, w)
  if (startIdx < 0 || startIdx >= tiles.length) return dist
  if (!isWalkable(tiles[startIdx])) return dist

  const q: number[] = [startIdx]
  dist[startIdx] = 0

  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi]
    const x = i % w
    const y = (i / w) | 0
    const base = dist[i]
    const neigh = [
      i + 1,
      i - 1,
      i + w,
      i - w,
    ]
    for (const j of neigh) {
      if (j < 0 || j >= tiles.length) continue
      const nx = j % w
      const ny = (j / w) | 0
      if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue
      if (dist[j] !== -1) continue
      if (!isWalkable(tiles[j])) continue
      dist[j] = base + 1
      q.push(j)
    }
  }

  return dist
}

