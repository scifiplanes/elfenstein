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
 * Shared pool: every `FloorType` picks from these twenty-four palettes (theme RNG stream).
 * First twelve are moderate reads; last twelve are high-contrast “extreme” variants.
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
  {
    id: 'void_ultra',
    floorColor: '#1a0a24',
    wallColor: '#12061a',
    ceilColor: '#0d0410',
  },
  {
    id: 'acid_bright',
    floorColor: '#5cff2a',
    wallColor: '#3ad018',
    ceilColor: '#208010',
  },
  {
    id: 'frost_glare',
    floorColor: '#eef8ff',
    wallColor: '#d4ecff',
    ceilColor: '#b8dcfc',
  },
  {
    id: 'toxic_lime',
    floorColor: '#c8e818',
    wallColor: '#98b010',
    ceilColor: '#688008',
  },
  {
    id: 'midnight_ink',
    floorColor: '#081830',
    wallColor: '#051020',
    ceilColor: '#030818',
  },
  {
    id: 'ember_coal',
    floorColor: '#2c2220',
    wallColor: '#201818',
    ceilColor: '#181010',
  },
  {
    id: 'magenta_rift',
    floorColor: '#c848c0',
    wallColor: '#903090',
    ceilColor: '#602068',
  },
  {
    id: 'sulfur_yellow',
    floorColor: '#f0e010',
    wallColor: '#c8b808',
    ceilColor: '#989008',
  },
  {
    id: 'copper_patina',
    floorColor: '#3a9888',
    wallColor: '#2a7868',
    ceilColor: '#1a5848',
  },
  {
    id: 'ash_inferno',
    floorColor: '#3a1824',
    wallColor: '#281018',
    ceilColor: '#180810',
  },
  {
    id: 'glitch_triad',
    floorColor: '#18d0d0',
    wallColor: '#c028a0',
    ceilColor: '#e0c818',
  },
  {
    id: 'monolith_stark',
    floorColor: '#d8d8d8',
    wallColor: '#404040',
    ceilColor: '#101010',
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
