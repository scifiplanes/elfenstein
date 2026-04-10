import type { FloorType } from '../procgen/types'

export type DungeonEnvTextureSrcs = {
  floor: string
  wall: string
  ceiling: string
}

/** Albedo maps for floor / wall / ceiling voxels (~1 world unit per tile face). */
export function getDungeonEnvTextureSrcs(floorType: FloorType): DungeonEnvTextureSrcs {
  switch (floorType) {
    case 'Dungeon':
      return {
        floor: '/content/dungeon_floor.png',
        wall: '/content/dungon_wall.png',
        ceiling: '/content/dungon_ceiling.png',
      }
    case 'Cave':
      return {
        floor: '/content/cave_floor.png',
        wall: '/content/cave_wall.png',
        ceiling: '/content/cave_ceiling.png',
      }
    case 'Ruins':
      return {
        floor: '/content/ruins_floor.png',
        wall: '/content/ruins_wall.png',
        ceiling: '/content/ruins_ceiling.png',
      }
    case 'Jungle':
      return {
        floor: '/content/jungle_floor.png',
        wall: '/content/jungle_wall.png',
        ceiling: '/content/jungle_ceiling.png',
      }
    case 'LivingBio':
      return {
        floor: '/content/livingbio_floor.png',
        wall: '/content/livingbio_wall.png',
        ceiling: '/content/livingbio_ceiling.png',
      }
    case 'Bunker':
      return {
        floor: '/content/bunker_floor.png',
        wall: '/content/bunker_wall.png',
        ceiling: '/content/bunker_ceiling.png',
      }
    case 'Golem':
      return {
        floor: '/content/golem_floor.png',
        wall: '/content/golem_wall.png',
        ceiling: '/content/golem_ceiling.png',
      }
    case 'Catacombs':
      return {
        floor: '/content/catacombs_floor.png',
        wall: '/content/catacombs_wall.png',
        ceiling: '/content/catacombs_ceiling.png',
      }
    case 'Palace':
      return {
        floor: '/content/palace_floor.png',
        wall: '/content/palace_wall.png',
        ceiling: '/content/palace_ceiling.png',
      }
  }
}
