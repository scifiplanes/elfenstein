import type { FloorPoi, ItemDefId, NpcKind, NpcLanguage, Tile, Vec2 } from '../game/types'
import { mulberry32, splitSeed } from './seededRng'
import type { FloorGenInput, FloorGenOutput, GenDoor, GenFloorItem, GenNpc, GenRoom } from './types'
import { allReachableWithLocks, bfsDistances, floodFillReachable, inBounds, isWalkable } from './validate'

type Rect = { x: number; y: number; w: number; h: number }

export function generateDungeon(input: FloorGenInput): FloorGenOutput {
  // Deterministic bounded rerolls when lock/key constraints fail validation.
  const maxAttempts = 6
  let last: FloorGenOutput | null = null
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const out = generateDungeonOnce(input, attempt)
    last = out
    if (validateGen(out, input.w, input.h)) return out
  }
  // Always return a full layout (never empty rooms): last attempt is valid geometry even if lock validation failed.
  return last ?? generateDungeonFallback(input)
}

function generateDungeonOnce(input: FloorGenInput, attempt: number): FloorGenOutput {
  const { seed, w, h } = input
  const attemptSeed = attempt === 0 ? seed : splitSeed(seed, 1000 + attempt)
  const streams = {
    layout: splitSeed(attemptSeed, 1),
    tags: splitSeed(attemptSeed, 2),
    population: splitSeed(attemptSeed, 3),
    locks: splitSeed(attemptSeed, 4),
  }
  const layoutRng = mulberry32(streams.layout)
  const tagsRng = mulberry32(streams.tags)
  const popRng = mulberry32(streams.population)
  const locksRng = mulberry32(streams.locks)

  const tiles: Tile[] = Array.from({ length: w * h }, () => 'wall')

  type BspNode =
    | { rect: Rect; depth: number; left: BspNode; right: BspNode }
    | { rect: Rect; depth: number; room: Rect }

  const rooms: Rect[] = []
  const genRooms: GenRoom[] = []

  function split(rect: Rect, depth: number): BspNode {
    const minLeaf = 6
    if (depth >= 6 || rect.w < minLeaf * 2 || rect.h < minLeaf * 2) {
      // Keep rooms smaller than their BSP leaf to preserve separating walls.
      const rw = Math.max(3, Math.floor(rect.w * (0.45 + layoutRng.next() * 0.25)))
      const rh = Math.max(3, Math.floor(rect.h * (0.45 + layoutRng.next() * 0.25)))
      const rx = rect.x + layoutRng.int(0, Math.max(1, rect.w - rw))
      const ry = rect.y + layoutRng.int(0, Math.max(1, rect.h - rh))
      const room = { x: rx, y: ry, w: rw, h: rh }
      rooms.push(room)
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
    } else {
      const cut = layoutRng.int(minLeaf, rect.h - minLeaf)
      const left = split({ x: rect.x, y: rect.y, w: rect.w, h: cut }, depth + 1)
      const right = split({ x: rect.x, y: rect.y + cut, w: rect.w, h: rect.h - cut }, depth + 1)
      return { rect, depth, left, right }
    }
  }

  const root = split({ x: 1, y: 1, w: w - 2, h: h - 2 }, 0)

  // Stitch corridors between sibling subtrees (BSP connectivity).
  const connect = (node: BspNode): Vec2 => {
    if ('room' in node) return center(node.room)
    const a = connect(node.left)
    const b = connect(node.right)
    carveCorridor(tiles, w, a.x, a.y, b.x, b.y, layoutRng.next() < 0.5)
    // Return either side's representative; bias to keep determinism stable.
    return layoutRng.next() < 0.5 ? a : b
  }
  connect(root)

  // Connectivity repair: ensure every walkable tile is connected.
  repairConnectivity(tiles, w, h, layoutRng)

  // CA smoothing (mild): soften jagged walls by carving alcoves.
  // This pass only converts some 'wall' cells into 'floor' based on local floor density,
  // so it cannot accidentally "seal" corridors.
  smoothWallsCarveOnly(tiles, w, h, 1)

  const { entrance, exit } = pickEntranceExit({ tiles, w, h, rooms: genRooms, rng: layoutRng })

  // Tag rooms (M4-lite): size + light thematic bias from floor properties.
  tagRooms(genRooms, input.floorProperties ?? [], tagsRng)

  // Populate POIs driven by tags and entrance/exit (deterministic).
  const pois = placePois({ tiles, w, h, rooms: genRooms, entrance, exit, rng: popRng })
  const occupied = new Set<string>(pois.map((p) => `${p.pos.x},${p.pos.y}`))

  // Spawn a small number of NPCs and extra floor items driven by room tags.
  const { npcs, floorItems: popItems } = spawnNpcsAndItems({
    tiles,
    w,
    h,
    rooms: genRooms,
    entrance,
    exit,
    occupied,
    rng: popRng,
  })

  // Minimal lock/key slice (A): lock a tile on the entrance→exit shortest path and
  // place an IronKey on the reachable side.
  const { doors, floorItems: lockItems } = placeSingleLockAndKey({
    tiles,
    w,
    h,
    entrance,
    exit,
    rng: locksRng,
    occupied,
  })
  for (const d of doors) occupied.add(`${d.pos.x},${d.pos.y}`)
  for (const it of lockItems) occupied.add(`${it.pos.x},${it.pos.y}`)
  for (const it of popItems) occupied.add(`${it.pos.x},${it.pos.y}`)
  for (const n of npcs) occupied.add(`${n.pos.x},${n.pos.y}`)

  const out: FloorGenOutput = {
    tiles,
    pois,
    rooms: genRooms,
    doors,
    floorItems: popItems.concat(lockItems),
    npcs,
    entrance,
    exit,
    meta: { genVersion: 1, inputSeed: seed, attemptSeed, attempt, w, h, streams },
  }
  return out
}

function generateDungeonFallback(input: FloorGenInput): FloorGenOutput {
  const { seed, w, h } = input
  const streams = { layout: splitSeed(seed, 1), tags: splitSeed(seed, 2), population: splitSeed(seed, 3), locks: splitSeed(seed, 4) }
  const tiles: Tile[] = Array.from({ length: w * h }, () => 'wall')
  const rw = Math.max(3, Math.min(w - 2, 9))
  const rh = Math.max(3, Math.min(h - 2, 9))
  const rx = Math.max(1, Math.floor((w - rw) / 2))
  const ry = Math.max(1, Math.floor((h - rh) / 2))
  const room: Rect = { x: rx, y: ry, w: rw, h: rh }
  carveRect(tiles, w, room)
  const genRooms: GenRoom[] = [{ id: 'r_0', rect: { ...room }, center: center(room), leafDepth: 0 }]
  const entrance = { x: rx, y: ry }
  const exit = { x: rx + rw - 1, y: ry + rh - 1 }
  return {
    tiles,
    pois: [],
    rooms: genRooms,
    doors: [],
    floorItems: [],
    npcs: [],
    entrance,
    exit,
    meta: { genVersion: 1, inputSeed: seed, attemptSeed: seed, attempt: 0, w, h, streams },
  }
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

function pickEntranceExit(args: {
  tiles: Tile[]
  w: number
  h: number
  rooms: GenRoom[]
  rng: { int(min: number, maxExclusive: number): number; next(): number }
}): { entrance: Vec2; exit: Vec2 } {
  const { tiles, w, h, rooms, rng } = args

  const preferred = rooms.length ? rooms[rng.int(0, rooms.length)].center : null
  const entrance = preferred && isGoodSpawn(tiles, w, h, preferred) ? preferred : (randomFloorCell({ tiles, w, h, rng }) ?? { x: 1, y: 1 })

  // Exit: farthest reachable cell by BFS distance (stable, good pacing).
  const dist = bfsDistances(tiles, w, h, entrance)
  let bestIdx = entrance.x + entrance.y * w
  let bestD = -1
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i]
    if (d > bestD && tiles[i] === 'floor') {
      bestD = d
      bestIdx = i
    }
  }
  const exit = { x: bestIdx % w, y: Math.floor(bestIdx / w) }
  return { entrance: { ...entrance }, exit: { ...exit } }
}

function isGoodSpawn(tiles: Tile[], w: number, h: number, pos: Vec2): boolean {
  if (!inBounds(pos, w, h)) return false
  const t = tiles[pos.x + pos.y * w]
  return isWalkable(t)
}

function randomFloorCell(args: { tiles: Tile[]; w: number; h: number; rng: { int(min: number, maxExclusive: number): number } }): Vec2 | null {
  const { tiles, w, h, rng } = args
  // Bounded attempt count keeps runtime stable and deterministic.
  for (let i = 0; i < 200; i++) {
    const x = rng.int(1, Math.max(2, w - 1))
    const y = rng.int(1, Math.max(2, h - 1))
    const t = tiles[x + y * w]
    if (t === 'floor') return { x, y }
  }
  return null
}

function repairConnectivity(tiles: Tile[], w: number, h: number, rng: { int(min: number, maxExclusive: number): number; next(): number }) {
  // Find a starting walkable cell.
  let startIdx = -1
  for (let i = 0; i < tiles.length; i++) {
    if (isWalkable(tiles[i])) {
      startIdx = i
      break
    }
  }
  if (startIdx < 0) return
  const start = { x: startIdx % w, y: Math.floor(startIdx / w) }

  // Repair loop is bounded for determinism/runtime safety.
  for (let pass = 0; pass < 24; pass++) {
    const reach = floodFillReachable(tiles, w, h, start)
    let unreachableIdx = -1
    for (let i = 0; i < tiles.length; i++) {
      if (isWalkable(tiles[i]) && !reach[i]) {
        unreachableIdx = i
        break
      }
    }
    if (unreachableIdx < 0) return

    // Choose a target in the unreachable component.
    const target = { x: unreachableIdx % w, y: Math.floor(unreachableIdx / w) }

    // Find the nearest reachable tile to connect to, via expanding Manhattan rings.
    const anchor = findNearestReachable(reach, w, h, target)
    if (!anchor) return

    carveCorridor(tiles, w, anchor.x, anchor.y, target.x, target.y, rng.next() < 0.5)
  }
}

function findNearestReachable(reach: boolean[], w: number, h: number, target: Vec2): Vec2 | null {
  // Expanding ring search is deterministic and fast for these grid sizes.
  const maxR = w + h
  for (let r = 1; r <= maxR; r++) {
    for (let dx = -r; dx <= r; dx++) {
      const dy = r - Math.abs(dx)
      const cand = [
        { x: target.x + dx, y: target.y + dy },
        { x: target.x + dx, y: target.y - dy },
      ]
      for (const p of cand) {
        if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) continue
        const i = p.x + p.y * w
        if (reach[i]) return p
      }
    }
  }
  return null
}

function placeSingleLockAndKey(args: {
  tiles: Tile[]
  w: number
  h: number
  entrance: Vec2
  exit: Vec2
  rng: { next(): number }
  occupied: Set<string>
}): { doors: GenDoor[]; floorItems: GenFloorItem[] } {
  const { tiles, w, h, entrance, exit, rng, occupied } = args

  // BFS with parent pointers over walkable tiles.
  const prev = new Int32Array(tiles.length)
  prev.fill(-1)
  const dist = new Int32Array(tiles.length)
  dist.fill(-1)

  const s = entrance.x + entrance.y * w
  const goal = exit.x + exit.y * w
  if (s < 0 || s >= tiles.length) return { doors: [], floorItems: [] }
  if (goal < 0 || goal >= tiles.length) return { doors: [], floorItems: [] }
  if (!isWalkable(tiles[s]) || !isWalkable(tiles[goal])) return { doors: [], floorItems: [] }

  const q: number[] = [s]
  dist[s] = 0

  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi]
    if (i === goal) break
    const x = i % w
    const y = (i / w) | 0
    const neigh = [i + 1, i - 1, i + w, i - w]
    for (const j of neigh) {
      if (j < 0 || j >= tiles.length) continue
      const nx = j % w
      const ny = (j / w) | 0
      if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue
      if (dist[j] !== -1) continue
      if (!isWalkable(tiles[j])) continue
      dist[j] = dist[i] + 1
      prev[j] = i
      q.push(j)
    }
  }

  if (dist[goal] < 0) return { doors: [], floorItems: [] }

  // Reconstruct path indices from entrance→exit.
  const path: number[] = []
  for (let cur = goal; cur !== -1; cur = prev[cur]) path.push(cur)
  path.reverse()
  if (path.length < 6) return { doors: [], floorItems: [] }

  // Pick a lock cell that actually separates exit from entrance (no alternate route around the lock).
  // Try from near-exit toward entrance so the gated segment is meaningful.
  for (let lockIdxOnPath = path.length - 3; lockIdxOnPath >= 2; lockIdxOnPath--) {
    const lockCell = path[lockIdxOnPath]
    const lx = lockCell % w
    const ly = (lockCell / w) | 0
    if (occupied.has(`${lx},${ly}`)) continue
    if (tiles[lockCell] !== 'floor') continue

    const testTiles = tiles.slice()
    testTiles[lockCell] = 'lockedDoor'
    const exitReachableWithLockClosed = allReachableWithLocks(testTiles, w, h, entrance, [exit], { lockedDoorsAreWalkable: false })
    if (exitReachableWithLockClosed) continue

    tiles[lockCell] = 'lockedDoor'
    const lockPos = { x: lx, y: ly }

    const keyIdxOnPath = clampInt(Math.floor(lockIdxOnPath * 0.45 + (rng.next() - 0.5) * 2), 1, lockIdxOnPath - 1)
    const keyCell = path[keyIdxOnPath]
    const keyPos = { x: keyCell % w, y: Math.floor(keyCell / w) }

    let placeKeyPos = tiles[keyCell] === 'floor' ? keyPos : entrance
    if (occupied.has(`${placeKeyPos.x},${placeKeyPos.y}`)) {
      const alt = findNearestUnusedFloor(tiles, w, h, placeKeyPos, occupied)
      if (alt) placeKeyPos = alt
    }

    const doors: GenDoor[] = [{ pos: lockPos, locked: true, lockId: 'A' }]
    const floorItems: GenFloorItem[] = [{ defId: 'IronKey', pos: placeKeyPos, qty: 1 }]
    return { doors, floorItems }
  }

  return { doors: [], floorItems: [] }
}

function clampInt(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(v)))
}

function validateGen(gen: FloorGenOutput, w: number, h: number): boolean {
  if (w <= 0 || h <= 0) return true
  if (gen.tiles.length !== w * h) return false

  // If we placed a key+lock, validate gating correctness.
  const key = gen.floorItems.find((it) => it.defId === 'IronKey')
  const hasLock = gen.doors.some((d) => d.locked && d.lockId === 'A')
  if (key && hasLock) {
    const keyReachable = allReachableWithLocks(gen.tiles, w, h, gen.entrance, [key.pos], { lockedDoorsAreWalkable: false })
    if (!keyReachable) return false
    const exitReachableBefore = allReachableWithLocks(gen.tiles, w, h, gen.entrance, [gen.exit], { lockedDoorsAreWalkable: false })
    if (exitReachableBefore) return false
    const exitReachableAfter = allReachableWithLocks(gen.tiles, w, h, gen.entrance, [gen.exit], { lockedDoorsAreWalkable: true })
    if (!exitReachableAfter) return false
  }
  return true
}

function smoothWallsCarveOnly(tiles: Tile[], w: number, h: number, passes: number) {
  const p = Math.max(0, Math.min(4, Math.floor(passes)))
  if (p === 0) return
  for (let pass = 0; pass < p; pass++) {
    const next = tiles.slice()
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = x + y * w
        if (tiles[i] !== 'wall') continue
        // Count 8-neighborhood floor density.
        let floors = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            const t = tiles[(x + dx) + (y + dy) * w]
            if (t === 'floor' || t === 'door' || t === 'lockedDoor') floors++
          }
        }
        // Threshold tuned to "carve alcoves" rather than open wide caverns.
        if (floors >= 6) next[i] = 'floor'
      }
    }
    for (let i = 0; i < tiles.length; i++) tiles[i] = next[i]
  }
}

function tagRooms(rooms: GenRoom[], floorProperties: Array<NonNullable<FloorGenInput['floorProperties']>[number]>, rng: { next(): number }) {
  const has = (p: string) => floorProperties.includes(p as any)
  for (const r of rooms) {
    const area = r.rect.w * r.rect.h
    const size = area <= 20 ? 'tiny' : area <= 48 ? 'medium' : 'large'
    const roomFunction =
      size === 'tiny' ? 'Storage' : size === 'large' ? (rng.next() < 0.55 ? 'Communal' : 'Workshop') : rng.next() < 0.5 ? 'Habitat' : 'Passage'

    // Very light first-pass bias; later this becomes a quota/adjacency solve.
    const roomStatus = has('Overgrown') && rng.next() < 0.35 ? 'Overgrown' : has('Destroyed') && rng.next() < 0.25 ? 'Destroyed' : undefined
    const roomProperties = has('Infested') && rng.next() < 0.28 ? 'Infected' : has('Cursed') && rng.next() < 0.12 ? 'Burning' : undefined

    r.tags = { ...(r.tags ?? {}), size, roomFunction, roomStatus, roomProperties }
  }
}

function placePois(args: {
  tiles: Tile[]
  w: number
  h: number
  rooms: GenRoom[]
  entrance: Vec2
  exit: Vec2
  rng: { next(): number }
}): FloorPoi[] {
  const { tiles, w, h, rooms, entrance, exit } = args

  const used = new Set<string>()
  const use = (p: Vec2) => used.add(`${p.x},${p.y}`)
  const ok = (p: Vec2) => p.x >= 0 && p.y >= 0 && p.x < w && p.y < h && tiles[p.x + p.y * w] === 'floor' && !used.has(`${p.x},${p.y}`)

  // Well: at/near entrance.
  const wellPos = ok(entrance) ? entrance : (findNearestFloor(tiles, w, h, entrance) ?? entrance)
  use(wellPos)

  // Bed: roughly mid-distance between entrance and exit (by distance field).
  const dist = bfsDistances(tiles, w, h, entrance)
  const exitIdx = exit.x + exit.y * w
  const maxD = exitIdx >= 0 && exitIdx < dist.length ? dist[exitIdx] : -1
  const targetD = Math.max(0, Math.floor(maxD * 0.45))
  const bedPos = pickClosestDistanceCell(dist, tiles, w, targetD, used) ?? wellPos
  use(bedPos)

  // Chest: prefer Storage/small rooms; fall back to far-ish from entrance.
  const storageRooms = rooms
    .filter((r) => r.tags?.roomFunction === 'Storage')
    .sort((a, b) => (a.rect.w * a.rect.h) - (b.rect.w * b.rect.h))
  let chestPos: Vec2 | null = null
  for (const r of storageRooms) {
    if (ok(r.center)) {
      chestPos = r.center
      break
    }
  }
  if (!chestPos) {
    chestPos = pickFarthestUnusedFloor(dist, tiles, w, used) ?? bedPos
  }
  use(chestPos)

  return [
    { id: 'poi_well', kind: 'Well', pos: wellPos },
    { id: 'poi_bed', kind: 'Bed', pos: bedPos },
    { id: 'poi_chest', kind: 'Chest', pos: chestPos, opened: false },
  ]
}

function findNearestFloor(tiles: Tile[], w: number, h: number, start: Vec2): Vec2 | null {
  const maxR = w + h
  for (let r = 0; r <= maxR; r++) {
    for (let dx = -r; dx <= r; dx++) {
      const dy = r - Math.abs(dx)
      const cand = [
        { x: start.x + dx, y: start.y + dy },
        { x: start.x + dx, y: start.y - dy },
      ]
      for (const p of cand) {
        if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) continue
        if (tiles[p.x + p.y * w] === 'floor') return p
      }
    }
  }
  return null
}

function pickClosestDistanceCell(dist: Int32Array, tiles: Tile[], w: number, targetD: number, used: Set<string>): Vec2 | null {
  let bestIdx = -1
  let bestErr = 1e9
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i]
    if (d < 0) continue
    if (tiles[i] !== 'floor') continue
    const x = i % w
    const y = Math.floor(i / w)
    if (used.has(`${x},${y}`)) continue
    const err = Math.abs(d - targetD)
    if (err < bestErr) {
      bestErr = err
      bestIdx = i
    }
  }
  if (bestIdx < 0) return null
  return { x: bestIdx % w, y: Math.floor(bestIdx / w) }
}

function pickFarthestUnusedFloor(dist: Int32Array, tiles: Tile[], w: number, used: Set<string>): Vec2 | null {
  let bestIdx = -1
  let bestD = -1
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i]
    if (d <= bestD) continue
    if (tiles[i] !== 'floor') continue
    const x = i % w
    const y = Math.floor(i / w)
    if (used.has(`${x},${y}`)) continue
    bestD = d
    bestIdx = i
  }
  if (bestIdx < 0) return null
  return { x: bestIdx % w, y: Math.floor(bestIdx / w) }
}

function spawnNpcsAndItems(args: {
  tiles: Tile[]
  w: number
  h: number
  rooms: GenRoom[]
  entrance: Vec2
  exit: Vec2
  occupied: Set<string>
  rng: { next(): number; int(min: number, maxExclusive: number): number; pick<T>(arr: readonly T[]): T }
}): { npcs: GenNpc[]; floorItems: GenFloorItem[] } {
  const { tiles, w, h, rooms, entrance, exit, occupied, rng } = args

  const npcs: GenNpc[] = []
  const floorItems: GenFloorItem[] = []

  const keyOf = (p: Vec2) => `${p.x},${p.y}`
  const isFreeFloor = (p: Vec2) =>
    p.x >= 0 && p.y >= 0 && p.x < w && p.y < h && tiles[p.x + p.y * w] === 'floor' && !occupied.has(keyOf(p))

  // Pick up to 4 rooms far from entrance for NPCs; keep one closer neutral.
  const dist = bfsDistances(tiles, w, h, entrance)
  const roomScore = (r: GenRoom) => {
    const i = r.center.x + r.center.y * w
    const d = i >= 0 && i < dist.length ? dist[i] : -1
    return d
  }
  const candidates = rooms
    .filter((r) => isFreeFloor(r.center))
    .map((r) => ({ r, d: roomScore(r) }))
    .filter((x) => x.d >= 0)
    .sort((a, b) => b.d - a.d)

  const npcRooms = candidates.slice(0, Math.min(4, candidates.length)).map((x) => x.r)
  const nearRooms = candidates.slice(-Math.min(2, candidates.length)).map((x) => x.r)

  const langList: NpcLanguage[] = ['DeepGnome', 'Zalgo', 'Mojibake']
  const wants: ItemDefId[] = ['Mushrooms', 'Foodroot', 'Ash', 'Sulfur', 'Stick', 'Stone']
  const hated: ItemDefId[] = ['Stone', 'Stick', 'Mushrooms', 'Foodroot']

  const pickQuest = (i: number) => {
    const wId = wants[i % wants.length]
    const h1 = hated[(i + 1) % hated.length]
    const h2 = hated[(i + 2) % hated.length]
    const hs = Array.from(new Set([h1, h2].filter((x) => x !== wId)))
    return { wants: wId, hated: hs.length ? hs : ['Stone'] }
  }

  const npcFromRoom = (room: GenRoom, idx: number, isNear: boolean): GenNpc | null => {
    const pos = room.center
    if (!isFreeFloor(pos)) return null
    const func = room.tags?.roomFunction
    const prop = room.tags?.roomProperties

    const kind: NpcKind =
      prop === 'Infected' ? 'Skeleton'
      : func === 'Workshop' ? 'Catoctopus'
      : func === 'Storage' ? 'Bobr'
      : 'Wurglepup'

    const status: GenNpc['status'] = kind === 'Skeleton' ? 'hostile' : isNear ? 'neutral' : rng.next() < 0.25 ? 'hostile' : 'neutral'
    const language = langList[(idx * 17 + (kind.charCodeAt(0) % 7)) % langList.length]
    const name = kind
    const hp = kind === 'Skeleton' ? 18 : kind === 'Bobr' ? 24 : kind === 'Catoctopus' ? 22 : 20
    return {
      id: `g_npc_${kind}_${idx}_${pos.x}_${pos.y}`,
      kind,
      name,
      pos,
      status,
      hp,
      language,
      quest: status === 'hostile' ? undefined : pickQuest(idx),
    }
  }

  // Spawn 1–3 far NPCs and 1 near neutral NPC (if possible).
  let idx = 0
  for (const r of npcRooms) {
    if (npcs.length >= 3) break
    const npc = npcFromRoom(r, idx++, false)
    if (!npc) continue
    npcs.push(npc)
    occupied.add(keyOf(npc.pos))
  }
  for (const r of nearRooms) {
    if (npcs.length >= 4) break
    const npc = npcFromRoom(r, idx++, true)
    if (!npc) continue
    // Ensure at least one non-hostile.
    if (npcs.some((n) => n.status !== 'hostile')) break
    npcs.push(npc)
    occupied.add(keyOf(npc.pos))
  }

  // Spawn a few floor items based on room function.
  const itemForFunc: Partial<Record<'Passage' | 'Habitat' | 'Workshop' | 'Communal' | 'Storage', ItemDefId>> = {
    Habitat: 'Mushrooms',
    Workshop: 'Ash',
    Storage: 'Stone',
    Communal: 'Foodroot',
  }
  const itemRooms = candidates
    .filter((x) => x.d > 0)
    .map((x) => x.r)
    .slice(0, 6)
  let itemIdx = 0
  for (const r of itemRooms) {
    if (floorItems.length >= 4) break
    const func = r.tags?.roomFunction
    const defId = (func && itemForFunc[func]) || (rng.next() < 0.5 ? 'Stick' : 'Stone')
    const pos = r.center
    if (!isFreeFloor(pos)) continue
    floorItems.push({ defId, pos, qty: 1 })
    occupied.add(keyOf(pos))
    itemIdx++
  }

  // Avoid spawning right on exit.
  occupied.add(keyOf(exit))

  return { npcs, floorItems }
}

function findNearestUnusedFloor(tiles: Tile[], w: number, h: number, start: Vec2, occupied: Set<string>): Vec2 | null {
  const maxR = w + h
  for (let r = 0; r <= maxR; r++) {
    for (let dx = -r; dx <= r; dx++) {
      const dy = r - Math.abs(dx)
      const cand = [
        { x: start.x + dx, y: start.y + dy },
        { x: start.x + dx, y: start.y - dy },
      ]
      for (const p of cand) {
        if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) continue
        if (tiles[p.x + p.y * w] !== 'floor') continue
        if (occupied.has(`${p.x},${p.y}`)) continue
        return p
      }
    }
  }
  return null
}

