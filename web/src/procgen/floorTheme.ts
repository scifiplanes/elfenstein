import type { Rng } from './seededRng'
import { layoutProfile } from './floorLayoutProfile'
import type { FloorGenTheme, FloorProperty, FloorType } from './types'

/**
 * Forced theme when the floor has **Cursed** and uses the Dungeon layout profile
 * (same mood as the former pool[1] dungeon roll).
 */
const CURSED_DUNGEON_THEME_ID = 'dungeon_cool'

/**
 * Forced theme when the floor has **Destroyed** and uses the Ruins layout profile
 * (earth umber — distinct from Burning hazard red; see ADR-0167).
 */
const DESTROYED_RUINS_THEME_ID = 'ruins_umber'

function indexOfThemeId(pool: readonly FloorGenTheme[], id: string): number {
  const i = pool.findIndex((t) => t.id === id)
  return i >= 0 ? i : 0
}

/**
 * Shared pool: every `FloorType` picks from these twelve palettes (theme RNG stream).
 * Order is stable for save/debug; ids are the stable public keys for tuning.
 */
export const FLOOR_THEME_POOL: FloorGenTheme[] = [
  {
    id: 'dungeon_warm',
    floorColor: '#e8dcc8',
    wallColor: '#d4c4b0',
    ceilColor: '#c8c0d0',
  },
  {
    id: 'dungeon_cool',
    floorColor: '#d0d8e8',
    wallColor: '#b8c0d0',
    ceilColor: '#a8b0c8',
  },
  {
    id: 'cave_damp',
    floorColor: '#b8c8b8',
    wallColor: '#9ca89c',
    ceilColor: '#889088',
  },
  {
    id: 'cave_deep',
    floorColor: '#a8b0c0',
    wallColor: '#8890a0',
    ceilColor: '#707888',
  },
  {
    id: 'ruins_bleach',
    floorColor: '#e8e4dc',
    wallColor: '#dcd8d0',
    ceilColor: '#d0ccc4',
  },
  {
    id: 'ruins_umber',
    floorColor: '#ddd0c0',
    wallColor: '#c8b8a8',
    ceilColor: '#b8a898',
  },
  {
    id: 'jungle_moss',
    floorColor: '#4d5f3c',
    wallColor: '#3e4a32',
    ceilColor: '#2c3626',
  },
  {
    id: 'bio_chamber',
    floorColor: '#5d4e52',
    wallColor: '#6e5460',
    ceilColor: '#3d3438',
  },
  {
    id: 'bunker_steel',
    floorColor: '#8a9098',
    wallColor: '#6a7078',
    ceilColor: '#5a6068',
  },
  {
    id: 'catacomb_deep',
    floorColor: '#989088',
    wallColor: '#787068',
    ceilColor: '#585048',
  },
  {
    id: 'nano_violet',
    floorColor: '#c8c0d8',
    wallColor: '#a8a0c0',
    ceilColor: '#8880a8',
  },
  {
    id: 'palace_marble',
    floorColor: '#f0ebe4',
    wallColor: '#e0d8d0',
    ceilColor: '#d8d0c8',
  },
]

/**
 * Deterministic theme roll from floor type + properties (no extra RNG stream required beyond `rng`).
 */
export function pickFloorTheme(args: {
  floorType: FloorType
  floorProperties?: FloorProperty[]
  rng: Pick<Rng, 'next'>
}): FloorGenTheme {
  const { floorType, floorProperties, rng } = args
  const props = floorProperties ?? []
  const pool = FLOOR_THEME_POOL
  let idx = Math.floor(rng.next() * pool.length) % pool.length
  const prof = layoutProfile(floorType)
  if (props.includes('Cursed') && prof === 'Dungeon') {
    idx = indexOfThemeId(pool, CURSED_DUNGEON_THEME_ID)
  }
  if (props.includes('Destroyed') && prof === 'Ruins') {
    idx = indexOfThemeId(pool, DESTROYED_RUINS_THEME_ID)
  }
  const base = pool[idx]!
  return { ...base }
}
