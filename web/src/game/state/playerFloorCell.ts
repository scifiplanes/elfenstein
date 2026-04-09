import { isAnyDoorTile } from '../tiles'
import type { FloorPoi, Tile, Vec2 } from '../types'

/** Orthogonal deltas: N, E, S, W (grid y+ is south). */
const ORTHO: readonly Vec2[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
]

export function poiOccupiesCell(pois: readonly FloorPoi[], x: number, y: number): boolean {
  return pois.some((p) => p.pos.x === x && p.pos.y === y)
}

export function cellKey(x: number, y: number): string {
  return `${x},${y}`
}

/**
 * Same spawn nudge as `nearestFloorCellWithoutPoi`, but blocked cells are given as keys (`"x,y"`).
 * Neighbors must be `floor` (not doors), matching grid occupancy rules for the party.
 */
export function nearestFloorCellAvoidingBlocked(
  tiles: readonly Tile[],
  w: number,
  h: number,
  start: Vec2,
  blockedKeys: ReadonlySet<string>,
): Vec2 {
  if (!blockedKeys.has(cellKey(start.x, start.y))) {
    return { x: start.x, y: start.y }
  }

  for (const d of ORTHO) {
    const p = { x: start.x + d.x, y: start.y + d.y }
    if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) continue
    const idx = p.x + p.y * w
    if (idx < 0 || idx >= tiles.length || tiles[idx] !== 'floor') continue
    if (blockedKeys.has(cellKey(p.x, p.y))) continue
    return p
  }

  return { x: start.x, y: start.y }
}

/**
 * Nearest floor cell the player may occupy: `start` if it has no PoI; otherwise the first orthogonal
 * neighbor (N→E→S→W) that is `floor` and not PoI-occupied. PoI tiles block occupancy and transit, so
 * one grid step from `start` is always sufficient when anything is reachable. Falls back to `start`
 * if no neighbor qualifies (degenerate layout).
 */
export function nearestFloorCellWithoutPoi(
  tiles: readonly Tile[],
  w: number,
  h: number,
  start: Vec2,
  pois: readonly FloorPoi[],
): Vec2 {
  const blocked = new Set<string>()
  for (const p of pois) blocked.add(cellKey(p.pos.x, p.pos.y))
  return nearestFloorCellAvoidingBlocked(tiles, w, h, start, blocked)
}

function isTraversableForSpawnSearch(t: Tile): boolean {
  return t === 'floor' || isAnyDoorTile(t)
}

/**
 * BFS for a stand cell: `tile === 'floor'` and not POI-occupied.
 * If `blockPoiTransit`, POI cells are not enqueued (matches in-game walking). If false, POI tiles may be
 * traversed to find a stand cell beyond them (spawn-only; avoids falling back to a door entrance).
 */
function bfsPlainFloorSpawn(
  tiles: readonly Tile[],
  w: number,
  h: number,
  entrance: Vec2,
  pois: readonly FloorPoi[],
  blockPoiTransit: boolean,
): Vec2 | null {
  const { x: ex, y: ey } = entrance
  if (ex < 0 || ey < 0 || ex >= w || ey >= h) return null
  const startIdx = ex + ey * w
  if (startIdx < 0 || startIdx >= tiles.length) return null

  const seen = new Uint8Array(tiles.length)
  const qx: number[] = []
  const qy: number[] = []

  const enqueue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    if (blockPoiTransit && poiOccupiesCell(pois, x, y)) return
    const i = x + y * w
    if (i < 0 || i >= tiles.length || !isTraversableForSpawnSearch(tiles[i])) return
    if (seen[i]) return
    seen[i] = 1
    qx.push(x)
    qy.push(y)
  }

  enqueue(ex, ey)
  if (qx.length === 0) {
    for (const d of ORTHO) enqueue(ex + d.x, ey + d.y)
  }

  for (let qi = 0; qi < qx.length; qi++) {
    const x = qx[qi]!
    const y = qy[qi]!
    const i = x + y * w
    if (tiles[i] === 'floor' && !poiOccupiesCell(pois, x, y)) {
      return { x, y }
    }
    for (const d of ORTHO) enqueue(x + d.x, y + d.y)
  }
  return null
}

function firstPlainFloorCellScan(tiles: readonly Tile[], w: number, h: number, pois: readonly FloorPoi[]): Vec2 | null {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = x + y * w
      if (tiles[i] === 'floor' && !poiOccupiesCell(pois, x, y)) {
        return { x, y }
      }
    }
  }
  return null
}

/**
 * Plain `floor` stand tile reachable from `gen.entrance`: strict BFS (no stepping through POIs), then relaxed
 * BFS (POI cells may be traversed for search only), then orthogonal nudge, then row-major scan. Never returns
 * a **door** tile (avoids camera inside door mesh and bogus “solid stone” when facing walls from a vestibule).
 */
export function pickPlayerSpawnCell(
  tiles: readonly Tile[],
  w: number,
  h: number,
  entrance: Vec2,
  pois: readonly FloorPoi[],
): Vec2 {
  const { x: ex, y: ey } = entrance
  if (ex < 0 || ey < 0 || ex >= w || ey >= h) {
    return firstPlainFloorCellScan(tiles, w, h, pois) ?? entrance
  }
  const startIdx = ex + ey * w
  if (startIdx < 0 || startIdx >= tiles.length) {
    return firstPlainFloorCellScan(tiles, w, h, pois) ?? entrance
  }
  if (tiles[startIdx] === 'floor' && !poiOccupiesCell(pois, ex, ey)) {
    return { x: ex, y: ey }
  }

  const strict = bfsPlainFloorSpawn(tiles, w, h, entrance, pois, true)
  if (strict) return strict

  const relaxed = bfsPlainFloorSpawn(tiles, w, h, entrance, pois, false)
  if (relaxed) return relaxed

  const nudged = nearestFloorCellWithoutPoi(tiles, w, h, entrance, pois)
  const ni = nudged.x + nudged.y * w
  if (
    ni >= 0 &&
    ni < tiles.length &&
    tiles[ni] === 'floor' &&
    !poiOccupiesCell(pois, nudged.x, nudged.y)
  ) {
    return nudged
  }

  return firstPlainFloorCellScan(tiles, w, h, pois) ?? { x: ex, y: ey }
}
