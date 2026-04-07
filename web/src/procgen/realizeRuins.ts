import type { Tile } from '../game/types'
import type { Rng } from './seededRng'
import type { GenRoom } from './types'
import { carveRect, center, type Rect } from './layoutPasses'

const CELL = 5

/** Macro-cell stamp: grid of potential chambers with random doorways. */
export function runRuinsLayout(w: number, h: number, rng: Rng): { tiles: Tile[]; genRooms: GenRoom[] } {
  const tiles: Tile[] = Array.from({ length: w * h }, () => 'wall')
  const genRooms: GenRoom[] = []

  for (let cy = 1; cy + CELL < h - 1; cy += CELL) {
    for (let cx = 1; cx + CELL < w - 1; cx += CELL) {
      if (rng.next() < 0.08) continue
      const rw = CELL - (rng.next() < 0.35 ? 1 : 0)
      const rh = CELL - (rng.next() < 0.35 ? 1 : 0)
      const rx = cx + rng.int(0, Math.max(1, CELL - rw))
      const ry = cy + rng.int(0, Math.max(1, CELL - rh))
      const room: Rect = { x: rx, y: ry, w: rw, h: rh }
      if (room.x + room.w >= w - 1 || room.y + room.h >= h - 1) continue
      carveRect(tiles, w, room)
      genRooms.push({ id: `r_${genRooms.length}`, rect: { ...room }, center: center(room), leafDepth: 1 })
    }
  }

  // Doorways between adjacent carved cells (horizontal)
  for (let y = 2; y < h - 2; y += CELL) {
    for (let x = 2; x < w - 2; x++) {
      if (rng.next() > 0.22) continue
      if (tiles[x + y * w] === 'wall' && tiles[(x + 1) + y * w] === 'wall') {
        tiles[x + y * w] = 'floor'
        tiles[(x + 1) + y * w] = 'floor'
      }
    }
  }
  for (let x = 2; x < w - 2; x += CELL) {
    for (let y = 2; y < h - 2; y++) {
      if (rng.next() > 0.22) continue
      if (tiles[x + y * w] === 'wall' && tiles[x + (y + 1) * w] === 'wall') {
        tiles[x + y * w] = 'floor'
        tiles[x + (y + 1) * w] = 'floor'
      }
    }
  }

  if (!genRooms.length) {
    const room: Rect = { x: Math.max(1, Math.floor(w / 2) - 4), y: Math.max(1, Math.floor(h / 2) - 4), w: 8, h: 8 }
    carveRect(tiles, w, room)
    genRooms.push({ id: 'r_0', rect: { ...room }, center: center(room), leafDepth: 0 })
  }

  return { tiles, genRooms }
}
