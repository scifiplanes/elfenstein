import type { FloorGenDifficulty, FloorGenOutput } from './types'
import { bfsDistances, floodFillReachable, isWalkable, shortestPathLatticeStats } from './validate'

/**
 * Heuristic layout quality: prefers more floor tiles reached from entrance (loopiness proxy),
 * penalizes dead-end floor cells, rewards corridor junctions, and rewards branching shortest-path corridors.
 */
export function scoreLayout(gen: FloorGenOutput, w: number, h: number, difficulty: FloorGenDifficulty = 1): number {
  const { tiles, entrance } = gen
  if (w <= 0 || h <= 0 || tiles.length !== w * h) return 0

  const reach = floodFillReachable(tiles, w, h, entrance)
  let reachableFloors = 0
  let junctions = 0
  for (let i = 0; i < tiles.length; i++) {
    if (!reach[i] || tiles[i] !== 'floor') continue
    reachableFloors++
    let n = 0
    if (isWalkable(tiles[i + 1])) n++
    if (isWalkable(tiles[i - 1])) n++
    if (isWalkable(tiles[i + w])) n++
    if (isWalkable(tiles[i - w])) n++
    if (n >= 3) junctions++
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

  const { shortestLen: L, latticeCells } = shortestPathLatticeStats(tiles, w, h, entrance, gen.exit)
  const branchBonus = L >= 3 && latticeCells > L + 2 ? (latticeCells - L) * 2 : 0
  const hasLocks = gen.doors.some((d) => d.locked && d.lockId)
  const lockLoopBase = hasLocks && branchBonus > 0 ? 24 : 0
  const lockScale = difficulty === 0 ? 0.65 : difficulty === 2 ? 1.2 : 1
  const lockLoopBonus = lockLoopBase * lockScale

  // Weighted score (tuned for relative comparison only).
  return reachableFloors * 2 - deadEnds + Math.min(40, pathLen) + junctions * 3 + branchBonus + lockLoopBonus
}
