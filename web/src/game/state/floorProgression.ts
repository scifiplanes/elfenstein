import type { GameState } from '../types'
import { generateDungeon } from '../../procgen/generateDungeon'
import type { FloorType } from '../../procgen/types'
import { normalizeFloorGenDifficulty } from '../../procgen/types'
import { hydrateGenFloorItems, snapViewToGrid } from './procgenHydrate'
import { npcsWithDefaultStatuses } from './npcHydrate'
import { randomFloorSeed } from './randomSeed'
import { pushActivityLog } from './activityLog'
import { applyXp } from './runProgression'

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

  let next: GameState = {
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
      npcs: npcsWithDefaultStatuses(gen.npcs),
      playerPos,
      playerDir,
      floorGeomRevision: state.floor.floorGeomRevision + 1,
    },
    party: { ...state.party, items: { ...state.party.items, ...spawnedItems } },
    view: snapViewToGrid(w, h, state.render.camEyeHeight, playerPos, playerDir),
  }

  const xpRes = applyXp(next, 12)
  next = xpRes.state
  next = pushActivityLog(next, `Descended to floor ${nextFloorIndex} (${nextFloorType}, ${gen.theme?.id ?? 'theme'}). (+12 XP)`)
  if (xpRes.leveledUp) {
    for (const perkId of xpRes.perkIds) {
      const perkLabel = perkId === 'vitals_plus5' ? '+5 max HP/STA' : perkId === 'damage_plus10pct' ? '+10% dmg' : perkId
      next = pushActivityLog(next, `Reached level ${next.run.level}. (${perkLabel})`)
    }
  }
  return next
}

