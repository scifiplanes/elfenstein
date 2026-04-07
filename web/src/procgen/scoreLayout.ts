import type { FloorGenOutput } from './types'
import { bfsDistances, floodFillReachable, isWalkable } from './validate'

/**
 * Heuristic layout quality: prefers more floor tiles reached from entrance (loopiness proxy)
 * and penalizes dead-end floor cells adjacent to only one floor.
 */
export function scoreLayout(gen: FloorGenOutput, w: number, h: number): number {
  const { tiles, entrance } = gen
  if (w <= 0 || h <= 0 || tiles.length !== w * h) return 0

  const reach = floodFillReachable(tiles, w, h, entrance)
  let reachableFloors = 0
  for (let i = 0; i < tiles.length; i++) {
    if (reach[i] && tiles[i] === 'floor') reachableFloors++
  }

  let deadEnds = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = x + y * w
      if (tiles[i] !== 'floor' || !reach[i]) continue
      let n = 0
      if (isWalkable(tiles[i + 1])) n++
      if (isWalkable(tiles[i - 1])) n++
      if (isWalkable(tiles[i + w])) n++
      if (isWalkable(tiles[i - w])) n++
      if (n <= 1) deadEnds++
    }
  }

  const dist = bfsDistances(tiles, w, h, entrance)
  const exitIdx = gen.exit.x + gen.exit.y * w
  const pathLen = exitIdx >= 0 && exitIdx < dist.length ? dist[exitIdx] : 0

  // Weighted score (tuned for relative comparison only).
  return reachableFloors * 2 - deadEnds + Math.min(40, pathLen)
}
