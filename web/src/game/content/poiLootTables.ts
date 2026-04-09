import type { ItemDefId } from '../types'

/**
 * Deterministic chest loot: hash key uses `floor.seed` + `poiId` (see `state/poi.ts`).
 * Keep in sync with procgen content audit (`npm run audit:procgen-content`).
 */
export const CHEST_LOOT_DEF_IDS = [
  'Stick',
  'Stone',
  'Mushrooms',
  'Foodroot',
  'BandageStrip',
  'AntitoxinVial',
  'HerbPoultice',
  'Chisel',
  'ClothScrap',
  'Twine',
  'HerbLeaf',
  'BitterHerb',
  'GlassVial',
  'StoneShard',
  'Ash',
  'Sulfur',
  'Club',
  'MortarMeal',
  'HerbTea',
  'WaterbagEmpty',
  'WoolCap',
  'HerbCirclet',
  'SporeCap',
] as const satisfies readonly ItemDefId[]

/**
 * Barrel / crate loot (separate hash namespace from chest).
 */
export const CONTAINER_LOOT_DEF_IDS = [
  'Stick',
  'Stone',
  'Mushrooms',
  'Foodroot',
  'BandageStrip',
  'AntitoxinVial',
  'HerbPoultice',
  'Chisel',
  'ClothScrap',
  'Twine',
  'HerbLeaf',
  'Ash',
  'Sulfur',
  'Club',
  'Sling',
  'Bolas',
  'WaterbagEmpty',
  'GlassVial',
  'WoolCap',
  'HerbCirclet',
  'SporeCap',
] as const satisfies readonly ItemDefId[]
