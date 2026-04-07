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

export function allReachable(tiles: Tile[], w: number, h: number, start: Vec2, targets: Vec2[]): boolean {
  const reach = floodFillReachable(tiles, w, h, start)
  for (const t of targets) {
    if (!inBounds(t, w, h)) return false
    const i = idxOf(t, w)
    if (!reach[i]) return false
  }
  return true
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

