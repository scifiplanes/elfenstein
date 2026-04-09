import { mulberry32, splitSeed } from './seededRng'
import {
  normalizeFloorGenDifficulty,
  type FloorGenDifficulty,
  type FloorGenInput,
  type FloorGenOutput,
  type GenRoom,
} from './types'
import {
  countReachableDeadEnds,
  countReachableFloorJunctions,
  injectLoops,
  pickEntranceExit,
  repairConnectivity,
  smoothWallsCarveOnly,
  center,
  carveRect,
  type Rect,
} from './layoutPasses'
import { placeLocksOnPath, validateGen } from './locks'
import { assignDistrictsToRooms, applyTagConstraints, computeMainPathBandRooms, solveRoomTags, tagRoomsWithQuotas } from './districtsTags'
import { pickFloorTheme } from './floorTheme'
import { placePois, spawnNpcsAndItems } from './population'
import { buildMissionGraph } from './missionGraph'
import { planMissionBeforeGeometry } from './missionFirst'
import { scoreLayout } from './scoreLayout'
import { runDungeonBspLayout } from './realizeDungeonBsp'
import { runCaveLayout } from './realizeCave'
import { runRuinsLayout } from './realizeRuins'
import type { FloorPoi, PoiKind, Tile } from '../game/types'
import { shortestPathLatticeStats } from './validate'
import { applyRoomShapingGuarded } from './shapeRooms'
import { applyDungeonDoorFramesGuarded } from './doorFrames'
import { deriveJunctionRooms } from './deriveRooms'

const POI_CANONICAL_ID_ORDER: Partial<Record<string, number>> = {
  poi_exit: 0,
  poi_well: 1,
  poi_bed: 2,
  poi_chest: 3,
  poi_barrel: 4,
  poi_crate: 5,
  poi_shrine: 6,
  poi_crackedWall: 7,
}

const POI_KIND_PRIORITY: Partial<Record<PoiKind, number>> = {
  Exit: 0,
  Well: 1,
  Bed: 2,
  Chest: 3,
  Barrel: 4,
  Crate: 5,
  Shrine: 6,
  CrackedWall: 7,
}

function cellKey(p: { pos: { x: number; y: number } }) {
  return `${p.pos.x},${p.pos.y}`
}

function choosePoiWinner(a: FloorPoi, b: FloorPoi): FloorPoi {
  const aId = POI_CANONICAL_ID_ORDER[a.id]
  const bId = POI_CANONICAL_ID_ORDER[b.id]
  if (aId != null || bId != null) {
    const ai = aId ?? 99
    const bi = bId ?? 99
    if (ai !== bi) return ai < bi ? a : b
  }

  const ak = POI_KIND_PRIORITY[a.kind] ?? 99
  const bk = POI_KIND_PRIORITY[b.kind] ?? 99
  if (ak !== bk) return ak < bk ? a : b

  // Stable tie-break: keep deterministic output.
  return a.id.localeCompare(b.id) <= 0 ? a : b
}

function dedupePoisByCell(pois: FloorPoi[]): { pois: FloorPoi[]; dropped: FloorPoi[] } {
  if (pois.length <= 1) return { pois, dropped: [] }
  const byCell = new Map<string, FloorPoi>()
  const dropped: FloorPoi[] = []
  for (const p of pois) {
    const k = cellKey(p)
    const existing = byCell.get(k)
    if (!existing) {
      byCell.set(k, p)
      continue
    }
    const keep = choosePoiWinner(existing, p)
    const drop = keep === existing ? p : existing
    byCell.set(k, keep)
    dropped.push(drop)
  }
  return { pois: Array.from(byCell.values()), dropped }
}

function maxAttemptsForDifficulty(d: FloorGenDifficulty): number {
  if (d === 0) return 8
  if (d === 2) return 5
  return 6
}

export function generateDungeon(input: FloorGenInput): FloorGenOutput {
  const difficulty = normalizeFloorGenDifficulty(input.difficulty)
  const maxAttempts = maxAttemptsForDifficulty(difficulty)
  const inputSeed = input.seed >>> 0
  const mixedSeed = splitSeed(inputSeed, 31_337 + (input.floorIndex ?? 0))

  const valid: FloorGenOutput[] = []
  let last: FloorGenOutput | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const out = generateDungeonOnce({ ...input, seed: mixedSeed }, attempt, inputSeed)
    last = out
    if (validateGen(out, input.w, input.h)) {
      valid.push(out)
    }
  }

  if (valid.length) {
    let best = valid[0]
    let bestS = scoreLayout(best, input.w, input.h, difficulty)
    for (let i = 1; i < valid.length; i++) {
      const s = scoreLayout(valid[i], input.w, input.h, difficulty)
      if (s > bestS) {
        bestS = s
        best = valid[i]
      }
    }
    return {
      ...best,
      meta: { ...best.meta, layoutScore: bestS },
    }
  }

  const fallback = last ?? generateDungeonFallback({ ...input, seed: mixedSeed }, inputSeed)
  return {
    ...fallback,
    meta: { ...fallback.meta, layoutScore: scoreLayout(fallback, input.w, input.h, difficulty) },
  }
}

function generateDungeonOnce(input: FloorGenInput, attempt: number, recordedInputSeed: number): FloorGenOutput {
  const { seed, w, h, floorType, floorProperties } = input
  const difficulty = normalizeFloorGenDifficulty(input.difficulty)
  const floorProps = floorProperties ?? []
  const attemptSeed = attempt === 0 ? seed : splitSeed(seed, 1000 + attempt)
  const streams = {
    layout: splitSeed(attemptSeed, 1),
    tags: splitSeed(attemptSeed, 2),
    population: splitSeed(attemptSeed, 3),
    locks: splitSeed(attemptSeed, 4),
    districts: splitSeed(attemptSeed, 5),
    score: splitSeed(attemptSeed, 6),
    theme: splitSeed(attemptSeed, 7),
    mission: splitSeed(attemptSeed, 8),
  }
  const layoutRng = mulberry32(streams.layout)
  const tagsRng = mulberry32(streams.tags)
  const popRng = mulberry32(streams.population)
  const locksRng = mulberry32(streams.locks)
  const districtRng = mulberry32(streams.districts)
  const themeRng = mulberry32(streams.theme)
  const missionRng = mulberry32(streams.mission)
  void planMissionBeforeGeometry(input, missionRng)

  let tiles: Tile[]
  let genRooms: GenRoom[]

  if (floorType === 'Cave') {
    ;({ tiles, genRooms } = runCaveLayout(w, h, layoutRng))
  } else if (floorType === 'Ruins') {
    ;({ tiles, genRooms } = runRuinsLayout(w, h, layoutRng))
  } else {
    ;({ tiles, genRooms } = runDungeonBspLayout(w, h, layoutRng))
  }

  repairConnectivity(tiles, w, h, layoutRng)
  smoothWallsCarveOnly(tiles, w, h, 1)

  applyRoomShapingGuarded({ tiles, w, h, rooms: genRooms, floorType, rng: layoutRng })

  const { entrance, exit } = pickEntranceExit({ tiles, w, h, rooms: genRooms, rng: layoutRng })

  const loopsAdded = injectLoops({ tiles, w, h, rooms: genRooms, entrance, exit, rng: layoutRng }).added

  const doorFrames =
    floorType === 'Dungeon' ? applyDungeonDoorFramesGuarded({ tiles, w, h, rng: layoutRng, maxFrames: 10 }) : { applied: false, framesApplied: 0 }

  const lattice = shortestPathLatticeStats(tiles, w, h, entrance, exit)
  const wideness = lattice.shortestLen >= 0 ? lattice.latticeCells - lattice.shortestLen : 0
  const { reachableFloors, junctions } = countReachableFloorJunctions(tiles, w, h, entrance)
  const deadEnds = countReachableDeadEnds(tiles, w, h, entrance)

  // Derived connector/junction rooms provide additional semantic anchors for tags/spawns.
  // These are stable and bounded and should not affect geometry.
  genRooms = genRooms.concat(deriveJunctionRooms({ tiles, w, h, maxRooms: floorType === 'Dungeon' ? 6 : 4 }))

  assignDistrictsToRooms(genRooms, w, h, districtRng)
  tagRoomsWithQuotas(genRooms, floorProperties, tagsRng)
  const onPathBand = computeMainPathBandRooms({ tiles, w, h, entrance, exit, rooms: genRooms, radius: 1 })
  solveRoomTags({ rooms: genRooms, tiles, w, h, floorProperties, rng: tagsRng, onPathBand })
  applyTagConstraints(genRooms, tiles, w, h, floorProperties, tagsRng)

  const rawPois = placePois({ tiles, w, h, rooms: genRooms, entrance, exit, rng: popRng, floorProperties: floorProps })
  const { pois, dropped: droppedPois } = dedupePoisByCell(rawPois)
  if (import.meta.env?.DEV && droppedPois.length) {
    // Keep this as a warning (not a hard throw) so procgen remains resilient during iteration.
    console.warn('[procgen] POI collision(s) deduped', {
      kept: pois.map((p) => ({ id: p.id, kind: p.kind, pos: p.pos })),
      dropped: droppedPois.map((p) => ({ id: p.id, kind: p.kind, pos: p.pos })),
    })
  }
  if (import.meta.env?.DEV) {
    const keys = pois.map(cellKey)
    const uniq = new Set(keys)
    if (uniq.size !== keys.length) {
      throw new Error('[procgen] POI uniqueness invariant violated after dedupe')
    }
  }
  const occupied = new Set<string>(pois.map((p) => `${p.pos.x},${p.pos.y}`))

  const { npcs, floorItems: popItems } = spawnNpcsAndItems({
    tiles,
    w,
    h,
    rooms: genRooms,
    entrance,
    exit,
    occupied,
    rng: popRng,
    floorType,
    floorProperties: floorProps,
  })

  const { doors, floorItems: lockItems } = placeLocksOnPath({
    tiles,
    w,
    h,
    entrance,
    exit,
    rng: locksRng,
    occupied,
    difficulty,
    floorProperties: floorProps,
  })
  for (const d of doors) occupied.add(`${d.pos.x},${d.pos.y}`)
  for (const it of lockItems) occupied.add(`${it.pos.x},${it.pos.y}`)
  for (const it of popItems) occupied.add(`${it.pos.x},${it.pos.y}`)
  for (const n of npcs) occupied.add(`${n.pos.x},${n.pos.y}`)

  const theme = pickFloorTheme({ floorType, floorProperties, rng: themeRng })

  const out: FloorGenOutput = {
    tiles,
    pois,
    rooms: genRooms,
    doors,
    floorItems: popItems.concat(lockItems),
    npcs,
    entrance,
    exit,
    theme,
    meta: {
      genVersion: 5,
      inputSeed: recordedInputSeed,
      attemptSeed,
      attempt,
      w,
      h,
      streams,
      difficulty,
      layoutMetrics: {
        wideness,
        junctions,
        deadEnds,
        reachableFloors,
        loopsAdded,
        doorFramesApplied: doorFrames.framesApplied,
      },
    },
    missionGraph: undefined,
  }
  out.missionGraph = buildMissionGraph(out)
  return out
}

function generateDungeonFallback(input: FloorGenInput, recordedInputSeed: number): FloorGenOutput {
  const { seed, w, h, floorType, floorProperties } = input
  const difficulty = normalizeFloorGenDifficulty(input.difficulty)
  const streams = {
    layout: splitSeed(seed, 1),
    tags: splitSeed(seed, 2),
    population: splitSeed(seed, 3),
    locks: splitSeed(seed, 4),
    districts: splitSeed(seed, 5),
    score: splitSeed(seed, 6),
    theme: splitSeed(seed, 7),
    mission: splitSeed(seed, 8),
  }
  const themeRng = mulberry32(streams.theme)
  const theme = pickFloorTheme({ floorType, floorProperties, rng: themeRng })
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
    theme,
    meta: {
      genVersion: 5,
      inputSeed: recordedInputSeed,
      attemptSeed: seed >>> 0,
      attempt: 0,
      w,
      h,
      streams,
      difficulty,
    },
    missionGraph: {
      nodes: [
        { id: 'mission_entrance', role: 'Entrance', pos: { ...entrance } },
        { id: 'mission_exit', role: 'Exit', pos: { ...exit } },
      ],
      edges: [{ fromId: 'mission_entrance', toId: 'mission_exit', kind: 'path' }],
    },
  }
}
