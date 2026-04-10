import type { FloorGenDifficulty, FloorGenOutput } from './types'
import { LEGACY_SCORE_WEIGHTS, type LayoutScoreWeights } from './floorTopologyTuning'
import { bfsDistances, floodFillReachable, isWalkable, shortestPathLatticeStats } from './validate'

/** Unconditional bias toward validated lock floors when picking among rerolls (scaled by difficulty). */
const LOCK_PRESENCE_BASE = 18

/**
 * Heuristic layout quality: prefers more walkable passage reached from entrance (loopiness proxy),
 * penalizes dead-end passage cells, rewards corridor junctions, and rewards branching shortest-path corridors.
 * Locked doors count as passage for mass/topology (same as `isWalkable`), so lock layouts are not penalized vs floor-only geometry.
 */
export function scoreLayout(
  gen: FloorGenOutput,
  w: number,
  h: number,
  difficulty: FloorGenDifficulty = 1,
  weights: LayoutScoreWeights = LEGACY_SCORE_WEIGHTS,
): number {
  const { tiles, entrance } = gen
  if (w <= 0 || h <= 0 || tiles.length !== w * h) return 0

  const reach = floodFillReachable(tiles, w, h, entrance)
  let reachablePassage = 0
  let junctions = 0
  for (let i = 0; i < tiles.length; i++) {
    if (!reach[i] || !isWalkable(tiles[i])) continue
    reachablePassage++
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
      if (!reach[i] || !isWalkable(tiles[i])) continue
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
  const branchMult = Math.max(0, weights.branchLatticeMult)
  const branchBonus = L >= 3 && latticeCells > L + 2 ? (latticeCells - L) * branchMult : 0
  const hasLocks = gen.doors.some((d) => d.locked && d.lockId)
  const lockLoopBase = hasLocks && branchBonus > 0 ? 24 : 0
  const lockScale = difficulty === 0 ? 0.65 : difficulty === 2 ? 1.2 : 1
  const lockLoopBonus = lockLoopBase * lockScale
  const lockPresenceBonus = hasLocks ? LOCK_PRESENCE_BASE * lockScale : 0

  const cap = Math.max(0, weights.pathLenCap)
  const pathTerm = Math.min(cap, pathLen) * weights.pathLenMult

  // Weighted score (tuned for relative comparison only).
  return (
    reachablePassage * weights.reachableMult -
    deadEnds * weights.deadEndPenalty +
    pathTerm +
    junctions * weights.junctionMult +
    branchBonus +
    lockLoopBonus +
    lockPresenceBonus
  )
}
