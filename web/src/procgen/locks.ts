import { cellKey } from '../game/state/playerFloorCell'
import type { ItemDefId, Tile, Vec2 } from '../game/types'
import type { FloorGenDifficulty, FloorProperty, GenDoor, GenFloorItem, FloorGenOutput } from './types'
import { findNearestUnusedFloor } from './layoutPasses'
import {
  allReachableWithLocks,
  bfsDistancesWithLocks,
  exitNeighborReachableWithPoiBlocking,
  isWalkable,
  shortestPathLatticeStats,
} from './validate'

const lockedDoorsBlock: { lockedDoorsAreWalkable: boolean } = { lockedDoorsAreWalkable: false }

/** Keys placed by `placeLocksOnPath` (for content coverage audits). */
export const PROCgen_LOCK_KEY_ITEM_DEF_IDS: ItemDefId[] = ['IronKey', 'BrassKey']

/** Hard validation: Well must be within this many steps of entrance (see DESIGN §8). */
const SAFETY_WELL_MAX_BFS = 3
/** Hard validation: Bed must be within this many steps of entrance (POIs target ~45% along exit BFS). */
const SAFETY_BED_MAX_BFS = 48

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
  /** When set, shuffles orthogonal neighbor order per expansion so tie-breaking among equal-length shortest paths is seeded (helps lock placement find separating cells). */
  pathChoiceRng?: { next(): number },
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
  const deltaIdx = [0, 1, 2, 3]
  const dxy = [1, -1, w, -w]

  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi]
    if (i === goal) break
    const x = i % w
    const y = (i / w) | 0
    let order = deltaIdx
    if (pathChoiceRng) {
      order = deltaIdx.slice()
      for (let ui = order.length - 1; ui > 0; ui--) {
        const jj = Math.floor(pathChoiceRng.next() * (ui + 1))
        const tmp = order[ui]!
        order[ui] = order[jj]!
        order[jj] = tmp
      }
    }
    for (const oi of order) {
      const j = i + dxy[oi]!
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
  const exitReachable = allReachableWithLocks(test, w, h, entrance, [exit], lockedDoorsBlock)
  return !exitReachable
}

function idxToPos(i: number, w: number): Vec2 {
  return { x: i % w, y: (i / w) | 0 }
}

export function isDoorFrameCandidate(tiles: Tile[], w: number, h: number, x: number, y: number): boolean {
  if (x <= 1 || y <= 1 || x >= w - 2 || y >= h - 2) return false
  const i = x + y * w
  if (tiles[i] !== 'floor') return false
  const e = isWalkable(tiles[i + 1])
  const w0 = isWalkable(tiles[i - 1])
  const s = isWalkable(tiles[i + w])
  const n0 = isWalkable(tiles[i - w])
  const deg = (e ? 1 : 0) + (w0 ? 1 : 0) + (s ? 1 : 0) + (n0 ? 1 : 0)
  if (deg !== 2) return false

  const straightEW = e && w0 && !n0 && !s
  const straightNS = n0 && s && !e && !w0
  if (!straightEW && !straightNS) return false

  // A “frame” throat is a straight corridor cell with walls on the perpendicular sides.
  if (straightEW) {
    const up = tiles[i - w]
    const dn = tiles[i + w]
    return up === 'wall' && dn === 'wall'
  }
  const lf = tiles[i - 1]
  const rt = tiles[i + 1]
  return lf === 'wall' && rt === 'wall'
}

function lockThresholds(difficulty: FloorGenDifficulty): {
  minPathAnyLock: number
  minPathTwoLock: number
  allowTwoLock: boolean
} {
  if (difficulty === 0) {
    return { minPathAnyLock: 8, minPathTwoLock: 12, allowTwoLock: false }
  }
  if (difficulty === 2) {
    return { minPathAnyLock: 4, minPathTwoLock: 9, allowTwoLock: true }
  }
  return { minPathAnyLock: 4, minPathTwoLock: 11, allowTwoLock: true }
}

/** Shared with `pickDecorativeDoorTile` so locked vs decorative doors use the same octopus weighting. */
function octopusClosedDoorProbability(floorProperties: FloorProperty[] | undefined): number {
  const infested = floorProperties?.includes('Infested') ?? false
  return Math.min(0.82, 0.12 + (infested ? 0.38 : 0))
}

/** Deterministic roll: some procgen locks render as octopus doors (see `lockedDoorOctopus`). */
function pickLockedDoorTile(rng: { next(): number }, floorProperties: FloorProperty[] | undefined): Tile {
  return rng.next() < octopusClosedDoorProbability(floorProperties) ? 'lockedDoorOctopus' : 'lockedDoor'
}

/** Closed `door` / `doorOctopus` (no key); same octopus odds as `pickLockedDoorTile`. */
export function pickDecorativeDoorTile(rng: { next(): number }, floorProperties: FloorProperty[] | undefined): 'door' | 'doorOctopus' {
  return rng.next() < octopusClosedDoorProbability(floorProperties) ? 'doorOctopus' : 'door'
}

/**
 * Place up to two ordered locks on the entrance→exit shortest path with matching keys.
 * If that finds no valid slot, falls back to scanning the full grid for a floor cell that
 * still separates exit from entrance (`separatesExit`), preferring door-frame throats in
 * stable near-entrance order. Returns doors + key floor items; mutates `tiles` in place.
 */
export function placeLocksOnPath(args: {
  tiles: Tile[]
  w: number
  h: number
  entrance: Vec2
  exit: Vec2
  rng: { next(): number }
  occupied: Set<string>
  difficulty?: FloorGenDifficulty
  floorProperties?: FloorProperty[]
}): { doors: GenDoor[]; floorItems: GenFloorItem[] } {
  const { tiles, w, h, entrance, exit, rng, occupied } = args
  const floorProperties = args.floorProperties
  const difficulty = args.difficulty ?? 1
  const { minPathAnyLock, minPathTwoLock, allowTwoLock } = lockThresholds(difficulty)

  const path = shortestPathIndices(tiles, w, h, entrance, exit, rng)
  if (!path || path.length < minPathAnyLock) return { doors: [], floorItems: [] }

  // Prefer placing locks on “door frame” throats (Dungeon identity).
  const doorFramePathIdxs: number[] = []
  for (let k = 1; k < path.length - 1; k++) {
    const cell = path[k]
    const x = cell % w
    const y = (cell / w) | 0
    if (occupied.has(`${x},${y}`)) continue
    if (isDoorFrameCandidate(tiles, w, h, x, y)) doorFramePathIdxs.push(k)
  }

  // Try two-lock configuration first (longer paths).
  if (allowTwoLock && path.length >= minPathTwoLock) {
    const i2List = doorFramePathIdxs.length ? doorFramePathIdxs : Array.from({ length: path.length }, (_, i) => i)
    for (let t2 = i2List.length - 1; t2 >= 0; t2--) {
      const i2 = i2List[t2]!
      if (i2 >= path.length - 2 || i2 < 8) continue
      for (let t1 = t2 - 1; t1 >= 0; t1--) {
        const i1 = i2List[t1]!
        if (i1 >= i2 - 3 || i1 < 2) continue
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
        if (allReachableWithLocks(testOpenFirst, w, h, entrance, [exit], lockedDoorsBlock)) continue

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

        tiles[c1] = pickLockedDoorTile(rng, floorProperties)
        tiles[c2] = pickLockedDoorTile(rng, floorProperties)

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
  const lockCandidates = doorFramePathIdxs.length ? doorFramePathIdxs : Array.from({ length: path.length }, (_, i) => i)
  for (let t = lockCandidates.length - 1; t >= 0; t--) {
    const lockIdxOnPath = lockCandidates[t]!
    if (lockIdxOnPath >= path.length - 2 || lockIdxOnPath < 2) continue
    const lockCell = path[lockIdxOnPath]
    const lx = lockCell % w
    const ly = (lockCell / w) | 0
    if (occupied.has(`${lx},${ly}`)) continue
    if (tiles[lockCell] !== 'floor') continue

    if (!separatesExit(tiles, w, h, entrance, exit, lockCell)) continue

    tiles[lockCell] = pickLockedDoorTile(rng, floorProperties)
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

  return tryArticulationSingleLockFallback({
    tiles,
    w,
    h,
    entrance,
    exit,
    rng,
    occupied,
    floorProperties,
    minPathAnyLock,
    path,
  })
}

/**
 * When no shortest-path choke exists (common after `injectLoops`), scan the full grid for a
 * floor cell that still separates entrance from exit (`separatesExit`). Prefer door-frame throats;
 * stable order: door frames by ascending index (near-entrance necks first), then other floors ascending.
 */
function collectArticulationSingleLockCandidates(
  tiles: Tile[],
  w: number,
  h: number,
  entrance: Vec2,
  exit: Vec2,
  occupied: Set<string>,
): { doorFrameIdxs: number[]; otherIdxs: number[] } {
  const entI = entrance.x + entrance.y * w
  const exI = exit.x + exit.y * w
  const doorFrameIdxs: number[] = []
  const otherIdxs: number[] = []
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = x + y * w
      if (i === entI || i === exI) continue
      if (occupied.has(`${x},${y}`)) continue
      if (tiles[i] !== 'floor') continue
      if (isDoorFrameCandidate(tiles, w, h, x, y)) doorFrameIdxs.push(i)
      else otherIdxs.push(i)
    }
  }
  doorFrameIdxs.sort((a, b) => a - b)
  otherIdxs.sort((a, b) => a - b)
  return { doorFrameIdxs, otherIdxs }
}

function tryArticulationSingleLockFallback(args: {
  tiles: Tile[]
  w: number
  h: number
  entrance: Vec2
  exit: Vec2
  rng: { next(): number }
  occupied: Set<string>
  floorProperties: FloorProperty[] | undefined
  minPathAnyLock: number
  path: number[]
}): { doors: GenDoor[]; floorItems: GenFloorItem[] } {
  const { tiles, w, h, entrance, exit, rng, occupied, floorProperties, minPathAnyLock, path } = args

  if (!path || path.length < minPathAnyLock) return { doors: [], floorItems: [] }

  const { doorFrameIdxs, otherIdxs } = collectArticulationSingleLockCandidates(tiles, w, h, entrance, exit, occupied)
  const tryOrder = doorFrameIdxs.concat(otherIdxs)

  for (const lockCell of tryOrder) {
    const lx = lockCell % w
    const ly = (lockCell / w) | 0
    if (!separatesExit(tiles, w, h, entrance, exit, lockCell)) continue

    const lockPos = { x: lx, y: ly }
    const pathToLock = shortestPathIndices(tiles, w, h, entrance, lockPos, rng)
    if (!pathToLock || pathToLock.length < 2) continue

    const lockAt = pathToLock[pathToLock.length - 1]!
    if (lockAt !== lockCell) continue

    let placeKeyPos: Vec2
    if (pathToLock.length === 2) {
      // Lock is the first step from entrance; key must stay on the entrance side (same cell as spawn).
      placeKeyPos = { ...entrance }
    } else {
      const maxKeyStep = pathToLock.length - 2
      if (maxKeyStep < 1) continue
      const keyStep = clampInt(Math.floor(maxKeyStep * 0.45 + (rng.next() - 0.5) * 2), 1, maxKeyStep)
      const keyCell = pathToLock[keyStep]!
      placeKeyPos = tiles[keyCell] === 'floor' ? idxToPos(keyCell, w) : entrance
    }
    if (occupied.has(`${placeKeyPos.x},${placeKeyPos.y}`)) {
      const alt = findNearestUnusedFloor(tiles, w, h, placeKeyPos, occupied)
      if (alt) placeKeyPos = alt
    }

    tiles[lockCell] = pickLockedDoorTile(rng, floorProperties)
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
    else {
      const cur = gen.tiles[idx]
      t[idx] = cur === 'lockedDoorOctopus' || cur === 'lockedDoor' ? cur : 'lockedDoor'
    }
  }
  return t
}

export function validateGen(gen: FloorGenOutput, w: number, h: number): boolean {
  if (w <= 0 || h <= 0) return true
  if (gen.tiles.length !== w * h) return false

  if (gen.pois.length) {
    const poiKeys = new Set(gen.pois.map((p) => cellKey(p.pos.x, p.pos.y)))
    if (!exitNeighborReachableWithPoiBlocking(gen.tiles, w, h, gen.entrance, gen.exit, poiKeys)) return false
  }

  const locked = gen.doors.filter((d) => d.locked && d.lockId).sort((a, b) => (a.orderOnPath ?? 0) - (b.orderOnPath ?? 0))
  const keys = gen.floorItems.filter((it) => it.forLockId)

  if (locked.length === 0) return true

  {
    // Geometric shortest-path band width: use normal walkability (door tiles count as passable; see `isWalkable` in validate).
    // Do not use closed-lock reachability here — it contradicts the requirement below that exit is unreachable when all locks are closed.
    const { shortestLen: L, latticeCells } = shortestPathLatticeStats(gen.tiles, w, h, gen.entrance, gen.exit)
    // Slightly looser than “strict spine” so lock floors validate more often (still needs a 2+ cell-wide shortest-path band).
    if (L < 3 || latticeCells <= L + 1) return false
  }

  for (const d of locked) {
    const k = keys.find((it) => it.forLockId === d.lockId)
    if (!k) return false
  }

  // Each key k must be reachable when all earlier locks are open and this lock onward closed.
  for (let k = 0; k < locked.length; k++) {
    const sim = tilesWithFirstKLocksOpen(gen, w, h, k)
    const key = keys.find((it) => it.forLockId === locked[k].lockId)
    if (!key) return false
    if (!allReachableWithLocks(sim, w, h, gen.entrance, [key.pos], lockedDoorsBlock)) return false
  }

  const allClosed = tilesWithFirstKLocksOpen(gen, w, h, 0)
  if (allReachableWithLocks(allClosed, w, h, gen.entrance, [gen.exit], lockedDoorsBlock)) return false

  const allOpen = tilesWithFirstKLocksOpen(gen, w, h, locked.length)
  if (!allReachableWithLocks(allOpen, w, h, gen.entrance, [gen.exit], lockedDoorsBlock)) return false

  const distFromEntrance = bfsDistancesWithLocks(gen.tiles, w, h, gen.entrance, lockedDoorsBlock)
  const well = gen.pois.find((p) => p.kind === 'Well')
  if (well) {
    const wi = well.pos.x + well.pos.y * w
    const d = wi >= 0 && wi < distFromEntrance.length ? distFromEntrance[wi] : -1
    if (d < 0 || d > SAFETY_WELL_MAX_BFS) return false
  }
  const bed = gen.pois.find((p) => p.kind === 'Bed')
  if (bed) {
    const bi = bed.pos.x + bed.pos.y * w
    const d = bi >= 0 && bi < distFromEntrance.length ? distFromEntrance[bi] : -1
    if (d < 0 || d > SAFETY_BED_MAX_BFS) return false
  }

  return true
}
