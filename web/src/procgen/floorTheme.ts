import type { Rng } from './seededRng'
import { layoutProfile } from './floorLayoutProfile'
import type { FloorGenTheme, FloorProperty, FloorType } from './types'

const DUNGEON_THEMES: FloorGenTheme[] = [
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
]

const CAVE_THEMES: FloorGenTheme[] = [
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
]

const RUINS_THEMES: FloorGenTheme[] = [
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
]

/** Jungle / forest reskin (layout uses Cave realizer). */
const JUNGLE_THEMES: FloorGenTheme[] = [
  {
    id: 'jungle_canopy',
    floorColor: '#4a5c3a',
    wallColor: '#3d4a32',
    ceilColor: '#2a3528',
  },
  {
    id: 'jungle_floor',
    floorColor: '#5c6b48',
    wallColor: '#454f3a',
    ceilColor: '#323828',
  },
]

/** Living / bio reskin (layout uses Cave realizer). */
const LIVING_BIO_THEMES: FloorGenTheme[] = [
  {
    id: 'bio_pink',
    floorColor: '#6b5a62',
    wallColor: '#8a6270',
    ceilColor: '#4a3840',
  },
  {
    id: 'bio_vein',
    floorColor: '#5a5048',
    wallColor: '#6b5850',
    ceilColor: '#3a3028',
  },
]

/** Bunker reskin (layout uses Dungeon realizer). */
const BUNKER_THEMES: FloorGenTheme[] = [
  {
    id: 'bunker_concrete',
    floorColor: '#9a9a92',
    wallColor: '#7a7a72',
    ceilColor: '#6a6a64',
  },
  {
    id: 'bunker_steel',
    floorColor: '#8a9098',
    wallColor: '#6a7078',
    ceilColor: '#5a6068',
  },
]

/** Catacombs reskin (layout uses Ruins realizer). */
const CATACOMBS_THEMES: FloorGenTheme[] = [
  {
    id: 'catacomb_ash',
    floorColor: '#c8c4b8',
    wallColor: '#a8a498',
    ceilColor: '#888478',
  },
  {
    id: 'catacomb_deep',
    floorColor: '#989088',
    wallColor: '#787068',
    ceilColor: '#585048',
  },
]

/** Magical / “nano” reskin (layout uses Dungeon realizer). */
const MAGICAL_NANO_THEMES: FloorGenTheme[] = [
  {
    id: 'nano_teal',
    floorColor: '#c0d8d8',
    wallColor: '#a0c0c8',
    ceilColor: '#80a0b0',
  },
  {
    id: 'nano_violet',
    floorColor: '#c8c0d8',
    wallColor: '#a8a0c0',
    ceilColor: '#8880a8',
  },
]

/** Palace reskin (layout uses Ruins realizer). */
const PALACE_THEMES: FloorGenTheme[] = [
  {
    id: 'palace_marble',
    floorColor: '#f0ebe4',
    wallColor: '#e0d8d0',
    ceilColor: '#d8d0c8',
  },
  {
    id: 'palace_gilt',
    floorColor: '#e8dcc8',
    wallColor: '#d8c8a8',
    ceilColor: '#c8b898',
  },
]

function themePoolForFloorType(floorType: FloorType): FloorGenTheme[] {
  switch (floorType) {
    case 'Jungle':
      return JUNGLE_THEMES
    case 'LivingBio':
      return LIVING_BIO_THEMES
    case 'Bunker':
      return BUNKER_THEMES
    case 'Catacombs':
      return CATACOMBS_THEMES
    case 'Golem':
      return MAGICAL_NANO_THEMES
    case 'Palace':
      return PALACE_THEMES
    case 'Cave':
      return CAVE_THEMES
    case 'Ruins':
      return RUINS_THEMES
    default:
      return DUNGEON_THEMES
  }
}

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
  const pool = themePoolForFloorType(floorType)
  let idx = Math.floor(rng.next() * pool.length) % pool.length
  const prof = layoutProfile(floorType)
  if (props.includes('Cursed') && prof === 'Dungeon') idx = 1 % pool.length
  if (props.includes('Destroyed') && prof === 'Ruins') idx = 1 % pool.length
  const base = pool[idx]!
  return { ...base }
}
