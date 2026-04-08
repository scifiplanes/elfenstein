import { mulberry32, splitSeed } from './seededRng'
import {
  normalizeFloorGenDifficulty,
  type FloorGenDifficulty,
  type FloorGenInput,
  type FloorGenOutput,
  type GenRoom,
} from './types'
import { pickEntranceExit, repairConnectivity, smoothWallsCarveOnly, center, carveRect, type Rect } from './layoutPasses'
import { placeLocksOnPath, validateGen } from './locks'
import { assignDistrictsToRooms, applyTagConstraints, tagRoomsWithQuotas } from './districtsTags'
import { pickFloorTheme } from './floorTheme'
import { placePois, spawnNpcsAndItems } from './population'
import { buildMissionGraph } from './missionGraph'
import { planMissionBeforeGeometry } from './missionFirst'
import { scoreLayout } from './scoreLayout'
import { runDungeonBspLayout } from './realizeDungeonBsp'
import { runCaveLayout } from './realizeCave'
import { runRuinsLayout } from './realizeRuins'
import type { Tile } from '../game/types'

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

  const { entrance, exit } = pickEntranceExit({ tiles, w, h, rooms: genRooms, rng: layoutRng })

  assignDistrictsToRooms(genRooms, w, h, districtRng)
  tagRoomsWithQuotas(genRooms, floorProperties, tagsRng)
  applyTagConstraints(genRooms, tiles, w, h, floorProperties, tagsRng)

  const pois = placePois({ tiles, w, h, rooms: genRooms, entrance, exit, rng: popRng })
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
