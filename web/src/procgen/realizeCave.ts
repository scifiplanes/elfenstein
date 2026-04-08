import type { Tile, Vec2 } from '../game/types'
import type { Rng } from './seededRng'
import type { GenRoom } from './types'
import { center, carveRect, type Rect } from './layoutPasses'

function inBounds(x: number, y: number, w: number, h: number): boolean {
  return x >= 0 && y >= 0 && x < w && y < h
}

function idx(x: number, y: number, w: number): number {
  return x + y * w
}

function carveBlob(tiles: Tile[], w: number, h: number, cx: number, cy: number, r: number) {
  const rr = Math.max(1, Math.min(6, Math.floor(r)))
  for (let dy = -rr; dy <= rr; dy++) {
    for (let dx = -rr; dx <= rr; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > rr) continue
      const x = cx + dx
      const y = cy + dy
      if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) continue
      tiles[idx(x, y, w)] = 'floor'
    }
  }
}

function eightNeighborFloors(tiles: Tile[], w: number, h: number, x: number, y: number): number {
  let n = 0
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (!inBounds(nx, ny, w, h)) continue
      if (tiles[idx(nx, ny, w)] === 'floor') n++
    }
  }
  return n
}

function extractChambers(tiles: Tile[], w: number, h: number): Array<{ rect: Rect; center: Vec2; area: number }> {
  // Consider “open” floor cells to be chamber candidates.
  const OPEN_MIN = 5
  const isOpen = (x: number, y: number) => tiles[idx(x, y, w)] === 'floor' && eightNeighborFloors(tiles, w, h, x, y) >= OPEN_MIN

  const seen = new Uint8Array(w * h)
  const out: Array<{ rect: Rect; center: Vec2; area: number }> = []

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const startI = idx(x, y, w)
      if (seen[startI]) continue
      if (!isOpen(x, y)) continue

      let minX = x,
        maxX = x,
        minY = y,
        maxY = y
      let area = 0
      const qx: number[] = [x]
      const qy: number[] = [y]
      seen[startI] = 1

      for (let qi = 0; qi < qx.length; qi++) {
        const cx = qx[qi]
        const cy = qy[qi]
        area++
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
          if (nx <= 0 || ny <= 0 || nx >= w - 1 || ny >= h - 1) continue
          const ni = idx(nx, ny, w)
          if (seen[ni]) continue
          if (!isOpen(nx, ny)) continue
          seen[ni] = 1
          qx.push(nx)
          qy.push(ny)
        }
      }

      // Filter tiny “open” specks.
      if (area < 10) continue

      const rect: Rect = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
      out.push({ rect, center: center(rect), area })
    }
  }

  return out
}

/** Organic tunnel + chamber layout (branchy, multi-chamber). */
export function runCaveLayout(w: number, h: number, rng: Rng): { tiles: Tile[]; genRooms: GenRoom[] } {
  const tiles: Tile[] = Array.from({ length: w * h }, () => 'wall')
  const diggers = Math.max(2, Math.min(4, 2 + (rng.next() < 0.55 ? 1 : 0)))
  const perDiggerSteps = Math.floor((w * h * 0.34) / diggers)
  const starts: Array<{ x: number; y: number }> = [{ x: Math.floor(w / 2), y: Math.floor(h / 2) }]
  while (starts.length < diggers) {
    starts.push({ x: rng.int(2, Math.max(3, w - 2)), y: rng.int(2, Math.max(3, h - 2)) })
  }

  for (let di = 0; di < diggers; di++) {
    let x = starts[di].x
    let y = starts[di].y
    let sinceBlob = 0
    for (let i = 0; i < perDiggerSteps; i++) {
      if (x > 0 && x < w - 1 && y > 0 && y < h - 1) {
        tiles[idx(x, y, w)] = 'floor'

        // occasional widen (small cross)
        if (rng.next() < 0.10) {
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const) {
            const nx = x + dx
            const ny = y + dy
            if (nx > 0 && nx < w - 1 && ny > 0 && ny < h - 1) tiles[idx(nx, ny, w)] = 'floor'
          }
        }

        // periodic chamber blob (diamond radius)
        sinceBlob++
        if (sinceBlob > 26 && rng.next() < 0.08) {
          sinceBlob = 0
          const r = 2 + (rng.next() < 0.35 ? 1 : 0) + (rng.next() < 0.15 ? 1 : 0)
          carveBlob(tiles, w, h, x, y, r)
        }
      }

      const d = rng.int(0, 4)
      if (d === 0) x++
      else if (d === 1) x--
      else if (d === 2) y++
      else y--
      x = Math.max(1, Math.min(w - 2, x))
      y = Math.max(1, Math.min(h - 2, y))
    }
  }

  let minX = w,
    maxX = 0,
    minY = h,
    maxY = 0
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      if (tiles[xx + yy * w] === 'floor') {
        minX = Math.min(minX, xx)
        maxX = Math.max(maxX, xx)
        minY = Math.min(minY, yy)
        maxY = Math.max(maxY, yy)
      }
    }
  }
  if (minX > maxX) {
    const room: Rect = { x: 1, y: 1, w: Math.min(7, w - 2), h: Math.min(7, h - 2) }
    carveRect(tiles, w, room)
    return {
      tiles,
      genRooms: [{ id: 'r_0', rect: { ...room }, center: center(room), leafDepth: 0 }],
    }
  }

  const bbox: Rect = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
  const chambers = extractChambers(tiles, w, h)
    .sort((a, b) => b.area - a.area)
    .slice(0, 10)

  if (chambers.length >= 2) {
    const genRooms: GenRoom[] = chambers.map((c, i) => ({
      id: `r_${i}`,
      rect: { ...c.rect },
      center: { ...c.center },
      leafDepth: 0,
    }))
    return { tiles, genRooms }
  }

  // Fallback: one coarse room bbox (legacy behavior)
  return {
    tiles,
    genRooms: [{ id: 'r_0', rect: { ...bbox }, center: center(bbox), leafDepth: 0 }],
  }
}
