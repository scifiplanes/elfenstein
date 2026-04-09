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

export function pickPlayerSpawnCell(
  tiles: readonly Tile[],
  w: number,
  h: number,
  entrance: Vec2,
  pois: readonly FloorPoi[],
): Vec2 {
  return nearestFloorCellWithoutPoi(tiles, w, h, entrance, pois)
}
