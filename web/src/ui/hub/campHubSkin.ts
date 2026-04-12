import { layoutProfile } from '../../procgen/floorLayoutProfile'
import type { FloorType } from '../../procgen/types'

export type CampHubSkin = 'cave' | 'dungeon'

/**
 * Which `camp_<skin>.png` / hover triple to use after clearing a dungeon segment.
 * Starting hub (`hubKind` unset) uses `village.png` instead — camps never pick a village skin.
 */
export function campHubSkinForFloorType(floorType: FloorType): CampHubSkin {
  const p = layoutProfile(floorType)
  if (p === 'Cave') return 'cave'
  if (p === 'Dungeon') return 'dungeon'
  // Ruins layout profile (Ruins / Catacombs / Palace): avoid camp_village*
  if (floorType === 'Catacombs' || floorType === 'Palace') return 'dungeon'
  return 'cave'
}
