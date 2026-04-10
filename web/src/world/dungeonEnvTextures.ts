import type { FloorType } from '../procgen/types'

export type DungeonEnvTextureSrcs = {
  floor: string
  wall: string
  ceiling: string
}

/** Albedo maps for floor / wall / ceiling voxels (~1 world unit per tile face). */
export function getDungeonEnvTextureSrcs(floorType: FloorType): DungeonEnvTextureSrcs {
  if (floorType === 'Ruins' || floorType === 'Catacombs' || floorType === 'Palace') {
    return {
      floor: '/content/ruins_floor.png',
      wall: '/content/ruins_wall.png',
      ceiling: '/content/ruins_ceiling.png',
    }
  }
  if (
    floorType === 'Dungeon' ||
    floorType === 'Bunker' ||
    floorType === 'Golem'
  ) {
    return {
      floor: '/content/dungeon_floor.png',
      wall: '/content/dungon_wall.png',
      ceiling: '/content/dungon_ceiling.png',
    }
  }
  // Cave, Jungle, LivingBio — organic set (future: jungle_floor.png, bio_wall.png, etc.)
  return {
    floor: '/content/cave_floor.png',
    wall: '/content/cave_wall.png',
    ceiling: '/content/cave_ceiling.png',
  }
}
