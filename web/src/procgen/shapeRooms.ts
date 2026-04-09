import { isAnyDoorTile } from '../game/tiles'
import type { Tile, Vec2 } from '../game/types'
import type { Rng } from './seededRng'
import type { FloorType, GenRoom } from './types'
import { floodFillReachable, isWalkable } from './validate'

function idx(x: number, y: number, w: number): number {
  return x + y * w
}

function inBoundsInner(x: number, y: number, w: number, h: number): boolean {
  return x > 0 && y > 0 && x < w - 1 && y < h - 1
}

function isDoorish(t: Tile): boolean {
  return isAnyDoorTile(t)
}

function isFloorish(t: Tile): boolean {
  return t === 'floor' || isAnyDoorTile(t)
}

function hasDoorishNeighbor(tiles: Tile[], w: number, x: number, y: number): boolean {
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const nx = x + dx
    const ny = y + dy
    const t = tiles[idx(nx, ny, w)]
    if (isDoorish(t)) return true
  }
  return false
}

function eightNeighborFloorCount(tiles: Tile[], w: number, x: number, y: number): number {
  let n = 0
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const t = tiles[idx(x + dx, y + dy, w)]
      if (isFloorish(t)) n++
    }
  }
  return n
}

function fourNeighborFloorCount(tiles: Tile[], w: number, x: number, y: number): number {
  let n = 0
  if (isFloorish(tiles[idx(x + 1, y, w)])) n++
  if (isFloorish(tiles[idx(x - 1, y, w)])) n++
  if (isFloorish(tiles[idx(x, y + 1, w)])) n++
  if (isFloorish(tiles[idx(x, y - 1, w)])) n++
  return n
}

export function addPillarsInRooms(args: {
  tiles: Tile[]
  w: number
  h: number
  rooms: GenRoom[]
  rng: Pick<Rng, 'next' | 'int'>
  maxPerRoom: number
}): { pillarsAdded: number } {
  const { tiles, w, h, rooms, rng, maxPerRoom } = args
  let pillarsAdded = 0
  const cap = Math.max(0, Math.min(6, Math.floor(maxPerRoom)))
  if (!cap) return { pillarsAdded: 0 }

  for (const r of rooms) {
    const area = r.rect.w * r.rect.h
    if (area < 36) continue
    const target = Math.min(cap, 1 + (rng.next() < 0.35 ? 1 : 0) + (area > 90 && rng.next() < 0.25 ? 1 : 0))
    let placed = 0
    const tries = 22 + target * 10
    for (let t = 0; t < tries && placed < target; t++) {
      const x = rng.int(r.rect.x + 2, Math.max(r.rect.x + 3, r.rect.x + r.rect.w - 2))
      const y = rng.int(r.rect.y + 2, Math.max(r.rect.y + 3, r.rect.y + r.rect.h - 2))
      if (!inBoundsInner(x, y, w, h)) continue
      const i = idx(x, y, w)
      if (tiles[i] !== 'floor') continue
      if (hasDoorishNeighbor(tiles, w, x, y)) continue

      // Clearance: keep surrounding walkability so we don't create pinches.
      if (fourNeighborFloorCount(tiles, w, x, y) < 4) continue
      if (eightNeighborFloorCount(tiles, w, x, y) < 7) continue

      // Avoid pillar clumps: require at least one-tile ring of non-walls.
      let ok = true
      for (let dy = -1; dy <= 1 && ok; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const tt = tiles[idx(x + dx, y + dy, w)]
          if (tt === 'wall') ok = false
        }
      }
      if (!ok) continue

      tiles[i] = 'wall'
      placed++
      pillarsAdded++
    }
  }

  return { pillarsAdded }
}

export function carveAlcovesOnRoomEdges(args: {
  tiles: Tile[]
  w: number
  h: number
  rooms: GenRoom[]
  rng: Pick<Rng, 'next' | 'int'>
  perRoomChance: number
}): { alcovesCarved: number } {
  const { tiles, w, h, rooms, rng } = args
  const perRoomChance = Math.max(0, Math.min(1, args.perRoomChance))
  let alcovesCarved = 0

  for (const r of rooms) {
    if (rng.next() > perRoomChance) continue
    const attempts = 6
    const maxPerRoom = 1 + (rng.next() < 0.25 ? 1 : 0)
    let carvedHere = 0

    for (let a = 0; a < attempts && carvedHere < maxPerRoom; a++) {
      const side = rng.int(0, 4) // 0 top,1 bottom,2 left,3 right
      const depth = 2 + (rng.next() < 0.45 ? 1 : 0) + (rng.next() < 0.2 ? 1 : 0)

      let sx = r.center.x
      let sy = r.center.y
      let dx = 0
      let dy = 0

      if (side === 0) {
        // top edge -> carve upward
        sy = r.rect.y + 1
        sx = rng.int(r.rect.x + 2, Math.max(r.rect.x + 3, r.rect.x + r.rect.w - 2))
        dx = 0
        dy = -1
      } else if (side === 1) {
        sy = r.rect.y + r.rect.h - 2
        sx = rng.int(r.rect.x + 2, Math.max(r.rect.x + 3, r.rect.x + r.rect.w - 2))
        dx = 0
        dy = 1
      } else if (side === 2) {
        sx = r.rect.x + 1
        sy = rng.int(r.rect.y + 2, Math.max(r.rect.y + 3, r.rect.y + r.rect.h - 2))
        dx = -1
        dy = 0
      } else {
        sx = r.rect.x + r.rect.w - 2
        sy = rng.int(r.rect.y + 2, Math.max(r.rect.y + 3, r.rect.y + r.rect.h - 2))
        dx = 1
        dy = 0
      }

      if (!inBoundsInner(sx, sy, w, h)) continue
      if (tiles[idx(sx, sy, w)] !== 'floor') continue
      if (hasDoorishNeighbor(tiles, w, sx, sy)) continue

      // Carve outward only through walls.
      let ok = true
      for (let s = 1; s <= depth; s++) {
        const x = sx + dx * s
        const y = sy + dy * s
        if (!inBoundsInner(x, y, w, h)) {
          ok = false
          break
        }
        if (tiles[idx(x, y, w)] !== 'wall') {
          ok = false
          break
        }
      }
      if (!ok) continue

      for (let s = 1; s <= depth; s++) {
        const x = sx + dx * s
        const y = sy + dy * s
        tiles[idx(x, y, w)] = 'floor'
      }
      carvedHere++
      alcovesCarved++
    }
  }

  return { alcovesCarved }
}

export function jitterRoomPerimeters(args: {
  tiles: Tile[]
  w: number
  h: number
  rooms: GenRoom[]
  rng: Pick<Rng, 'next' | 'int'>
  strength: number
}): { notchesCarved: number } {
  const { tiles, w, h, rooms, rng } = args
  const strength = Math.max(0, Math.min(1, args.strength))
  let notchesCarved = 0
  if (strength <= 0) return { notchesCarved: 0 }

  for (const r of rooms) {
    const area = r.rect.w * r.rect.h
    if (area < 25) continue
    const attempts = Math.floor(2 + strength * 6)
    for (let t = 0; t < attempts; t++) {
      if (rng.next() > strength) continue
      // Pick a perimeter-adjacent interior cell and carve a 1-tile notch into wall outward.
      const side = rng.int(0, 4)
      let x = r.center.x
      let y = r.center.y
      let dx = 0
      let dy = 0
      if (side === 0) {
        y = r.rect.y + 1
        x = rng.int(r.rect.x + 1, r.rect.x + r.rect.w - 1)
        dx = 0
        dy = -1
      } else if (side === 1) {
        y = r.rect.y + r.rect.h - 2
        x = rng.int(r.rect.x + 1, r.rect.x + r.rect.w - 1)
        dx = 0
        dy = 1
      } else if (side === 2) {
        x = r.rect.x + 1
        y = rng.int(r.rect.y + 1, r.rect.y + r.rect.h - 1)
        dx = -1
        dy = 0
      } else {
        x = r.rect.x + r.rect.w - 2
        y = rng.int(r.rect.y + 1, r.rect.y + r.rect.h - 1)
        dx = 1
        dy = 0
      }
      if (!inBoundsInner(x, y, w, h)) continue
      if (tiles[idx(x, y, w)] !== 'floor') continue
      if (hasDoorishNeighbor(tiles, w, x, y)) continue

      const ox = x + dx
      const oy = y + dy
      if (!inBoundsInner(ox, oy, w, h)) continue
      const oi = idx(ox, oy, w)
      if (tiles[oi] !== 'wall') continue
      tiles[oi] = 'floor'
      notchesCarved++
    }
  }

  return { notchesCarved }
}

export function applyRoomShaping(args: {
  tiles: Tile[]
  w: number
  h: number
  rooms: GenRoom[]
  floorType: FloorType
  rng: Pick<Rng, 'next' | 'int'>
}): { pillarsAdded: number; alcovesCarved: number; notchesCarved: number } {
  const { tiles, w, h, rooms, floorType, rng } = args

  if (floorType === 'Dungeon') {
    const p = addPillarsInRooms({ tiles, w, h, rooms, rng, maxPerRoom: 3 })
    const a = carveAlcovesOnRoomEdges({ tiles, w, h, rooms, rng, perRoomChance: 0.18 })
    const j = jitterRoomPerimeters({ tiles, w, h, rooms, rng, strength: 0.12 })
    return { pillarsAdded: p.pillarsAdded, alcovesCarved: a.alcovesCarved, notchesCarved: j.notchesCarved }
  }

  if (floorType === 'Ruins') {
    const p = addPillarsInRooms({ tiles, w, h, rooms, rng, maxPerRoom: 0 })
    const a = carveAlcovesOnRoomEdges({ tiles, w, h, rooms, rng, perRoomChance: 0.5 })
    const j = jitterRoomPerimeters({ tiles, w, h, rooms, rng, strength: 0.42 })
    return { pillarsAdded: p.pillarsAdded, alcovesCarved: a.alcovesCarved, notchesCarved: j.notchesCarved }
  }

  // Cave
  const p = addPillarsInRooms({ tiles, w, h, rooms, rng, maxPerRoom: 0 })
  const a = carveAlcovesOnRoomEdges({ tiles, w, h, rooms, rng, perRoomChance: 0.35 })
  const j = jitterRoomPerimeters({ tiles, w, h, rooms, rng, strength: 0.35 })
  return { pillarsAdded: p.pillarsAdded, alcovesCarved: a.alcovesCarved, notchesCarved: j.notchesCarved }
}

function countWalkableTiles(tiles: Tile[]): number {
  let n = 0
  for (const t of tiles) if (isWalkable(t)) n++
  return n
}

function findFirstWalkable(tiles: Tile[], w: number): Vec2 | null {
  for (let i = 0; i < tiles.length; i++) {
    if (!isWalkable(tiles[i])) continue
    return { x: i % w, y: (i / w) | 0 }
  }
  return null
}

/**
 * Apply shaping, but revert if it disconnects the map or reduces walkable mass too much.
 * Intended to be used per-attempt during procgen.
 */
export function applyRoomShapingGuarded(args: {
  tiles: Tile[]
  w: number
  h: number
  rooms: GenRoom[]
  floorType: FloorType
  rng: Pick<Rng, 'next' | 'int'>
}): { applied: boolean; pillarsAdded: number; alcovesCarved: number; notchesCarved: number } {
  const { tiles, w, h } = args
  if (w <= 0 || h <= 0 || tiles.length !== w * h) {
    return { applied: false, pillarsAdded: 0, alcovesCarved: 0, notchesCarved: 0 }
  }

  const start = findFirstWalkable(tiles, w)
  if (!start) return { applied: false, pillarsAdded: 0, alcovesCarved: 0, notchesCarved: 0 }

  const beforeTiles = tiles.slice()
  const beforeWalkable = countWalkableTiles(beforeTiles)

  const shaped = applyRoomShaping(args)

  const afterWalkable = countWalkableTiles(tiles)
  const reach = floodFillReachable(tiles, w, h, start)
  for (let i = 0; i < tiles.length; i++) {
    if (isWalkable(tiles[i]) && !reach[i]) {
      for (let j = 0; j < tiles.length; j++) tiles[j] = beforeTiles[j]
      return { applied: false, pillarsAdded: 0, alcovesCarved: 0, notchesCarved: 0 }
    }
  }

  const maxLoss = Math.max(8, Math.floor(beforeWalkable * 0.08))
  if (afterWalkable < beforeWalkable - maxLoss) {
    for (let j = 0; j < tiles.length; j++) tiles[j] = beforeTiles[j]
    return { applied: false, pillarsAdded: 0, alcovesCarved: 0, notchesCarved: 0 }
  }

  return { applied: true, ...shaped }
}

