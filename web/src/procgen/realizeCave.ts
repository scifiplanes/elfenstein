import type { Tile } from '../game/types'
import type { Rng } from './seededRng'
import type { GenRoom } from './types'
import { center, carveRect, type Rect } from './layoutPasses'

/** Organic tunnel + chamber layout (single main cavern component). */
export function runCaveLayout(w: number, h: number, rng: Rng): { tiles: Tile[]; genRooms: GenRoom[] } {
  const tiles: Tile[] = Array.from({ length: w * h }, () => 'wall')
  let x = Math.floor(w / 2)
  let y = Math.floor(h / 2)
  const steps = Math.floor(w * h * 0.36)
  for (let i = 0; i < steps; i++) {
    if (x > 0 && x < w - 1 && y > 0 && y < h - 1) {
      tiles[x + y * w] = 'floor'
      // occasional widen
      if (rng.next() < 0.12) {
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = x + dx
          const ny = y + dy
          if (nx > 0 && nx < w - 1 && ny > 0 && ny < h - 1) tiles[nx + ny * w] = 'floor'
        }
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

  const room: Rect = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
  return {
    tiles,
    genRooms: [{ id: 'r_0', rect: { ...room }, center: center(room), leafDepth: 0 }],
  }
}
