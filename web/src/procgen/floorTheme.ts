import type { Rng } from './seededRng'
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
  const pool =
    floorType === 'Cave' ? CAVE_THEMES : floorType === 'Ruins' ? RUINS_THEMES : DUNGEON_THEMES
  let idx = Math.floor(rng.next() * pool.length) % pool.length
  if (props.includes('Cursed') && floorType === 'Dungeon') idx = 1 % pool.length
  if (props.includes('Destroyed') && floorType === 'Ruins') idx = 1 % pool.length
  const base = pool[idx]!
  return { ...base }
}
