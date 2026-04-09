import type { FloorPoi, ItemDefId, NpcKind, NpcLanguage, StatusEffectId, Tile, Vec2 } from '../game/types'

export type FloorType = 'Dungeon' | 'Cave' | 'Ruins'

export type FloorProperty = 'Infested' | 'Cursed' | 'Destroyed' | 'Overgrown'

/** 0 = easier (fewer lock rolls, more gen rerolls); 1 = default; 2 = harder (more lock pressure, fewer rerolls). */
export type FloorGenDifficulty = 0 | 1 | 2

export function normalizeFloorGenDifficulty(v: number | undefined): FloorGenDifficulty {
  if (v === 0 || v === 1 || v === 2) return v
  return 1
}

export type FloorGenInput = {
  /** Canonical seed for the floor (already mixed with world/floor index by caller if desired). */
  seed: number
  w: number
  h: number
  /** 0-based; mixed into attempt seed for stable per-floor variation. */
  floorIndex?: number
  floorType: FloorType
  floorProperties?: FloorProperty[]
  /** Omitted or invalid values behave as `1` (normal). */
  difficulty?: number
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
  /** `shortcut` marks an alternate entrance→exit route exists (not a distinct physical edge in the grid). */
  kind: 'path' | 'locked' | 'shortcut'
  lockId?: string
}

export type MissionGraph = {
  nodes: MissionGraphNode[]
  edges: MissionGraphEdge[]
  /** Multiple shortest-length routes exist between entrance and exit (loop / backtrack relief). */
  hasAlternateEntranceExitRoute?: boolean
}

/** Procgen theme for dungeon materials (tints base textures in the renderer). */
export type FloorGenTheme = {
  id: string
  /** Multiply `MeshLambertMaterial.color` for floor voxels (hex, e.g. #ffffff). */
  floorColor: string
  wallColor: string
  ceilColor: string
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
    theme: number
    /** Present from genVersion 4; reserved for `planMissionBeforeGeometry` / mission-first embed. */
    mission?: number
  }
  /** Soft layout score (higher = more loops / fewer dead-ends heuristic). */
  layoutScore?: number
  /** Input difficulty echoed for dumps/debug (present from genVersion 5). */
  difficulty?: FloorGenDifficulty
  /** Optional metrics to help tune topology (non-gameplay). */
  layoutMetrics?: {
    wideness: number
    junctions: number
    deadEnds: number
    reachableFloors: number
    loopsAdded: number
    /** Number of corridor door-frame throats applied (Dungeon floors only). */
    doorFramesApplied?: number
  }
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
  /** Runtime combat/status debuffs; omitted in older gen JSON. */
  statuses?: Array<{ id: StatusEffectId; untilMs?: number }>
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
  /** Visual theme applied by `WorldRenderer` (optional for backward-compatible dumps). */
  theme?: FloorGenTheme
}
