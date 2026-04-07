import type { Tile, Vec2 } from '../game/types'
import type { Rng } from './seededRng'
import type { GenRoom } from './types'
import { carveCorridor, carveRect, center, type Rect } from './layoutPasses'

type BspNode =
  | { rect: Rect; depth: number; left: BspNode; right: BspNode }
  | { rect: Rect; depth: number; room: Rect }

export function runDungeonBspLayout(w: number, h: number, layoutRng: Rng): { tiles: Tile[]; genRooms: GenRoom[] } {
  const tiles: Tile[] = Array.from({ length: w * h }, () => 'wall')
  const genRooms: GenRoom[] = []

  function split(rect: Rect, depth: number): BspNode {
    const minLeaf = 6
    if (depth >= 6 || rect.w < minLeaf * 2 || rect.h < minLeaf * 2) {
      const rw = Math.max(3, Math.floor(rect.w * (0.45 + layoutRng.next() * 0.25)))
      const rh = Math.max(3, Math.floor(rect.h * (0.45 + layoutRng.next() * 0.25)))
      const rx = rect.x + layoutRng.int(0, Math.max(1, rect.w - rw))
      const ry = rect.y + layoutRng.int(0, Math.max(1, rect.h - rh))
      const room = { x: rx, y: ry, w: rw, h: rh }
      carveRect(tiles, w, room)
      const c = center(room)
      genRooms.push({ id: `r_${genRooms.length}`, rect: { ...room }, center: c, leafDepth: depth })
      return { rect, depth, room }
    }
    const splitVert = rect.w > rect.h ? true : rect.h > rect.w ? false : layoutRng.next() < 0.5
    if (splitVert) {
      const cut = layoutRng.int(minLeaf, rect.w - minLeaf)
      const left = split({ x: rect.x, y: rect.y, w: cut, h: rect.h }, depth + 1)
      const right = split({ x: rect.x + cut, y: rect.y, w: rect.w - cut, h: rect.h }, depth + 1)
      return { rect, depth, left, right }
    }
    const cut = layoutRng.int(minLeaf, rect.h - minLeaf)
    const left = split({ x: rect.x, y: rect.y, w: rect.w, h: cut }, depth + 1)
    const right = split({ x: rect.x, y: rect.y + cut, w: rect.w, h: rect.h - cut }, depth + 1)
    return { rect, depth, left, right }
  }

  const root = split({ x: 1, y: 1, w: w - 2, h: h - 2 }, 0)

  const connect = (node: BspNode): Vec2 => {
    if ('room' in node) return center(node.room)
    const a = connect(node.left)
    const b = connect(node.right)
    carveCorridor(tiles, w, a.x, a.y, b.x, b.y, layoutRng.next() < 0.5)
    return layoutRng.next() < 0.5 ? a : b
  }
  connect(root)

  return { tiles, genRooms }
}
