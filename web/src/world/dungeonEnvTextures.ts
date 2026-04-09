import type { FloorType } from '../procgen/types'

export type DungeonEnvTextureSrcs = {
  floor: string
  wall: string
  ceiling: string
}

/** Albedo maps for floor / wall / ceiling voxels (~1 world unit per tile face). */
export function getDungeonEnvTextureSrcs(floorType: FloorType): DungeonEnvTextureSrcs {
  if (floorType === 'Ruins') {
    return {
      floor: '/content/ruins_floor.png',
      wall: '/content/ruins_wall.png',
      ceiling: '/content/ruins_ceiling.png',
    }
  }
  if (floorType === 'Dungeon') {
    return {
      floor: '/content/dungeon_floor.png',
      wall: '/content/dungon_wall.png',
      ceiling: '/content/dungon_ceiling.png',
    }
  }
  // Cave uses the cave set.
  return {
    floor: '/content/cave_floor.png',
    wall: '/content/cave_wall.png',
    ceiling: '/content/cave_ceiling.png',
  }
}
