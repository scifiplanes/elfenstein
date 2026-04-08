import type { Tile } from '../game/types'
import type { Rng } from './seededRng'
import type { GenRoom } from './types'
import { carveRect, center, type Rect } from './layoutPasses'

const CELL = 5

function idx(x: number, y: number, w: number): number {
  return x + y * w
}

function floorMassNear(tiles: Tile[], w: number, h: number, x: number, y: number): number {
  let m = 0
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx
      const ny = y + dy
      if (nx <= 0 || ny <= 0 || nx >= w - 1 || ny >= h - 1) continue
      if (tiles[idx(nx, ny, w)] === 'floor') m++
    }
  }
  return m
}

/** Macro-cell stamp: grid of potential chambers with random doorways. */
export function runRuinsLayout(w: number, h: number, rng: Rng): { tiles: Tile[]; genRooms: GenRoom[] } {
  const tiles: Tile[] = Array.from({ length: w * h }, () => 'wall')
  const genRooms: GenRoom[] = []
  const stamped = new Set<string>()

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
      stamped.add(`${cx},${cy}`)
    }
  }

  // Doorways between adjacent stamped macro-cells.
  // This is more legible than random “wall punches” because we only connect where
  // there is floor mass on both sides of the boundary.
  for (let cy = 1; cy + CELL < h - 1; cy += CELL) {
    for (let cx = 1; cx + CELL < w - 1; cx += CELL) {
      if (!stamped.has(`${cx},${cy}`)) continue

      // Right neighbor
      if (stamped.has(`${cx + CELL},${cy}`) && rng.next() < 0.55) {
        const by = cy + 1 + rng.int(0, CELL - 2)
        const ax = cx + CELL - 1
        const bx = cx + CELL
        const leftMass = floorMassNear(tiles, w, h, ax - 1, by)
        const rightMass = floorMassNear(tiles, w, h, bx + 1, by)
        if (leftMass >= 5 && rightMass >= 5) {
          tiles[idx(ax, by, w)] = 'floor'
          tiles[idx(bx, by, w)] = 'floor'
        }
      }

      // Down neighbor
      if (stamped.has(`${cx},${cy + CELL}`) && rng.next() < 0.55) {
        const bx = cx + 1 + rng.int(0, CELL - 2)
        const ay = cy + CELL - 1
        const by = cy + CELL
        const upMass = floorMassNear(tiles, w, h, bx, ay - 1)
        const downMass = floorMassNear(tiles, w, h, bx, by + 1)
        if (upMass >= 5 && downMass >= 5) {
          tiles[idx(bx, ay, w)] = 'floor'
          tiles[idx(bx, by, w)] = 'floor'
        }
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
