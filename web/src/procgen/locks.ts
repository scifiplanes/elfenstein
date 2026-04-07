import type { Tile, Vec2 } from '../game/types'
import type { GenDoor, GenFloorItem, FloorGenOutput } from './types'
import { allReachable, isWalkable } from './validate'
import { findNearestUnusedFloor } from './layoutPasses'

function clampInt(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(v)))
}

/** BFS shortest path from entrance to exit over walkable tiles; returns cell indices. */
export function shortestPathIndices(
  tiles: Tile[],
  w: number,
  _h: number,
  entrance: Vec2,
  exit: Vec2,
): number[] | null {
  const prev = new Int32Array(tiles.length)
  prev.fill(-1)
  const dist = new Int32Array(tiles.length)
  dist.fill(-1)

  const s = entrance.x + entrance.y * w
  const goal = exit.x + exit.y * w
  if (s < 0 || s >= tiles.length || goal < 0 || goal >= tiles.length) return null
  if (!isWalkable(tiles[s]) || !isWalkable(tiles[goal])) return null

  const q: number[] = [s]
  dist[s] = 0

  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi]
    if (i === goal) break
    const x = i % w
    const y = (i / w) | 0
    const neigh = [i + 1, i - 1, i + w, i - w]
    for (const j of neigh) {
      if (j < 0 || j >= tiles.length) continue
      const nx = j % w
      const ny = (j / w) | 0
      if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue
      if (dist[j] !== -1) continue
      if (!isWalkable(tiles[j])) continue
      dist[j] = dist[i] + 1
      prev[j] = i
      q.push(j)
    }
  }

  if (dist[goal] < 0) return null

  const path: number[] = []
  for (let cur = goal; cur !== -1; cur = prev[cur]) path.push(cur)
  path.reverse()
  return path
}

function separatesExit(
  baseTiles: Tile[],
  w: number,
  h: number,
  entrance: Vec2,
  exit: Vec2,
  lockIdx: number,
): boolean {
  const test = baseTiles.slice()
  test[lockIdx] = 'lockedDoor'
  const exitReachable = allReachable(test, w, h, entrance, [exit])
  return !exitReachable
}

function idxToPos(i: number, w: number): Vec2 {
  return { x: i % w, y: (i / w) | 0 }
}

/**
 * Place up to two ordered locks on the entrance→exit shortest path with matching keys.
 * Returns doors + key floor items; mutates `tiles` in place (lockedDoor cells).
 */
export function placeLocksOnPath(args: {
  tiles: Tile[]
  w: number
  h: number
  entrance: Vec2
  exit: Vec2
  rng: { next(): number }
  occupied: Set<string>
}): { doors: GenDoor[]; floorItems: GenFloorItem[] } {
  const { tiles, w, h, entrance, exit, rng, occupied } = args

  const path = shortestPathIndices(tiles, w, h, entrance, exit)
  if (!path || path.length < 6) return { doors: [], floorItems: [] }

  // Try two-lock configuration first (longer paths).
  if (path.length >= 14) {
    for (let i2 = path.length - 3; i2 >= 8; i2--) {
      for (let i1 = i2 - 4; i1 >= 2; i1--) {
        const c1 = path[i1]
        const c2 = path[i2]
        const p1 = idxToPos(c1, w)
        const p2 = idxToPos(c2, w)
        if (occupied.has(`${p1.x},${p1.y}`) || occupied.has(`${p2.x},${p2.y}`)) continue
        if (tiles[c1] !== 'floor' || tiles[c2] !== 'floor') continue

        if (!separatesExit(tiles, w, h, entrance, exit, c1)) continue

        const testOpenFirst = tiles.slice()
        testOpenFirst[c1] = 'floor'
        testOpenFirst[c2] = 'lockedDoor'
        if (allReachable(testOpenFirst, w, h, entrance, [exit])) continue

        const key1Idx = clampInt(Math.floor(i1 * 0.4 + (rng.next() - 0.5) * 2), 1, i1 - 1)
        const key2Idx = clampInt(Math.floor(i1 + (i2 - i1) * 0.45 + (rng.next() - 0.5) * 2), i1 + 1, i2 - 1)

        let key1Pos = idxToPos(path[key1Idx], w)
        let key2Pos = idxToPos(path[key2Idx], w)
        if (occupied.has(`${key1Pos.x},${key1Pos.y}`)) {
          const alt = findNearestUnusedFloor(tiles, w, h, key1Pos, occupied)
          if (alt) key1Pos = alt
        }
        const occWithKey1 = new Set(occupied)
        occWithKey1.add(`${key1Pos.x},${key1Pos.y}`)
        if (occWithKey1.has(`${key2Pos.x},${key2Pos.y}`)) {
          const alt = findNearestUnusedFloor(tiles, w, h, key2Pos, occWithKey1)
          if (alt) key2Pos = alt
        }

        tiles[c1] = 'lockedDoor'
        tiles[c2] = 'lockedDoor'

        return {
          doors: [
            { pos: p1, locked: true, lockId: 'A', keyDefId: 'IronKey', orderOnPath: 0 },
            { pos: p2, locked: true, lockId: 'B', keyDefId: 'BrassKey', orderOnPath: 1 },
          ],
          floorItems: [
            { defId: 'IronKey', pos: key1Pos, qty: 1, forLockId: 'A' },
            { defId: 'BrassKey', pos: key2Pos, qty: 1, forLockId: 'B' },
          ],
        }
      }
    }
  }

  // Single lock (legacy-style).
  for (let lockIdxOnPath = path.length - 3; lockIdxOnPath >= 2; lockIdxOnPath--) {
    const lockCell = path[lockIdxOnPath]
    const lx = lockCell % w
    const ly = (lockCell / w) | 0
    if (occupied.has(`${lx},${ly}`)) continue
    if (tiles[lockCell] !== 'floor') continue

    if (!separatesExit(tiles, w, h, entrance, exit, lockCell)) continue

    tiles[lockCell] = 'lockedDoor'
    const lockPos = { x: lx, y: ly }

    const keyIdxOnPath = clampInt(Math.floor(lockIdxOnPath * 0.45 + (rng.next() - 0.5) * 2), 1, lockIdxOnPath - 1)
    const keyCell = path[keyIdxOnPath]
    let placeKeyPos = tiles[keyCell] === 'floor' ? idxToPos(keyCell, w) : entrance
    if (occupied.has(`${placeKeyPos.x},${placeKeyPos.y}`)) {
      const alt = findNearestUnusedFloor(tiles, w, h, placeKeyPos, occupied)
      if (alt) placeKeyPos = alt
    }

    return {
      doors: [{ pos: lockPos, locked: true, lockId: 'A', keyDefId: 'IronKey', orderOnPath: 0 }],
      floorItems: [{ defId: 'IronKey', pos: placeKeyPos, qty: 1, forLockId: 'A' }],
    }
  }

  return { doors: [], floorItems: [] }
}

/** Tiles with lock cells: first `openCount` ordered doors become floor, rest stay lockedDoor. */
export function tilesWithFirstKLocksOpen(gen: FloorGenOutput, w: number, _h: number, openCount: number): Tile[] {
  const locked = gen.doors
    .filter((d) => d.locked && d.lockId)
    .sort((a, b) => (a.orderOnPath ?? 0) - (b.orderOnPath ?? 0))
  const t = gen.tiles.slice()
  for (let i = 0; i < locked.length; i++) {
    const d = locked[i]
    const idx = d.pos.x + d.pos.y * w
    if (i < openCount) t[idx] = 'floor'
    else t[idx] = 'lockedDoor'
  }
  return t
}

export function validateGen(gen: FloorGenOutput, w: number, h: number): boolean {
  if (w <= 0 || h <= 0) return true
  if (gen.tiles.length !== w * h) return false

  const locked = gen.doors.filter((d) => d.locked && d.lockId).sort((a, b) => (a.orderOnPath ?? 0) - (b.orderOnPath ?? 0))
  const keys = gen.floorItems.filter((it) => it.forLockId)

  if (locked.length === 0) return true

  for (const d of locked) {
    const k = keys.find((it) => it.forLockId === d.lockId)
    if (!k) return false
  }

  // Each key k must be reachable when all earlier locks are open and this lock onward closed.
  for (let k = 0; k < locked.length; k++) {
    const sim = tilesWithFirstKLocksOpen(gen, w, h, k)
    const key = keys.find((it) => it.forLockId === locked[k].lockId)
    if (!key) return false
    if (!allReachable(sim, w, h, gen.entrance, [key.pos])) return false
  }

  const allClosed = tilesWithFirstKLocksOpen(gen, w, h, 0)
  if (allReachable(allClosed, w, h, gen.entrance, [gen.exit])) return false

  const allOpen = tilesWithFirstKLocksOpen(gen, w, h, locked.length)
  if (!allReachable(allOpen, w, h, gen.entrance, [gen.exit])) return false

  return true
}
