import type { Tile, Vec2 } from '../game/types'
import type { Rng } from './seededRng'
import type { DistrictTag, FloorProperty, GenRoom } from './types'
import { isWalkable } from './validate'
import { shortestPathIndices } from './locks'

const DISTRICT_POOL: DistrictTag[] = ['NorthWing', 'SouthWing', 'EastWing', 'WestWing', 'Core', 'Ruin']

function manhattan(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

/** Seeded Voronoi on room centers: each room gets a district tag (deterministic tie-break by room id). */
export function assignDistrictsToRooms(rooms: GenRoom[], w: number, h: number, rng: Pick<Rng, 'next'>): void {
  if (!rooms.length) return

  const k = Math.min(4, Math.max(2, Math.floor(Math.sqrt(rooms.length)) + 1))
  const seeds: Array<{ x: number; y: number; tag: DistrictTag }> = []
  for (let i = 0; i < k; i++) {
    const x = 2 + Math.floor(rng.next() * Math.max(1, w - 4))
    const y = 2 + Math.floor(rng.next() * Math.max(1, h - 4))
    seeds.push({ x, y, tag: DISTRICT_POOL[i % DISTRICT_POOL.length] })
  }

  const sortedRooms = [...rooms].sort((a, b) => a.id.localeCompare(b.id))
  for (const r of sortedRooms) {
    const cx = r.center.x
    const cy = r.center.y
    let best = seeds[0]
    let bestD = (cx - best.x) ** 2 + (cy - best.y) ** 2
    for (let s = 1; s < seeds.length; s++) {
      const d = (cx - seeds[s].x) ** 2 + (cy - seeds[s].y) ** 2
      if (d < bestD || (d === bestD && seeds[s].tag.localeCompare(best.tag) < 0)) {
        bestD = d
        best = seeds[s]
      }
    }
    r.district = best.tag
  }
}

function rectDistanceChebyshev(a: GenRoom['rect'], b: GenRoom['rect']): number {
  // 0 means overlap; 1 means touch within one tile gap.
  const ax2 = a.x + a.w - 1
  const ay2 = a.y + a.h - 1
  const bx2 = b.x + b.w - 1
  const by2 = b.y + b.h - 1
  const dx = a.x > bx2 ? a.x - bx2 : b.x > ax2 ? b.x - ax2 : 0
  const dy = a.y > by2 ? a.y - by2 : b.y > ay2 ? b.y - ay2 : 0
  return Math.max(dx, dy)
}

function boundedBfsDistance(
  tiles: Tile[],
  w: number,
  start: Vec2,
  goal: Vec2,
  maxDist: number,
): number {
  if (maxDist <= 0) return -1
  const s = start.x + start.y * w
  const g = goal.x + goal.y * w
  if (s < 0 || g < 0 || s >= tiles.length || g >= tiles.length) return -1
  if (!isWalkable(tiles[s]) || !isWalkable(tiles[g])) return -1
  if (s === g) return 0

  const dist = new Int16Array(tiles.length)
  dist.fill(-1)
  const q: number[] = [s]
  dist[s] = 0

  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi]
    const d = dist[i]
    if (d >= maxDist) continue
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
      dist[j] = (d + 1) as number
      if (j === g) return dist[j]
      q.push(j)
    }
  }
  return -1
}

/**
 * Deterministic room adjacency graph used for clustering/tag solving.
 *
 * Rooms are adjacent when:
 * - their rects are within 1 tile gap (Chebyshev distance <= 1), OR
 * - their centers are within a short walkable BFS distance (bounded), gated by a Manhattan precheck.
 *
 * Output is stable by room id ordering.
 */
export function buildRoomAdjacency(rooms: GenRoom[], tiles: Tile[], w: number): Map<string, string[]> {
  const sorted = [...rooms].sort((a, b) => a.id.localeCompare(b.id))
  const adj = new Map<string, string[]>()
  for (const r of sorted) adj.set(r.id, [])

  const MAX_CENTER_MANHATTAN = 14
  const MAX_BFS = 12

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]
      const b = sorted[j]
      const nearRects = rectDistanceChebyshev(a.rect, b.rect) <= 1
      let ok = nearRects
      if (!ok) {
        const md = manhattan(a.center, b.center)
        if (md <= MAX_CENTER_MANHATTAN) {
          const d = boundedBfsDistance(tiles, w, a.center, b.center, MAX_BFS)
          ok = d >= 0
        }
      }
      if (!ok) continue
      adj.get(a.id)!.push(b.id)
      adj.get(b.id)!.push(a.id)
    }
  }

  // Keep neighbor lists stable.
  for (const [id, list] of adj.entries()) {
    list.sort((a, b) => a.localeCompare(b))
    adj.set(id, list)
  }
  return adj
}

/**
 * Rooms whose centers lie on (or near) the entrance→exit shortest path are considered “on the main band”.
 * This is used to bias solver decisions for pacing (e.g. Storage off-path).
 */
export function computeMainPathBandRooms(args: {
  tiles: Tile[]
  w: number
  h: number
  entrance: Vec2
  exit: Vec2
  rooms: GenRoom[]
  radius?: number
}): Set<string> {
  const { tiles, w, h, entrance, exit, rooms } = args
  const r = Math.max(0, Math.min(3, Math.floor(args.radius ?? 1)))
  const path = shortestPathIndices(tiles, w, h, entrance, exit)
  if (!path?.length) return new Set()
  const bandCells = new Set<string>()
  for (const i of path) {
    const px = i % w
    const py = (i / w) | 0
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = px + dx
        const y = py + dy
        if (x < 0 || y < 0 || x >= w || y >= h) continue
        bandCells.add(`${x},${y}`)
      }
    }
  }
  const out = new Set<string>()
  for (const room of rooms) {
    if (bandCells.has(`${room.center.x},${room.center.y}`)) out.add(room.id)
  }
  return out
}

/**
 * Quota-aware tagging (deterministic room id order) + floor property bias from DESIGN taxonomy.
 */
export function tagRoomsWithQuotas(
  rooms: GenRoom[],
  floorProperties: FloorProperty[] | undefined,
  rng: Pick<Rng, 'next'>,
): void {
  const props = floorProperties ?? []
  const has = (p: FloorProperty) => props.includes(p)
  const sorted = [...rooms].sort((a, b) => a.id.localeCompare(b.id))

  let storageQuota = Math.min(2, Math.max(1, Math.floor(sorted.length / 5)))

  for (const r of sorted) {
    // Derived rooms (e.g. junction/connector anchors) may be pre-tagged to keep quotas stable.
    // If a room already has an explicit function+size, treat it as fixed and only roll status/props.
    const existingSize = r.tags?.size
    const existingFn = r.tags?.roomFunction

    const area = r.rect.w * r.rect.h
    const size = existingSize ?? (area <= 20 ? 'tiny' : area <= 48 ? 'medium' : 'large')

    let roomFunction: NonNullable<GenRoom['tags']>['roomFunction']
    if (existingFn) {
      roomFunction = existingFn
    } else if (size === 'tiny') {
      if (storageQuota > 0 && rng.next() < 0.55) {
        roomFunction = 'Storage'
        storageQuota--
      } else {
        roomFunction = 'Passage'
      }
    } else if (size === 'large') {
      roomFunction = rng.next() < 0.55 ? 'Communal' : 'Workshop'
    } else {
      roomFunction = rng.next() < 0.5 ? 'Habitat' : 'Passage'
    }

    const roomStatus =
      has('Overgrown') && rng.next() < 0.35 ? 'Overgrown' : has('Destroyed') && rng.next() < 0.25 ? 'Destroyed' : undefined

    let roomProperties: NonNullable<GenRoom['tags']>['roomProperties'] = undefined
    if (has('Infested') && rng.next() < 0.28) roomProperties = 'Infected'
    else if (has('Cursed') && rng.next() < 0.12) roomProperties = 'Burning'
    else if (has('Overgrown') && rng.next() < 0.14) roomProperties = 'SporeMist'
    else if (has('Destroyed') && rng.next() < 0.1) roomProperties = 'Unstable'
    else if (has('Cursed') && rng.next() < 0.07) roomProperties = rng.next() < 0.5 ? 'Haunted' : 'RoyalMiasma'
    else if (has('Cursed') && rng.next() < 0.06) roomProperties = 'NanoHaze'

    r.tags = { ...(r.tags ?? {}), size, roomFunction, roomStatus, roomProperties }
  }

  if (!sorted.some((r) => r.tags?.roomFunction === 'Storage')) {
    const tinies = sorted.filter((r) => r.tags?.size === 'tiny').sort((a, b) => a.rect.w * a.rect.h - (b.rect.w * b.rect.h))
    const victim = tinies[0]
    if (victim?.tags) victim.tags.roomFunction = 'Storage'
  }
}

type RoomFunction = NonNullable<NonNullable<GenRoom['tags']>['roomFunction']>
type RoomStatus = NonNullable<NonNullable<GenRoom['tags']>['roomStatus']>
type RoomProp = NonNullable<NonNullable<GenRoom['tags']>['roomProperties']>

function getNeighbors(adj: Map<string, string[]>, id: string): string[] {
  return adj.get(id) ?? []
}

function scoreRoomAssignment(args: {
  room: GenRoom
  roomsById: Map<string, GenRoom>
  adj: Map<string, string[]>
  floorProps: readonly FloorProperty[]
  onPathBand?: Set<string>
}): number {
  const { room, roomsById, adj, floorProps } = args
  const func = room.tags?.roomFunction
  const status = room.tags?.roomStatus
  const prop = room.tags?.roomProperties
  if (!func) return -9999

  const neighIds = getNeighbors(adj, room.id)
  let s = 0

  for (const nid of neighIds) {
    const n = roomsById.get(nid)
    if (!n?.tags?.roomFunction) continue
    if (n.tags.roomFunction === func) s += 6
    else s -= 2

    if (status && n.tags?.roomStatus === status) s += 2
    if (prop && n.tags?.roomProperties === prop) s += 2
  }

  // Floor-property bias toward clustering certain statuses/properties.
  if (floorProps.includes('Overgrown') && status === 'Overgrown') s += 4
  if (floorProps.includes('Destroyed') && (status === 'Destroyed' || status === 'Collapsed')) s += 3
  if (floorProps.includes('Infested') && prop === 'Infected') s += 3
  if (floorProps.includes('Overgrown') && prop === 'SporeMist') s += 3
  if (floorProps.includes('Cursed') && (prop === 'Flooded' || prop === 'Burning' || prop === 'Haunted' || prop === 'RoyalMiasma' || prop === 'NanoHaze'))
    s += 2
  if (floorProps.includes('Destroyed') && prop === 'Unstable') s += 3

  // Light pacing preference: Storage tends to feel better off the main band.
  if (args.onPathBand?.has(room.id)) {
    if (func === 'Storage') s -= 3
    if (func === 'Passage' || func === 'Communal') s += 1
  }

  return s
}

function countRoomFunctions(rooms: GenRoom[]): Record<RoomFunction, number> {
  const out: Record<RoomFunction, number> = {
    Passage: 0,
    Habitat: 0,
    Workshop: 0,
    Communal: 0,
    Storage: 0,
  }
  for (const r of rooms) {
    const f = r.tags?.roomFunction
    if (!f) continue
    out[f]++
  }
  return out
}

/**
 * Deterministic, cluster-first tag refinement. Keeps existing quotas indirectly by freezing Storage count
 * (and only swapping functions between rooms) so the distribution remains stable while improving coherence.
 */
export function solveRoomTags(args: {
  rooms: GenRoom[]
  tiles: Tile[]
  w: number
  h: number
  floorProperties: FloorProperty[] | undefined
  rng: Pick<Rng, 'next' | 'int'>
  onPathBand?: Set<string>
}): void {
  const { rooms, rng } = args
  if (rooms.length < 3) return

  const adj = buildRoomAdjacency(rooms, args.tiles, args.w)
  const roomsById = new Map<string, GenRoom>(rooms.map((r) => [r.id, r]))
  const floorProps = args.floorProperties ?? []

  // Freeze Storage quota by treating Storage swaps as the only allowed way to change Storage membership.
  const fnCounts = countRoomFunctions(rooms)
  const desiredStorage = fnCounts.Storage

  const steps = Math.max(30, Math.min(80, rooms.length * 4))
  const statuses: Array<RoomStatus | undefined> = [undefined, 'Overgrown', 'Destroyed', 'Collapsed']
  const props: Array<RoomProp | undefined> = [
    undefined,
    'Burning',
    'Flooded',
    'Infected',
    'SporeMist',
    'NanoHaze',
    'Unstable',
    'Haunted',
    'RoyalMiasma',
  ]

  for (let it = 0; it < steps; it++) {
    const r = rooms[rng.int(0, rooms.length)]
    if (!r.tags?.roomFunction) continue

    const before = { ...r.tags }
    const beforeScore = scoreRoomAssignment({ room: r, roomsById, adj, floorProps, onPathBand: args.onPathBand })

    // Propose: either swap functions with a neighbor to preserve distribution, or tweak status/prop.
    if (rng.next() < 0.55) {
      const neigh = getNeighbors(adj, r.id)
      if (!neigh.length) continue
      const other = roomsById.get(neigh[rng.int(0, neigh.length)])
      if (!other?.tags?.roomFunction) continue

      const beforePair =
        scoreRoomAssignment({ room: r, roomsById, adj, floorProps, onPathBand: args.onPathBand }) +
        scoreRoomAssignment({ room: other, roomsById, adj, floorProps, onPathBand: args.onPathBand })

      const rBefore = { ...r.tags }
      const oBefore = { ...other.tags }
      r.tags = { ...r.tags, roomFunction: oBefore.roomFunction }
      other.tags = { ...other.tags, roomFunction: rBefore.roomFunction }

      const afterScore =
        scoreRoomAssignment({ room: r, roomsById, adj, floorProps, onPathBand: args.onPathBand }) +
        scoreRoomAssignment({ room: other, roomsById, adj, floorProps, onPathBand: args.onPathBand })

      // Keep distribution stable: if storage count drifted (shouldn't), revert.
      const check = countRoomFunctions(rooms)
      if (check.Storage !== desiredStorage) {
        r.tags = rBefore
        other.tags = oBefore
        continue
      }

      if (afterScore < beforePair) {
        r.tags = rBefore
        other.tags = oBefore
      }
    } else if (rng.next() < 0.75) {
      // Status tweak (biased by floor properties)
      const nextStatus = statuses[rng.int(0, statuses.length)]
      r.tags = { ...r.tags, roomStatus: nextStatus }
      const afterScore = scoreRoomAssignment({ room: r, roomsById, adj, floorProps, onPathBand: args.onPathBand })
      if (afterScore < beforeScore) r.tags = before
    } else {
      // Property tweak
      const nextProp = props[rng.int(0, props.length)]
      r.tags = { ...r.tags, roomProperties: nextProp }
      const afterScore = scoreRoomAssignment({ room: r, roomsById, adj, floorProps, onPathBand: args.onPathBand })
      if (afterScore < beforeScore) r.tags = before
    }
  }
}

function floorNeighborCount(tiles: Tile[], w: number, h: number, c: Vec2): number {
  if (c.x < 0 || c.y < 0 || c.x >= w || c.y >= h) return 0
  let n = 0
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const x = c.x + dx
    const y = c.y + dy
    if (x < 0 || y < 0 || x >= w || y >= h) continue
    if (isWalkable(tiles[x + y * w])) n++
  }
  return n
}

function isDeadEndCenter(room: GenRoom, tiles: Tile[], w: number, h: number): boolean {
  return floorNeighborCount(tiles, w, h, room.center) <= 1
}

/**
 * Post-quota passes: prefer Storage in dead-end rooms; expand Flooded into a small cluster on Cursed floors.
 */
export function applyTagConstraints(
  rooms: GenRoom[],
  tiles: Tile[],
  w: number,
  h: number,
  floorProperties: FloorProperty[] | undefined,
  rng: Pick<Rng, 'next'>,
): void {
  const sorted = [...rooms].sort((a, b) => a.id.localeCompare(b.id))

  const storageRooms = sorted.filter((r) => r.tags?.roomFunction === 'Storage')
  const passageTiny = sorted.filter((r) => r.tags?.size === 'tiny' && r.tags?.roomFunction === 'Passage')
  for (const s of storageRooms) {
    if (isDeadEndCenter(s, tiles, w, h)) continue
    const swap = passageTiny.find((p) => isDeadEndCenter(p, tiles, w, h))
    if (swap?.tags && s.tags) {
      s.tags = { ...s.tags, roomFunction: 'Passage' }
      swap.tags = { ...swap.tags, roomFunction: 'Storage' }
    }
  }

  const props = floorProperties ?? []
  if (props.includes('Cursed')) {
    const adj = buildRoomAdjacency(sorted, tiles, w)
    const flooded = sorted.filter((r) => r.tags?.roomProperties === 'Flooded')
    const infected = sorted.filter((r) => r.tags?.roomProperties === 'Infected')

    const expandCluster = (seed: GenRoom, propId: RoomProp, p1: number, p2: number) => {
      const q: Array<{ id: string; depth: number }> = [{ id: seed.id, depth: 0 }]
      const seen = new Set<string>([seed.id])
      for (let qi = 0; qi < q.length; qi++) {
        const cur = q[qi]
        const neigh = adj.get(cur.id) ?? []
        for (const nid of neigh) {
          if (seen.has(nid)) continue
          seen.add(nid)
          const n = sorted.find((rr) => rr.id === nid)
          if (!n) continue
          if (n.tags?.roomProperties === propId) continue
          const roll = cur.depth === 0 ? p1 : p2
          if (rng.next() < roll) {
            n.tags = { ...(n.tags ?? {}), roomProperties: propId }
            if (cur.depth < 1) q.push({ id: nid, depth: cur.depth + 1 })
          }
        }
      }
    }

    if (flooded.length) {
      const seed = flooded.slice().sort((a, b) => a.id.localeCompare(b.id))[0]!
      expandCluster(seed, 'Flooded', 0.55, 0.25)
    }
    if (infected.length) {
      const seed = infected.slice().sort((a, b) => a.id.localeCompare(b.id))[0]!
      expandCluster(seed, 'Infected', 0.45, 0.18)
    }
  }

  if (props.includes('Overgrown')) {
    const spore = sorted.filter((r) => r.tags?.roomProperties === 'SporeMist')
    if (spore.length) {
      const adj = buildRoomAdjacency(sorted, tiles, w)
      const expandSporeCluster = (seed: GenRoom, propId: RoomProp, p1: number, p2: number) => {
        const q: Array<{ id: string; depth: number }> = [{ id: seed.id, depth: 0 }]
        const seen = new Set<string>([seed.id])
        for (let qi = 0; qi < q.length; qi++) {
          const cur = q[qi]
          const neigh = adj.get(cur.id) ?? []
          for (const nid of neigh) {
            if (seen.has(nid)) continue
            seen.add(nid)
            const n = sorted.find((rr) => rr.id === nid)
            if (!n) continue
            if (n.tags?.roomProperties === propId) continue
            const roll = cur.depth === 0 ? p1 : p2
            if (rng.next() < roll) {
              n.tags = { ...(n.tags ?? {}), roomProperties: propId }
              if (cur.depth < 1) q.push({ id: nid, depth: cur.depth + 1 })
            }
          }
        }
      }
      const seed = spore.slice().sort((a, b) => a.id.localeCompare(b.id))[0]!
      expandSporeCluster(seed, 'SporeMist', 0.42, 0.2)
    }
  }
}
