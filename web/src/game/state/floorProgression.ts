import type { GameState } from '../types'
import { generateDungeon } from '../../procgen/generateDungeon'
import { normalizeFloorGenDifficulty } from '../../procgen/types'
import { hydrateGenFloorItems, snapViewToGrid } from './procgenHydrate'
import { pickPlayerSpawnCell } from './playerFloorCell'
import { npcsWithDefaultStatuses } from './npcHydrate'
import { randomFloorSeed } from './randomSeed'
import { pushActivityLog } from './activityLog'
import { applyXp } from './runProgression'
import {
  clampCampEveryFloors,
  difficultyForSegment,
  floorTypeForFloorIndex,
  segmentIndexForFloor,
  shouldOpenCampHub,
} from './runFloorSchedule'

export function descendToNextFloor(state: GameState): GameState {
  const w = state.floor.w
  const h = state.floor.h
  const nextFloorIndex = state.floor.floorIndex + 1
  const every = clampCampEveryFloors(state.render.campEveryFloors)
  const nextFloorType = floorTypeForFloorIndex(nextFloorIndex, every)
  const segment = segmentIndexForFloor(nextFloorIndex, every)
  const nextDifficulty = normalizeFloorGenDifficulty(difficultyForSegment(segment))
  const nextSeed = randomFloorSeed()

  const gen = generateDungeon({
    seed: nextSeed,
    w,
    h,
    floorIndex: nextFloorIndex,
    floorType: nextFloorType,
    floorProperties: state.floor.floorProperties,
    difficulty: nextDifficulty,
    npcSpawnCountMin: state.render.npcSpawnCountMin,
    npcSpawnCountMax: state.render.npcSpawnCountMax,
  })

  const playerPos = pickPlayerSpawnCell(gen.tiles, w, h, gen.entrance, gen.pois)
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
      roomHazardAppliedForRoomId: undefined,
    },
    party: { ...state.party, items: { ...state.party.items, ...spawnedItems } },
    view: snapViewToGrid(w, h, state.render.camEyeHeight, playerPos, playerDir),
  }

  const xpRes = applyXp(next, 12)
  next = xpRes.state

  const camp = shouldOpenCampHub(nextFloorIndex, every)
  if (camp) {
    next = {
      ...next,
      ui: {
        ...next.ui,
        screen: 'hub',
        hubScene: 'village',
        hubKind: 'camp',
        tradeSession: undefined,
        hubInnkeeperSpeech: undefined,
        hubInnkeeperSpeechTtlMs: undefined,
        settingsOpen: false,
      },
      run: {
        ...next.run,
        hubInnkeeperTradeStock: undefined,
      },
    }
    next = pushActivityLog(
      next,
      `Camp · next expedition is floor ${nextFloorIndex} (${nextFloorType}, ${gen.theme?.id ?? 'theme'}). (+12 XP)`,
    )
  } else {
    next = pushActivityLog(
      next,
      `Descended to floor ${nextFloorIndex} (${nextFloorType}, ${gen.theme?.id ?? 'theme'}). (+12 XP)`,
    )
  }

  if (xpRes.leveledUp) {
    for (const perkId of xpRes.perkIds) {
      const perkLabel = perkId === 'vitals_plus5' ? '+5 max HP/STA' : perkId === 'damage_plus10pct' ? '+10% dmg' : perkId
      next = pushActivityLog(next, `Reached level ${next.run.level}. (${perkLabel})`)
    }
  }
  return next
}
