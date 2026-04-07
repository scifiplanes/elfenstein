import type { FloorPoi, ItemDefId, NpcKind, NpcLanguage, Tile, Vec2 } from '../game/types'

export type FloorType = 'Dungeon' | 'Cave' | 'Ruins'

export type FloorProperty = 'Infested' | 'Cursed' | 'Destroyed' | 'Overgrown'

export type FloorGenInput = {
  /** Canonical seed for the floor (already mixed with world/floor index by caller if desired). */
  seed: number
  w: number
  h: number
  /** 0-based; mixed into attempt seed for stable per-floor variation. */
  floorIndex?: number
  floorType: FloorType
  floorProperties?: FloorProperty[]
}

export type DistrictTag = 'NorthWing' | 'SouthWing' | 'EastWing' | 'WestWing' | 'Core' | 'Ruin'

export type GenRoom = {
  id: string
  rect: { x: number; y: number; w: number; h: number }
  center: Vec2
  leafDepth: number
  /** Voronoi / seeded region for spawn bias. */
  district?: DistrictTag
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
  /** Lock id such as "A" / "B" for key matching. */
  lockId?: string
  /** Item def that opens this door when locked (defaults to IronKey in gameplay if omitted). */
  keyDefId?: ItemDefId
  /** Order along the critical path (entrance → exit) for multi-lock validation. */
  orderOnPath?: number
}

export type MissionNodeRole =
  | 'Entrance'
  | 'Exit'
  | 'Well'
  | 'Bed'
  | 'Chest'
  | 'LockGate'
  | 'KeyPickup'

export type MissionGraphNode = {
  id: string
  role: MissionNodeRole
  pos: Vec2
  lockId?: string
  poiId?: string
  itemDefId?: ItemDefId
}

export type MissionGraphEdge = {
  fromId: string
  toId: string
  kind: 'path' | 'locked'
  lockId?: string
}

export type MissionGraph = {
  nodes: MissionGraphNode[]
  edges: MissionGraphEdge[]
}

export type FloorGenMeta = {
  genVersion: number
  /** Input seed for this generation request (before any reroll attempt mixing). */
  inputSeed: number
  /** Seed actually used for this attempt (equals inputSeed when attempt=0). */
  attemptSeed: number
  /** 0-based reroll attempt index. */
  attempt: number
  w: number
  h: number
  /**
   * Phase-separated deterministic seeds used to derive RNG streams.
   */
  streams: {
    layout: number
    tags: number
    population: number
    locks: number
    districts: number
    score: number
  }
  /** Soft layout score (higher = more loops / fewer dead-ends heuristic). */
  layoutScore?: number
}

export type GenFloorItem = {
  defId: ItemDefId
  pos: Vec2
  qty?: number
  /** When set, this floor item is the key for procgen lock `lockId`. */
  forLockId?: string
}

export type GenNpc = {
  id: string
  kind: NpcKind
  name: string
  pos: Vec2
  status: 'hostile' | 'neutral' | 'friendly'
  hp: number
  language: NpcLanguage
  quest?: { wants: ItemDefId; hated: ItemDefId[] }
}

export type FloorGenOutput = {
  tiles: Tile[]
  pois: FloorPoi[]
  rooms: GenRoom[]
  doors: GenDoor[]
  floorItems: GenFloorItem[]
  npcs: GenNpc[]
  entrance: Vec2
  exit: Vec2
  meta: FloorGenMeta
  /** Progression + POI anchor graph for debug / future mission logic. */
  missionGraph?: MissionGraph
}
