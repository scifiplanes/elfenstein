import type { ContentDB } from '../content/contentDb'
import type { GameState, InventoryGrid, ItemId } from '../types'
import { DEFAULT_HUB_HOTSPOTS } from '../hubHotspotDefaults'
import { DEFAULT_AUDIO, DEFAULT_RENDER } from '../tuningDefaults'
import { generateDungeon } from '../../procgen/generateDungeon'
import { hydrateGenFloorItems, snapViewToGrid } from './procgenHydrate'
import { pickPlayerSpawnCell } from './playerFloorCell'
import { npcsWithDefaultStatuses } from './npcHydrate'
import { randomFloorSeed } from './randomSeed'

function mkInventory(cols: number, rows: number): InventoryGrid {
  return { cols, rows, slots: Array.from({ length: cols * rows }, () => null) }
}

function place(inv: InventoryGrid, itemId: ItemId, idx: number) {
  if (idx < 0 || idx >= inv.slots.length) throw new Error('Bad inventory index')
  inv.slots[idx] = itemId
}

const DEFAULT_FLOOR_W = 31
const DEFAULT_FLOOR_H = 31

export function makeInitialState(_content: ContentDB): GameState {
  const nowMs = performance.now()
  const floorSeed = randomFloorSeed()
  const defaultCamEyeHeight = DEFAULT_RENDER.camEyeHeight

  const cols = 10
  const rows = 2
  const inv = mkInventory(cols, rows)
  const items: GameState['party']['items'] = {
    i_mush: { id: 'i_mush', defId: 'Mushrooms', qty: 1 },
    i_root: { id: 'i_root', defId: 'Foodroot', qty: 1 },
    i_wbe: { id: 'i_wbe', defId: 'WaterbagEmpty', qty: 1 },
    i_stone: { id: 'i_stone', defId: 'Stone', qty: 1 },
    i_stick: { id: 'i_stick', defId: 'Stick', qty: 1 },
    i_club: { id: 'i_club', defId: 'Club', qty: 1 },
    i_key: { id: 'i_key', defId: 'IronKey', qty: 1 },
    i_band: { id: 'i_band', defId: 'BandageStrip', qty: 1 },
    i_anti: { id: 'i_anti', defId: 'AntitoxinVial', qty: 1 },
    i_poul: { id: 'i_poul', defId: 'HerbPoultice', qty: 1 },
    i_chisel: { id: 'i_chisel', defId: 'Chisel', qty: 1 },
  }
  place(inv, 'i_mush', 0)
  place(inv, 'i_root', 1)
  place(inv, 'i_wbe', 2)
  place(inv, 'i_key', 3)
  place(inv, 'i_stone', 10)
  place(inv, 'i_stick', 11)
  place(inv, 'i_club', 12)
  place(inv, 'i_band', 4)
  place(inv, 'i_anti', 5)
  place(inv, 'i_poul', 6)
  place(inv, 'i_chisel', 7)

  const w = DEFAULT_FLOOR_W
  const h = DEFAULT_FLOOR_H
  const floorIndex = 0
  const floorType = 'Dungeon' as const
  const floorProperties = [] as import('../../procgen/types').FloorProperty[]
  const difficulty = 1 as const
  const gen = generateDungeon({
    seed: floorSeed,
    w,
    h,
    floorIndex,
    floorType,
    floorProperties,
    difficulty,
  })
  const { spawnedItems, spawnedOnFloor } = hydrateGenFloorItems(DEFAULT_RENDER, gen.floorItems, floorSeed)
  const playerPos = pickPlayerSpawnCell(gen.tiles, w, h, gen.entrance, gen.pois)
  const playerDir = 0 as const

  return {
    nowMs,
    ui: {
      screen: 'game',
      debugOpen: false,
      sfxQueue: [],
      procgenDebugOverlay: undefined,
      roomTelegraphMode: 'auto',
      roomTelegraphStrength: 0.22,
      activityLog: [],
      death: undefined,
    },
    render: { ...DEFAULT_RENDER },
    audio: { ...DEFAULT_AUDIO },
    hubHotspots: {
      village: {
        tavern: { ...DEFAULT_HUB_HOTSPOTS.village.tavern },
        cave: { ...DEFAULT_HUB_HOTSPOTS.village.cave },
      },
      tavern: {
        innkeeper: { ...DEFAULT_HUB_HOTSPOTS.tavern.innkeeper },
        exit: { ...DEFAULT_HUB_HOTSPOTS.tavern.exit },
      },
    },
    run: {
      runId: `run_${floorSeed}`,
      startedAtMs: nowMs,
      xp: 0,
      level: 1,
      perkHistory: [],
      bonuses: { hpMaxBonus: 0, staminaMaxBonus: 0, damageBonusPct: 0 },
      checkpoint: undefined,
    },
    view: snapViewToGrid(w, h, defaultCamEyeHeight, playerPos, playerDir),
    floor: {
      seed: floorSeed,
      floorIndex,
      floorType,
      floorProperties,
      difficulty,
      w,
      h,
      tiles: gen.tiles,
      playerPos,
      playerDir,
      gen,
      pois: gen.pois,
      itemsOnFloor: spawnedOnFloor,
      floorGeomRevision: 1,
      npcs: npcsWithDefaultStatuses(gen.npcs),
    },
    party: {
      chars: [
        {
          id: 'c1',
          name: 'Char1',
          species: 'Igor',
          endurance: 6,
          stats: {
            strength: 8,
            agility: 5,
            speed: 5,
            perception: 5,
            endurance: 6,
            intelligence: 4,
            wisdom: 4,
            luck: 5,
          },
          armor: 1,
          resistances: { Cut: 0.05 },
          skills: { chipping: 2, foraging: 1 },
          hunger: 60,
          thirst: 60,
          hp: 40,
          stamina: 30,
          statuses: [{ id: 'Cursed' }],
          equipment: {},
        },
        {
          id: 'c2',
          name: 'Char2',
          species: 'Mycyclops',
          endurance: 7,
          stats: {
            strength: 6,
            agility: 4,
            speed: 4,
            perception: 6,
            endurance: 7,
            intelligence: 6,
            wisdom: 6,
            luck: 4,
          },
          armor: 0,
          resistances: { Earth: 0.1, Fire: 0.05 },
          skills: { cooking: 1, foraging: 2 },
          hunger: 60,
          thirst: 60,
          hp: 42,
          stamina: 30,
          statuses: [],
          equipment: {},
        },
        {
          id: 'c3',
          name: 'Char3',
          species: 'Frosch',
          endurance: 5,
          stats: {
            strength: 5,
            agility: 7,
            speed: 7,
            perception: 5,
            endurance: 5,
            intelligence: 4,
            wisdom: 4,
            luck: 6,
          },
          armor: 0,
          resistances: { Water: 0.15 },
          skills: { weaving: 1, cooking: 2 },
          hunger: 60,
          thirst: 60,
          hp: 38,
          stamina: 30,
          statuses: [],
          equipment: {},
        },
        {
          id: 'c4',
          name: 'Char4',
          species: 'Afonso',
          endurance: 6,
          stats: {
            strength: 6,
            agility: 6,
            speed: 6,
            perception: 6,
            endurance: 6,
            intelligence: 6,
            wisdom: 5,
            luck: 5,
          },
          armor: 0,
          resistances: { Thunder: 0.05 },
          skills: { chipping: 1, weaving: 1 },
          hunger: 60,
          thirst: 60,
          hp: 40,
          stamina: 30,
          statuses: [],
          equipment: {},
        },
      ],
      inventory: inv,
      items: { ...items, ...spawnedItems },
    },
  }
}
