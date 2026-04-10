import { describe, expect, it } from 'vitest'
import { generateDungeon } from './generateDungeon'
import type { FloorType } from './types'
import {
  LEGACY_BSP_TUNING,
  LEGACY_CAVE_SHAPING,
  LEGACY_CAVE_TUNING,
  LEGACY_DUNGEON_SHAPING,
  LEGACY_LOOP_INJECT_TUNING,
  LEGACY_RUINS_SHAPING,
  LEGACY_RUINS_TUNING,
  LEGACY_SCORE_WEIGHTS,
  TOPOLOGY_BY_FLOOR_TYPE,
  resolveTopologyTuning,
} from './floorTopologyTuning'

const ALL_FLOOR_TYPES: FloorType[] = [
  'Dungeon',
  'Cave',
  'Ruins',
  'Jungle',
  'LivingBio',
  'Bunker',
  'Golem',
  'Catacombs',
  'Palace',
]

describe('floorTopologyTuning', () => {
  it('defines tuning for every FloorType', () => {
    for (const ft of ALL_FLOOR_TYPES) {
      expect(TOPOLOGY_BY_FLOOR_TYPE[ft]).toBeDefined()
      expect(TOPOLOGY_BY_FLOOR_TYPE[ft].cave).toBeDefined()
      expect(TOPOLOGY_BY_FLOOR_TYPE[ft].ruins).toBeDefined()
      expect(TOPOLOGY_BY_FLOOR_TYPE[ft].bsp).toBeDefined()
    }
  })

  it('base Dungeon/Cave/Ruins match legacy BSP/cave/ruins/shaping where applicable', () => {
    expect(TOPOLOGY_BY_FLOOR_TYPE.Dungeon.bsp).toEqual(LEGACY_BSP_TUNING)
    expect(TOPOLOGY_BY_FLOOR_TYPE.Dungeon.shaping).toEqual(LEGACY_DUNGEON_SHAPING)
    expect(TOPOLOGY_BY_FLOOR_TYPE.Dungeon.cave).toEqual(LEGACY_CAVE_TUNING)
    expect(TOPOLOGY_BY_FLOOR_TYPE.Dungeon.ruins).toEqual(LEGACY_RUINS_TUNING)
    expect(TOPOLOGY_BY_FLOOR_TYPE.Dungeon.loopInject).toEqual(LEGACY_LOOP_INJECT_TUNING)

    expect(TOPOLOGY_BY_FLOOR_TYPE.Cave.cave).toEqual(LEGACY_CAVE_TUNING)
    expect(TOPOLOGY_BY_FLOOR_TYPE.Cave.shaping).toEqual(LEGACY_CAVE_SHAPING)
    expect(TOPOLOGY_BY_FLOOR_TYPE.Cave.ruins).toEqual(LEGACY_RUINS_TUNING)
    expect(TOPOLOGY_BY_FLOOR_TYPE.Cave.loopInject).toEqual(LEGACY_LOOP_INJECT_TUNING)

    expect(TOPOLOGY_BY_FLOOR_TYPE.Ruins.ruins).toEqual(LEGACY_RUINS_TUNING)
    expect(TOPOLOGY_BY_FLOOR_TYPE.Ruins.shaping).toEqual(LEGACY_RUINS_SHAPING)
    expect(TOPOLOGY_BY_FLOOR_TYPE.Ruins.loopInject).toEqual(LEGACY_LOOP_INJECT_TUNING)
  })

  it('base types keep legacy post-layout knobs', () => {
    expect(TOPOLOGY_BY_FLOOR_TYPE.Dungeon.injectLoopsMax).toBe(2)
    expect(TOPOLOGY_BY_FLOOR_TYPE.Dungeon.junctionMaxRooms).toBe(6)
    expect(TOPOLOGY_BY_FLOOR_TYPE.Dungeon.doorFramesMax).toBe(10)
    expect(TOPOLOGY_BY_FLOOR_TYPE.Dungeon.decorativeDoorFrameChance).toBe(0.75)
    expect(TOPOLOGY_BY_FLOOR_TYPE.Dungeon.smoothPasses).toBe(1)

    expect(TOPOLOGY_BY_FLOOR_TYPE.Cave.injectLoopsMax).toBe(2)
    expect(TOPOLOGY_BY_FLOOR_TYPE.Cave.junctionMaxRooms).toBe(4)

    expect(TOPOLOGY_BY_FLOOR_TYPE.Ruins.junctionMaxRooms).toBe(4)
  })

  it('base three types use full legacy score weights; reskins stay sane', () => {
    for (const ft of ['Dungeon', 'Cave', 'Ruins'] as const) {
      expect(TOPOLOGY_BY_FLOOR_TYPE[ft].score).toEqual(LEGACY_SCORE_WEIGHTS)
    }
    for (const ft of ALL_FLOOR_TYPES) {
      const s = TOPOLOGY_BY_FLOOR_TYPE[ft].score
      expect(s.reachableMult).toBeGreaterThan(0)
      expect(s.deadEndPenalty).toBeGreaterThan(0)
      expect(s.pathLenCap).toBeGreaterThan(0)
      expect(s.junctionMult).toBeGreaterThan(0)
      expect(s.branchLatticeMult).toBeGreaterThan(0)
    }
  })

  it('resolveTopologyTuning applies Destroyed / Overgrown deltas', () => {
    const base = resolveTopologyTuning('Dungeon', [])
    const destroyed = resolveTopologyTuning('Dungeon', ['Destroyed'])
    expect(destroyed.injectLoopsMax).toBe(base.injectLoopsMax + 1)
    expect(destroyed.shaping.jitterStrength).toBeGreaterThanOrEqual(base.shaping.jitterStrength)

    const over = resolveTopologyTuning('Cave', ['Overgrown'])
    expect(over.shaping.alcovePerRoomChance).toBeGreaterThan(
      resolveTopologyTuning('Cave', []).shaping.alcovePerRoomChance,
    )
  })

  it('Catacombs/Palace ruins cell size and Jungle loop samples diverge from base', () => {
    expect(TOPOLOGY_BY_FLOOR_TYPE.Catacombs.ruins.cellSize).toBe(4)
    expect(TOPOLOGY_BY_FLOOR_TYPE.Palace.ruins.cellSize).toBe(6)
    expect(TOPOLOGY_BY_FLOOR_TYPE.Ruins.ruins.cellSize).toBe(5)
    expect(TOPOLOGY_BY_FLOOR_TYPE.Jungle.loopInject.randomFloorSamples).toBe(18)
    expect(TOPOLOGY_BY_FLOOR_TYPE.Cave.loopInject.randomFloorSamples).toBe(14)
  })

  it('generateDungeon still validates for several floor types (smoke)', () => {
    const w = 31
    const h = 31
    for (const floorType of ['Bunker', 'Jungle', 'Palace', 'Ruins'] as const) {
      const gen = generateDungeon({
        seed: 42_4242,
        w,
        h,
        floorIndex: 3,
        floorType,
        difficulty: 1,
      })
      expect(gen.tiles.length).toBe(w * h)
      expect(gen.rooms.length).toBeGreaterThan(0)
    }
  })
})
