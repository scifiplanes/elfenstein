import type { Tile, Vec2 } from '../game/types'
import type { Rng } from './seededRng'
import type { GenRoom } from './types'
import { LEGACY_BSP_TUNING, type BspLayoutTuning } from './floorTopologyTuning'
import { carveCorridor, carveRect, center, type Rect } from './layoutPasses'

type BspNode =
  | { rect: Rect; depth: number; left: BspNode; right: BspNode }
  | { rect: Rect; depth: number; room: Rect }

function manhattan(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

export function runDungeonBspLayout(
  w: number,
  h: number,
  layoutRng: Rng,
  tuning: BspLayoutTuning = LEGACY_BSP_TUNING,
): { tiles: Tile[]; genRooms: GenRoom[] } {
  const tiles: Tile[] = Array.from({ length: w * h }, () => 'wall')
  const genRooms: GenRoom[] = []
  const minLeaf = Math.max(3, Math.min(12, Math.floor(tuning.minLeaf)))
  const maxDepth = Math.max(2, Math.min(12, Math.floor(tuning.maxDepth)))

  function split(rect: Rect, depth: number): BspNode {
    if (depth >= maxDepth || rect.w < minLeaf * 2 || rect.h < minLeaf * 2) {
      const rw = Math.max(3, Math.floor(rect.w * (tuning.roomWMinFrac + layoutRng.next() * tuning.roomWRandSpan)))
      const rh = Math.max(3, Math.floor(rect.h * (tuning.roomHMinFrac + layoutRng.next() * tuning.roomHRandSpan)))
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

  // Add a small number of extra connectors for cycles/alternate routes.
  // Deterministic via the existing layout RNG stream.
  if (genRooms.length >= 4) {
    const maxExtra = layoutRng.next() < tuning.extraConnectorHighChance ? 2 : 1
    const usedPairs = new Set<string>()
    const dMin = Math.max(4, Math.floor(tuning.extraConnectorMinDist))
    const dMax = Math.max(dMin + 2, Math.floor(tuning.extraConnectorMaxDist))
    const pairTries = Math.max(6, Math.min(40, Math.floor(tuning.extraConnectorTries)))
    for (let k = 0; k < maxExtra; k++) {
      let bestA: Vec2 | null = null
      let bestB: Vec2 | null = null
      let bestD = -1
      for (let tries = 0; tries < pairTries; tries++) {
        const i = layoutRng.int(0, genRooms.length)
        const j = layoutRng.int(0, genRooms.length)
        if (i === j) continue
        const a = genRooms[i].center
        const b = genRooms[j].center
        const d = manhattan(a, b)
        if (d < dMin || d > dMax) continue
        const key = i < j ? `${i}-${j}` : `${j}-${i}`
        if (usedPairs.has(key)) continue
        if (d > bestD) {
          bestD = d
          bestA = a
          bestB = b
        }
      }
      if (!bestA || !bestB) break
      const ia = genRooms.findIndex((r) => r.center.x === bestA!.x && r.center.y === bestA!.y)
      const ib = genRooms.findIndex((r) => r.center.x === bestB!.x && r.center.y === bestB!.y)
      if (ia >= 0 && ib >= 0) usedPairs.add(ia < ib ? `${ia}-${ib}` : `${ib}-${ia}`)
      carveCorridor(tiles, w, bestA.x, bestA.y, bestB.x, bestB.y, layoutRng.next() < 0.5)
    }
  }

  return { tiles, genRooms }
}
