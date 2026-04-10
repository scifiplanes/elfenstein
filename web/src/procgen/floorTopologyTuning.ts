import type { FloorProperty, FloorType } from './types'

/** Knobs for `runCaveLayout` (worm carve + chambers). */
export type CaveLayoutTuning = {
  diggerMin: number
  diggerCap: number
  diggerBase: number
  diggerExtraChance: number
  stepsMassFraction: number
  widenChance: number
  blobMinStepsSince: number
  blobChance: number
  maxChambers: number
}

/** Knobs for `runRuinsLayout` (macro-cell stamps). */
export type RuinsLayoutTuning = {
  cellSize: number
  stampSkipChance: number
  shrinkRoomChance: number
  doorwayChance: number
  maxMacroClusters: number
}

/** Knobs for `runDungeonBspLayout`. */
export type BspLayoutTuning = {
  minLeaf: number
  maxDepth: number
  roomWMinFrac: number
  roomWRandSpan: number
  roomHMinFrac: number
  roomHRandSpan: number
  /** Probability that `maxExtra` extra connectors is 2 instead of 1. */
  extraConnectorHighChance: number
  extraConnectorMinDist: number
  extraConnectorMaxDist: number
  extraConnectorTries: number
}

export type RoomShapingTuning = {
  pillarsMaxPerRoom: number
  alcovePerRoomChance: number
  jitterStrength: number
}

/** Knobs for `injectLoops` in `layoutPasses.ts` (pair picks and corridor carve). */
export type LoopInjectTuning = {
  randomFloorSamples: number
  /** Skip probability when both ends fall in the same `GenRoom` (reduces micro-loops). */
  sameRoomSkipChance: number
  /** Reject corridor sample if this fraction of cells along the L is already floor. */
  corridorAlreadyFloorMaxRatio: number
  /** Chance to carve a 2-wide connector instead of 1-wide. */
  thickCorridorChance: number
  maxTriesBase: number
  maxTriesPerLoop: number
}

/** Weights for `scoreLayout` (relative comparison across rerolls only). */
export type LayoutScoreWeights = {
  reachableMult: number
  deadEndPenalty: number
  pathLenCap: number
  pathLenMult: number
  junctionMult: number
  /** Multiplier on `(latticeCells - shortestLen)` when lattice is wider than a spine. */
  branchLatticeMult: number
}

export type LayoutTopologyTuning = {
  cave: CaveLayoutTuning
  ruins: RuinsLayoutTuning
  bsp: BspLayoutTuning
  shaping: RoomShapingTuning
  loopInject: LoopInjectTuning
  injectLoopsMax: number
  junctionMaxRooms: number
  /** Used only when `layoutProfile === 'Dungeon'` (door-frame pass). */
  doorFramesMax: number
  /**
   * After locks, probability each unused door-frame throat becomes a closed `door` / `doorOctopus`
   * (Dungeon profile only).
   */
  decorativeDoorFrameChance: number
  smoothPasses: number
  score: LayoutScoreWeights
}

/** Legacy shipped constants (Cave / Ruins / Dungeon base types). */
export const LEGACY_CAVE_TUNING: CaveLayoutTuning = {
  diggerMin: 2,
  diggerCap: 4,
  diggerBase: 2,
  diggerExtraChance: 0.55,
  stepsMassFraction: 0.34,
  widenChance: 0.1,
  blobMinStepsSince: 26,
  blobChance: 0.08,
  maxChambers: 10,
}

export const LEGACY_RUINS_TUNING: RuinsLayoutTuning = {
  cellSize: 5,
  stampSkipChance: 0.08,
  shrinkRoomChance: 0.35,
  doorwayChance: 0.55,
  maxMacroClusters: 10,
}

export const LEGACY_BSP_TUNING: BspLayoutTuning = {
  minLeaf: 6,
  maxDepth: 6,
  roomWMinFrac: 0.45,
  roomWRandSpan: 0.25,
  roomHMinFrac: 0.45,
  roomHRandSpan: 0.25,
  extraConnectorHighChance: 0.35,
  extraConnectorMinDist: 8,
  extraConnectorMaxDist: 24,
  extraConnectorTries: 18,
}

export const LEGACY_DUNGEON_SHAPING: RoomShapingTuning = {
  pillarsMaxPerRoom: 3,
  alcovePerRoomChance: 0.18,
  jitterStrength: 0.12,
}

export const LEGACY_RUINS_SHAPING: RoomShapingTuning = {
  pillarsMaxPerRoom: 0,
  alcovePerRoomChance: 0.5,
  jitterStrength: 0.42,
}

export const LEGACY_CAVE_SHAPING: RoomShapingTuning = {
  pillarsMaxPerRoom: 0,
  alcovePerRoomChance: 0.35,
  jitterStrength: 0.35,
}

export const LEGACY_SCORE_WEIGHTS: LayoutScoreWeights = {
  reachableMult: 2,
  deadEndPenalty: 1,
  pathLenCap: 40,
  pathLenMult: 1,
  junctionMult: 3,
  branchLatticeMult: 2,
}

export const LEGACY_LOOP_INJECT_TUNING: LoopInjectTuning = {
  randomFloorSamples: 14,
  sameRoomSkipChance: 0.8,
  corridorAlreadyFloorMaxRatio: 0.6,
  thickCorridorChance: 0.15,
  maxTriesBase: 48,
  maxTriesPerLoop: 28,
}

function cloneTopology(t: LayoutTopologyTuning): LayoutTopologyTuning {
  return {
    cave: { ...t.cave },
    ruins: { ...t.ruins },
    bsp: { ...t.bsp },
    shaping: { ...t.shaping },
    loopInject: { ...t.loopInject },
    injectLoopsMax: t.injectLoopsMax,
    junctionMaxRooms: t.junctionMaxRooms,
    doorFramesMax: t.doorFramesMax,
    decorativeDoorFrameChance: t.decorativeDoorFrameChance,
    smoothPasses: t.smoothPasses,
    score: { ...t.score },
  }
}

const BASE_DUNGEON: LayoutTopologyTuning = {
  cave: { ...LEGACY_CAVE_TUNING },
  ruins: { ...LEGACY_RUINS_TUNING },
  bsp: { ...LEGACY_BSP_TUNING },
  shaping: { ...LEGACY_DUNGEON_SHAPING },
  loopInject: { ...LEGACY_LOOP_INJECT_TUNING },
  injectLoopsMax: 2,
  junctionMaxRooms: 6,
  doorFramesMax: 10,
  decorativeDoorFrameChance: 0.75,
  smoothPasses: 1,
  score: { ...LEGACY_SCORE_WEIGHTS },
}

const BASE_CAVE_TYPE: LayoutTopologyTuning = {
  cave: { ...LEGACY_CAVE_TUNING },
  ruins: { ...LEGACY_RUINS_TUNING },
  bsp: { ...LEGACY_BSP_TUNING },
  shaping: { ...LEGACY_CAVE_SHAPING },
  loopInject: { ...LEGACY_LOOP_INJECT_TUNING },
  injectLoopsMax: 2,
  junctionMaxRooms: 4,
  doorFramesMax: 10,
  decorativeDoorFrameChance: 0.75,
  smoothPasses: 1,
  score: { ...LEGACY_SCORE_WEIGHTS },
}

const BASE_RUINS_TYPE: LayoutTopologyTuning = {
  cave: { ...LEGACY_CAVE_TUNING },
  ruins: { ...LEGACY_RUINS_TUNING },
  bsp: { ...LEGACY_BSP_TUNING },
  shaping: { ...LEGACY_RUINS_SHAPING },
  loopInject: { ...LEGACY_LOOP_INJECT_TUNING },
  injectLoopsMax: 2,
  junctionMaxRooms: 4,
  doorFramesMax: 10,
  decorativeDoorFrameChance: 0.75,
  smoothPasses: 1,
  score: { ...LEGACY_SCORE_WEIGHTS },
}

/** Per-`FloorType` topology; base three match legacy behavior. */
export const TOPOLOGY_BY_FLOOR_TYPE: Record<FloorType, LayoutTopologyTuning> = {
  Dungeon: cloneTopology(BASE_DUNGEON),
  Cave: cloneTopology(BASE_CAVE_TYPE),
  Ruins: cloneTopology(BASE_RUINS_TYPE),
  Jungle: (() => {
    const t = cloneTopology(BASE_CAVE_TYPE)
    t.cave.widenChance = 0.12
    t.cave.blobChance = 0.1
    t.cave.maxChambers = 12
    t.shaping.alcovePerRoomChance = 0.42
    t.injectLoopsMax = 3
    t.loopInject.randomFloorSamples = 18
    t.score.junctionMult = 3.2
    return t
  })(),
  LivingBio: (() => {
    const t = cloneTopology(BASE_CAVE_TYPE)
    t.cave.stepsMassFraction = 0.32
    t.cave.blobChance = 0.09
    t.cave.widenChance = 0.11
    t.shaping.jitterStrength = 0.38
    t.shaping.alcovePerRoomChance = 0.32
    t.injectLoopsMax = 2
    return t
  })(),
  Bunker: (() => {
    const t = cloneTopology(BASE_DUNGEON)
    t.bsp.maxDepth = 5
    t.bsp.minLeaf = 7
    t.bsp.roomWMinFrac = 0.48
    t.bsp.roomWRandSpan = 0.2
    t.bsp.roomHMinFrac = 0.48
    t.bsp.roomHRandSpan = 0.2
    t.bsp.extraConnectorHighChance = 0.2
    t.bsp.extraConnectorMinDist = 10
    t.bsp.extraConnectorMaxDist = 22
    t.shaping.jitterStrength = 0.08
    t.shaping.alcovePerRoomChance = 0.12
    t.injectLoopsMax = 1
    t.doorFramesMax = 5
    t.score.deadEndPenalty = 1.35
    return t
  })(),
  Golem: (() => {
    const t = cloneTopology(BASE_DUNGEON)
    t.bsp.maxDepth = 7
    t.bsp.roomWMinFrac = 0.42
    t.bsp.roomWRandSpan = 0.28
    t.bsp.roomHMinFrac = 0.42
    t.bsp.roomHRandSpan = 0.28
    t.bsp.extraConnectorHighChance = 0.45
    t.shaping.pillarsMaxPerRoom = 4
    t.injectLoopsMax = 3
    t.doorFramesMax = 12
    t.score.junctionMult = 3.25
    return t
  })(),
  Catacombs: (() => {
    const t = cloneTopology(BASE_RUINS_TYPE)
    t.ruins.cellSize = 4
    t.ruins.stampSkipChance = 0.06
    t.ruins.doorwayChance = 0.6
    t.shaping.jitterStrength = 0.45
    t.injectLoopsMax = 3
    t.loopInject.thickCorridorChance = 0.22
    t.score.branchLatticeMult = 2.25
    t.score.junctionMult = 3.15
    return t
  })(),
  Palace: (() => {
    const t = cloneTopology(BASE_RUINS_TYPE)
    t.ruins.cellSize = 6
    t.ruins.stampSkipChance = 0.1
    t.ruins.doorwayChance = 0.5
    t.ruins.maxMacroClusters = 12
    t.shaping.pillarsMaxPerRoom = 1
    t.shaping.alcovePerRoomChance = 0.42
    t.shaping.jitterStrength = 0.36
    t.injectLoopsMax = 2
    t.loopInject.thickCorridorChance = 0.1
    t.score.junctionMult = 3.4
    return t
  })(),
}

/**
 * Effective tuning for a floor, optionally nudged by `floorProperties`
 * (small deltas; all guarded passes still revert bad geometry).
 */
export function resolveTopologyTuning(floorType: FloorType, floorProperties: FloorProperty[] | undefined): LayoutTopologyTuning {
  const base = TOPOLOGY_BY_FLOOR_TYPE[floorType]
  if (!floorProperties?.length) return cloneTopology(base)
  const t = cloneTopology(base)
  for (const p of floorProperties) {
    if (p === 'Destroyed') {
      t.injectLoopsMax = Math.min(6, t.injectLoopsMax + 1)
      t.shaping.jitterStrength = Math.min(0.55, t.shaping.jitterStrength + 0.03)
    } else if (p === 'Overgrown') {
      t.shaping.alcovePerRoomChance = Math.min(0.62, t.shaping.alcovePerRoomChance + 0.06)
    } else if (p === 'Infested') {
      t.cave.widenChance = Math.min(0.18, t.cave.widenChance + 0.03)
    } else if (p === 'Cursed') {
      t.ruins.doorwayChance = Math.max(0.42, t.ruins.doorwayChance - 0.04)
    }
  }
  return t
}
