import type { Tile, Vec2 } from '../game/types'
import type { GenRoom } from './types'
import { center } from './layoutPasses'
import { isWalkable } from './validate'

function idx(x: number, y: number, w: number): number {
  return x + y * w
}

function inBoundsInner(x: number, y: number, w: number, h: number): boolean {
  return x > 0 && y > 0 && x < w - 1 && y < h - 1
}

function walkableNeighborCount(tiles: Tile[], w: number, x: number, y: number): number {
  let n = 0
  if (isWalkable(tiles[idx(x + 1, y, w)])) n++
  if (isWalkable(tiles[idx(x - 1, y, w)])) n++
  if (isWalkable(tiles[idx(x, y + 1, w)])) n++
  if (isWalkable(tiles[idx(x, y - 1, w)])) n++
  return n
}

function isJunctionCell(tiles: Tile[], w: number, h: number, x: number, y: number): boolean {
  if (!inBoundsInner(x, y, w, h)) return false
  const t = tiles[idx(x, y, w)]
  if (!isWalkable(t)) return false
  return walkableNeighborCount(tiles, w, x, y) >= 3
}

/**
 * Creates small derived rooms around corridor junctions to provide semantic anchors for
 * districts/tags/spawn bias (without changing geometry).
 *
 * Bounded and deterministic: uses a stable scan order and caps output count.
 */
export function deriveJunctionRooms(args: {
  tiles: Tile[]
  w: number
  h: number
  maxRooms?: number
}): GenRoom[] {
  const { tiles, w, h } = args
  const maxRooms = Math.max(0, Math.min(10, Math.floor(args.maxRooms ?? 6)))
  if (!maxRooms) return []

  const seen = new Uint8Array(w * h)
  const out: GenRoom[] = []

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (out.length >= maxRooms) return out
      const startI = idx(x, y, w)
      if (seen[startI]) continue
      if (!isJunctionCell(tiles, w, h, x, y)) continue

      const qx: number[] = [x]
      const qy: number[] = [y]
      seen[startI] = 1

      let minX = x,
        maxX = x,
        minY = y,
        maxY = y
      const cells: Array<{ x: number; y: number }> = []

      for (let qi = 0; qi < qx.length; qi++) {
        const cx = qx[qi]!
        const cy = qy[qi]!
        cells.push({ x: cx, y: cy })
        minX = Math.min(minX, cx)
        maxX = Math.max(maxX, cx)
        minY = Math.min(minY, cy)
        maxY = Math.max(maxY, cy)

        const neigh = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ] as const
        for (const [nx, ny] of neigh) {
          if (!inBoundsInner(nx, ny, w, h)) continue
          const ni = idx(nx, ny, w)
          if (seen[ni]) continue
          if (!isJunctionCell(tiles, w, h, nx, ny)) continue
          seen[ni] = 1
          qx.push(nx)
          qy.push(ny)
        }
      }

      // Keep these small; large regions are probably “room interiors”.
      const rectW = maxX - minX + 1
      const rectH = maxY - minY + 1
      if (rectW * rectH > 20) continue

      const rect = { x: minX, y: minY, w: rectW, h: rectH }
      const c = center(rect)

      // Pick a center that is actually walkable by choosing closest junction cell to rect center.
      let best: Vec2 = cells[0]!
      let bestD = 1e9
      for (const p of cells) {
        const d = Math.abs(p.x - c.x) + Math.abs(p.y - c.y)
        if (d < bestD) {
          bestD = d
          best = p
        }
      }

      out.push({
        id: `r_junc_${out.length}`,
        rect,
        center: { ...best },
        leafDepth: 0,
        tags: { size: 'tiny', roomFunction: 'Passage' },
      })
    }
  }

  return out
}

