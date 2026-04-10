import type { ItemDefId } from '../game/types'

/**
 * Item defs that are valid in `DEFAULT_ITEMS` but are **not** expected from procgen floor spawns,
 * lock keys, POI chest/barrel/crate loot, or NPC quest tables. Add here when introducing
 * craft-only, transform-only, or quest-chain items; then run `npm run audit:procgen-content`.
 */
export const ITEM_DEF_IDS_INTENTIONALLY_NON_PROCGEN: readonly ItemDefId[] = [
  'WaterbagFull', // Well transform from WaterbagEmpty
  'Spear',
  'Firebolt',
  'Fireshield',
  'Bow',
  'Flourball',
  'SwarmQueen',
  'SwarmBasket',
  'CapturedSwarm',
  // Craft / transform outputs (not rolled by `pickFloorItemDefFromTable`).
  'Torch',
  'Headlamp',
  'Lantern',
  'Staff',
  'AttunedStaff',
  'BoneSpike',
  'MushedRoot',
  'Shroomcake',
  'Shroompie',
  'Rootsoup',
  'RootsoupSalted',
  'PreservedGrub',
  'Claw',
  'Tooth',
]
