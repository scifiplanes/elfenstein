import type { FloorPoi, ItemDefId, Tile, Vec2 } from '../game/types'

export type FloorType = 'Dungeon' | 'Cave' | 'Ruins'

export type FloorProperty = 'Infested' | 'Cursed' | 'Destroyed' | 'Overgrown'

export type FloorGenInput = {
  /** Canonical seed for the floor (already mixed with world/floor index by caller if desired). */
  seed: number
  w: number
  h: number
  floorType: FloorType
  floorProperties?: FloorProperty[]
}

export type GenRoom = {
  id: string
  rect: { x: number; y: number; w: number; h: number }
  center: Vec2
  leafDepth: number
  tags?: {
    roomFunction?: 'Passage' | 'Habitat' | 'Workshop' | 'Communal' | 'Storage'
    roomProperties?: 'Burning' | 'Flooded' | 'Infected'
    roomStatus?: 'Overgrown' | 'Destroyed' | 'Collapsed'
    size?: 'tiny' | 'medium' | 'large'
  }
}

export type GenDoor = {
  pos: Vec2
  locked: boolean
  /** Lock id such as "A" for future key/lock graphs. */
  lockId?: string
}

export type FloorGenMeta = {
  genVersion: number
  /**
   * Phase-separated deterministic seeds used to derive RNG streams.
   * Convention (initial):
   * - layout: 1
   * - tags: 2
   * - population: 3
   * - locks: 4
   */
  streams: { layout: number; tags: number; population: number; locks: number }
}

export type GenFloorItem = {
  defId: ItemDefId
  pos: Vec2
  qty?: number
}

export type FloorGenOutput = {
  tiles: Tile[]
  pois: FloorPoi[]
  rooms: GenRoom[]
  doors: GenDoor[]
  floorItems: GenFloorItem[]
  entrance: Vec2
  exit: Vec2
  meta: FloorGenMeta
}

