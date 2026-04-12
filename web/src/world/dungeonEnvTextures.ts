import type { FloorType } from '../procgen/types'

export type DungeonEnvTextureSrcs = {
  floor: string
  wall: string
  ceiling: string
}

/** Same triple as overgrown room overlay; **Jungle** floors use this for the whole level. */
export const OVERGROWN_ENV_TEXTURE_SRCS: DungeonEnvTextureSrcs = {
  floor: '/content/overgrown_floor.png',
  wall: '/content/overgrown_wall.png',
  ceiling: '/content/overgrown_ceiling.png',
}

/**
 * Albedo maps for floor / wall / ceiling voxels (~1 world unit per tile face).
 * Returns **null** for themes that use procedural **DataTexture**s in `dungeonEnvProceduralTextures.ts`.
 */
export function getDungeonEnvTextureSrcs(floorType: FloorType): DungeonEnvTextureSrcs | null {
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
      return OVERGROWN_ENV_TEXTURE_SRCS
    default:
      return null
  }
}
