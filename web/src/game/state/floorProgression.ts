import type { GameState } from '../types'
import { generateDungeon } from '../../procgen/generateDungeon'
import type { FloorType } from '../../procgen/types'
import { normalizeFloorGenDifficulty } from '../../procgen/types'
import { hydrateGenFloorItems, snapViewToGrid } from './procgenHydrate'
import { randomFloorSeed } from './randomSeed'

function cycleFloorType(cur: FloorType): FloorType {
  const order: FloorType[] = ['Dungeon', 'Cave', 'Ruins']
  const i = Math.max(0, order.indexOf(cur))
  return order[(i + 1) % order.length] ?? 'Dungeon'
}

export function descendToNextFloor(state: GameState): GameState {
  const nextFloorIndex = state.floor.floorIndex + 1
  const nextFloorType = cycleFloorType(state.floor.floorType)
  const nextDifficulty = normalizeFloorGenDifficulty(state.floor.difficulty)
  const nextSeed = randomFloorSeed()

  const w = state.floor.w
  const h = state.floor.h

  const gen = generateDungeon({
    seed: nextSeed,
    w,
    h,
    floorIndex: nextFloorIndex,
    floorType: nextFloorType,
    floorProperties: state.floor.floorProperties,
    difficulty: nextDifficulty,
  })

  const playerPos = { ...gen.entrance }
  const playerDir = 0 as const
  const { spawnedItems, spawnedOnFloor } = hydrateGenFloorItems(state.render, gen.floorItems, nextSeed)

  return {
    ...state,
    floor: {
      ...state.floor,
      seed: nextSeed,
      floorIndex: nextFloorIndex,
      floorType: nextFloorType,
      difficulty: nextDifficulty,
      tiles: gen.tiles,
      pois: gen.pois,
      gen,
      itemsOnFloor: spawnedOnFloor,
      npcs: gen.npcs,
      playerPos,
      playerDir,
    },
    party: { ...state.party, items: { ...state.party.items, ...spawnedItems } },
    view: snapViewToGrid(w, h, state.render.camEyeHeight, playerPos, playerDir),
    ui: {
      ...state.ui,
      toast: {
        id: `t_${state.nowMs}`,
        text: `Descended to floor ${nextFloorIndex} (${nextFloorType}, ${gen.theme?.id ?? 'theme'}).`,
        untilMs: state.nowMs + 1500,
      },
    },
  }
}

