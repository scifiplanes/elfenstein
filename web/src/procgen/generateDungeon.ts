import type { FloorPoi, Tile } from '../game/types'
import { mulberry32, splitSeed } from './seededRng'

export type DungeonGenInput = {
  seed: number
  w: number
  h: number
}

type Rect = { x: number; y: number; w: number; h: number }

export function generateDungeon(input: DungeonGenInput): { tiles: Tile[]; pois: FloorPoi[] } {
  const { seed, w, h } = input
  const layoutRng = mulberry32(splitSeed(seed, 1))
  const poiRng = mulberry32(splitSeed(seed, 2))

  const tiles: Tile[] = Array.from({ length: w * h }, () => 'wall')

  const leaves: Rect[] = []
  function split(rect: Rect, depth: number) {
    const minLeaf = 7
    if (depth >= 5 || rect.w < minLeaf * 2 || rect.h < minLeaf * 2) {
      leaves.push(rect)
      return
    }
    const splitVert = rect.w > rect.h ? true : rect.h > rect.w ? false : layoutRng.next() < 0.5
    if (splitVert) {
      const cut = layoutRng.int(minLeaf, rect.w - minLeaf)
      split({ x: rect.x, y: rect.y, w: cut, h: rect.h }, depth + 1)
      split({ x: rect.x + cut, y: rect.y, w: rect.w - cut, h: rect.h }, depth + 1)
    } else {
      const cut = layoutRng.int(minLeaf, rect.h - minLeaf)
      split({ x: rect.x, y: rect.y, w: rect.w, h: cut }, depth + 1)
      split({ x: rect.x, y: rect.y + cut, w: rect.w, h: rect.h - cut }, depth + 1)
    }
  }

  split({ x: 1, y: 1, w: w - 2, h: h - 2 }, 0)

  const rooms: Rect[] = []
  for (const leaf of leaves) {
    const rw = Math.max(3, Math.floor(leaf.w * (0.6 + layoutRng.next() * 0.2)))
    const rh = Math.max(3, Math.floor(leaf.h * (0.6 + layoutRng.next() * 0.2)))
    const rx = leaf.x + layoutRng.int(0, Math.max(1, leaf.w - rw))
    const ry = leaf.y + layoutRng.int(0, Math.max(1, leaf.h - rh))
    rooms.push({ x: rx, y: ry, w: rw, h: rh })
    carveRect(tiles, w, { x: rx, y: ry, w: rw, h: rh })
  }

  // Stitch corridors between consecutive rooms (simple chain for MVP).
  for (let i = 1; i < rooms.length; i++) {
    const a = center(rooms[i - 1])
    const b = center(rooms[i])
    carveCorridor(tiles, w, a.x, a.y, b.x, b.y, layoutRng.next() < 0.5)
  }

  // POIs: pick random floor tiles.
  const floorCells = []
  for (let i = 0; i < tiles.length; i++) if (tiles[i] === 'floor') floorCells.push(i)
  const pois: FloorPoi[] = []
  const kinds: FloorPoi['kind'][] = ['Well', 'Chest', 'Bed']
  for (let k = 0; k < kinds.length; k++) {
    const idx = floorCells[poiRng.int(0, floorCells.length)]
    const x = idx % w
    const y = Math.floor(idx / w)
    pois.push({ id: `poi_${kinds[k].toLowerCase()}`, kind: kinds[k], pos: { x, y }, opened: kinds[k] === 'Chest' ? false : undefined })
  }

  return { tiles, pois }
}

function carveRect(tiles: Tile[], w: number, r: Rect) {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      tiles[x + y * w] = 'floor'
    }
  }
}

function carveCorridor(tiles: Tile[], w: number, ax: number, ay: number, bx: number, by: number, horizFirst: boolean) {
  if (horizFirst) {
    carveLine(tiles, w, ax, ay, bx, ay)
    carveLine(tiles, w, bx, ay, bx, by)
  } else {
    carveLine(tiles, w, ax, ay, ax, by)
    carveLine(tiles, w, ax, by, bx, by)
  }
}

function carveLine(tiles: Tile[], w: number, x0: number, y0: number, x1: number, y1: number) {
  const dx = Math.sign(x1 - x0)
  const dy = Math.sign(y1 - y0)
  let x = x0
  let y = y0
  tiles[x + y * w] = 'floor'
  while (x !== x1 || y !== y1) {
    if (x !== x1) x += dx
    if (y !== y1) y += dy
    tiles[x + y * w] = 'floor'
  }
}

function center(r: Rect) {
  return { x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) }
}

