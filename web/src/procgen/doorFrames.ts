import type { Tile, Vec2 } from '../game/types'
import type { Rng } from './seededRng'
import { floodFillReachable, isWalkable } from './validate'

function idx(x: number, y: number, w: number): number {
  return x + y * w
}

function inBoundsInner(x: number, y: number, w: number, h: number): boolean {
  return x > 0 && y > 0 && x < w - 1 && y < h - 1
}

function fourNeighborsWalkable(tiles: Tile[], w: number, x: number, y: number): { n: number; e: boolean; w: boolean; s: boolean; n0: boolean } {
  const i = idx(x, y, w)
  void i
  const e = isWalkable(tiles[idx(x + 1, y, w)])
  const w0 = isWalkable(tiles[idx(x - 1, y, w)])
  const s = isWalkable(tiles[idx(x, y + 1, w)])
  const n0 = isWalkable(tiles[idx(x, y - 1, w)])
  return { n: (e ? 1 : 0) + (w0 ? 1 : 0) + (s ? 1 : 0) + (n0 ? 1 : 0), e, w: w0, s, n0 }
}

function countWalkableTiles(tiles: Tile[]): number {
  let n = 0
  for (const t of tiles) if (isWalkable(t)) n++
  return n
}

function findFirstWalkable(tiles: Tile[], w: number): Vec2 | null {
  for (let i = 0; i < tiles.length; i++) {
    if (!isWalkable(tiles[i])) continue
    return { x: i % w, y: (i / w) | 0 }
  }
  return null
}

/**
 * Attempts to create a small number of 1-tile “door frame” throats in corridors by
 * walling perpendicular side tiles around a straight corridor cell.
 *
 * This is intended to make Dungeon layouts read as rooms connected by doorways, so
 * locks can prefer those chokepoints.
 */
export function applyDungeonDoorFrames(args: {
  tiles: Tile[]
  w: number
  h: number
  rng: Pick<Rng, 'next' | 'int'>
  maxFrames?: number
}): { framesApplied: number } {
  const { tiles, w, h, rng } = args
  const maxFrames = Math.max(0, Math.min(18, Math.floor(args.maxFrames ?? 10)))
  if (maxFrames === 0) return { framesApplied: 0 }

  const candidates: Array<{ x: number; y: number; horiz: boolean }> = []
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = idx(x, y, w)
      if (tiles[i] !== 'floor') continue
      const neigh = fourNeighborsWalkable(tiles, w, x, y)
      if (neigh.n !== 2) continue

      const straightEW = neigh.e && neigh.w && !neigh.n0 && !neigh.s
      const straightNS = neigh.n0 && neigh.s && !neigh.e && !neigh.w
      if (!straightEW && !straightNS) continue

      // Avoid targeting junction-adjacent cells; they read better as open connectors.
      const eN = fourNeighborsWalkable(tiles, w, x + 1, y).n
      const wN = fourNeighborsWalkable(tiles, w, x - 1, y).n
      const nN = fourNeighborsWalkable(tiles, w, x, y - 1).n
      const sN = fourNeighborsWalkable(tiles, w, x, y + 1).n
      if (Math.max(eN, wN, nN, sN) >= 3) continue

      candidates.push({ x, y, horiz: straightEW })
    }
  }

  if (!candidates.length) return { framesApplied: 0 }

  // Deterministic shuffle via Fisher–Yates using the provided RNG stream.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = rng.int(0, i + 1)
    const tmp = candidates[i]
    candidates[i] = candidates[j]
    candidates[j] = tmp
  }

  let framesApplied = 0
  for (const c of candidates) {
    if (framesApplied >= maxFrames) break
    if (!inBoundsInner(c.x, c.y, w, h)) continue
    const i = idx(c.x, c.y, w)
    if (tiles[i] !== 'floor') continue

    // Side tiles to wall to create the throat.
    const side1 = c.horiz ? { x: c.x, y: c.y - 1 } : { x: c.x - 1, y: c.y }
    const side2 = c.horiz ? { x: c.x, y: c.y + 1 } : { x: c.x + 1, y: c.y }

    const s1i = idx(side1.x, side1.y, w)
    const s2i = idx(side2.x, side2.y, w)
    if (tiles[s1i] !== 'floor' || tiles[s2i] !== 'floor') continue

    // Only narrow where side tiles are corridor-ish (avoid eating room interiors).
    if (fourNeighborsWalkable(tiles, w, side1.x, side1.y).n > 2) continue
    if (fourNeighborsWalkable(tiles, w, side2.x, side2.y).n > 2) continue

    tiles[s1i] = 'wall'
    tiles[s2i] = 'wall'
    framesApplied++
  }

  return { framesApplied }
}

/**
 * Guarded wrapper: reverts if it disconnects the map or removes too much walkable mass.
 * Intended to run on the layout RNG stream so it stays phase-stable.
 */
export function applyDungeonDoorFramesGuarded(args: {
  tiles: Tile[]
  w: number
  h: number
  rng: Pick<Rng, 'next' | 'int'>
  maxFrames?: number
}): { applied: boolean; framesApplied: number } {
  const { tiles, w, h } = args
  if (w <= 0 || h <= 0 || tiles.length !== w * h) return { applied: false, framesApplied: 0 }

  const start = findFirstWalkable(tiles, w)
  if (!start) return { applied: false, framesApplied: 0 }

  const before = tiles.slice()
  const beforeWalkable = countWalkableTiles(before)

  const { framesApplied } = applyDungeonDoorFrames(args)
  if (framesApplied <= 0) return { applied: false, framesApplied: 0 }

  const afterWalkable = countWalkableTiles(tiles)
  const reach = floodFillReachable(tiles, w, h, start)
  for (let i = 0; i < tiles.length; i++) {
    if (isWalkable(tiles[i]) && !reach[i]) {
      for (let j = 0; j < tiles.length; j++) tiles[j] = before[j]
      return { applied: false, framesApplied: 0 }
    }
  }

  const maxLoss = Math.max(6, Math.floor(beforeWalkable * 0.03))
  if (afterWalkable < beforeWalkable - maxLoss) {
    for (let j = 0; j < tiles.length; j++) tiles[j] = before[j]
    return { applied: false, framesApplied: 0 }
  }

  return { applied: true, framesApplied }
}

