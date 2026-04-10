import type { FloorType } from './types'

/** Which legacy generator + shaping path a floor uses (new floor types map here until bespoke realizers exist). */
export type LayoutProfile = 'Dungeon' | 'Cave' | 'Ruins'

export function layoutProfile(floorType: FloorType): LayoutProfile {
  switch (floorType) {
    case 'Jungle':
    case 'LivingBio':
      return 'Cave'
    case 'Bunker':
    case 'Golem':
      return 'Dungeon'
    case 'Catacombs':
    case 'Palace':
      return 'Ruins'
    default:
      return floorType
  }
}
