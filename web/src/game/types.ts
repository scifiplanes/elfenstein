export type Id = string

export type Vec2 = { x: number; y: number }

export type ItemId = Id
export type ItemDefId = Id
export type CharacterId = Id

export type Species = 'Igor' | 'Mycyclops' | 'Frosch'
export type StatusEffectId =
  | 'Poisoned'
  | 'Blessed'
  | 'Sick'
  | 'Bleeding'
  | 'Burning'
  | 'Drenched'
  | 'Drowsy'
  | 'Focused'
  | 'Cursed'
  | 'Frightened'
  | 'Rooted'
  | 'Shielded'
  | 'Starving'
  | 'Dehydrated'
export type NpcLanguage = 'DeepGnome' | 'Zalgo' | 'Mojibake'
export type NpcKind = 'Wurglepup' | 'Bobr' | 'Skeleton' | 'Catoctopus'

export type EquipmentSlot =
  | 'head'
  | 'handLeft'
  | 'handRight'
  | 'feet'
  | 'clothing'
  | 'accessory'

export type PortraitDropTarget = 'eyes' | 'mouth'

export type Tile = 'wall' | 'floor' | 'door' | 'lockedDoor'

export type PoiKind = 'Well' | 'Chest' | 'Bed' | 'Shrine' | 'CrackedWall'

export type FloorPoi = {
  id: Id
  kind: PoiKind
  pos: Vec2
  opened?: boolean
  /** Well only: no water VFX; base sprite switches to drained art after a successful fill. */
  drained?: boolean
}

export type InventoryItem = {
  id: ItemId
  defId: ItemDefId
  qty: number
}

export type InventoryGrid = {
  cols: number
  rows: number
  slots: Array<ItemId | null>
}

export type Character = {
  id: CharacterId
  name: string
  species: Species
  endurance: number
  hunger: number
  thirst: number
  hp: number
  stamina: number
  statuses: Array<{ id: StatusEffectId; untilMs?: number }>
  equipment: Partial<Record<EquipmentSlot, ItemId>>
}

export type ProcgenDebugOverlayMode = 'districts' | 'roomTags' | 'mission'

export type UiState = {
  debugOpen: boolean
  /** F2-only: tint floor cells from `floor.gen` (dev visualization). */
  procgenDebugOverlay?: ProcgenDebugOverlayMode
  paperdollFor?: CharacterId
  npcDialogFor?: Id
  /** Persistent lines inside the game viewport activity log (newest last; capped). */
  activityLog?: Array<{ id: Id; text: string; atMs: number }>
  shake?: { untilMs: number; magnitude: number; startedAtMs: number }
  sfxQueue?: Array<{ id: Id; kind: 'ui' | 'hit' | 'reject' | 'pickup' | 'munch' | 'step' | 'bump' }>
  /** Short-lived portrait “mouth visible” interaction cue. */
  portraitMouth?: { characterId: CharacterId; startedAtMs: number; untilMs: number }
  /** Short-lived portrait frame shake (inspect/feed resolution). */
  portraitShake?: { characterId: CharacterId; untilMs: number; magnitude: number; startedAtMs: number }
  /** Brief idle-overlay visibility after a portrait-frame tap (opens paperdoll). */
  portraitIdlePulse?: { characterId: CharacterId; untilMs: number }
  crafting?: {
    startedAtMs: number
    endsAtMs: number
    srcItemId: ItemId
    dstItemId: ItemId
    resultDefId: ItemDefId
    failDestroyChancePct: number
  }
}

export type RenderTuning = {
  /** Base emissive lift applied to dungeon materials (multiplied by per-surface factors). */
  baseEmissive: number
  lanternIntensity: number
  lanternDistance: number
  /** Offsets the lantern forward/down to avoid “headlamp flattening”. */
  lanternForwardOffset: number
  lanternVerticalOffset: number
  /** Small time-based modulation to make lantern read like fire. */
  lanternFlickerAmp: number
  lanternFlickerHz: number
  /** Forward-facing beam aligned to camera direction (SpotLight) for readability. */
  lanternBeamIntensityScale: number
  lanternBeamDistanceScale: number
  lanternBeamAngleDeg: number
  lanternBeamPenumbra: number
  torchIntensity: number
  torchDistance: number
  /** 0/1: lantern PointLight casts shadows (cube map; expensive). */
  shadowLanternPoint: number
  /**
   * 0/1: lantern SpotLight may cast shadows when beam intensity is nonzero.
   * When the beam is off (e.g. intensity scale 0), no spot shadow maps run.
   */
  shadowLanternBeam: number
  /** Per-side shadow map resolution for lantern lights (point light uses this for each cube face). */
  shadowMapSize: 128 | 256 | 512
  /** 0 = BasicShadowMap, 1 = PCFShadowMap, 2 = PCFSoftShadowMap */
  shadowFilter: 0 | 1 | 2
  /** Max POI torch lights; picks nearest POIs to the player by Manhattan grid distance. 0 disables. */
  torchPoiLightMax: number
  /** 0/1: fog is fully disabled unless explicitly enabled (debug). */
  fogEnabled: number
  fogDensity: number
  /** First-person eye height in world units (matches camera Y on flat floor). */
  camEyeHeight: number
  /** Moves the rendered camera forward/back along facing without changing grid position (debug/feel). */
  camForwardOffset: number
  camFov: number
  /** Debug-only vertical look; gameplay remains grid/yaw-first. */
  camPitchDeg: number
  /** Camera shake (3D view) positional amplitude, in world units. */
  camShakePosAmp: number
  /** Camera shake (3D view) roll amplitude, in degrees. */
  camShakeRollDeg: number
  /** Camera shake oscillation frequency (Hz). */
  camShakeHz: number
  /**
   * Hold at full shake strength (ms) before fade. 0 = no hold; envelope uses remaining/decay ramp only (legacy).
   * Applies to 3D camera and HUD overlay CSS shake.
   */
  camShakeLengthMs: number
  /** Linear fade duration (ms) after hold; with length 0, scales as min(1, remaining/decay). */
  camShakeDecayMs: number
  /** Scales camera shake strength relative to `ui.shake.magnitude`. */
  camShakeUiMix: number
  ditherStrength: number
  ditherColourPreserve: number
  ditherPixelSize: number
  ditherLevels: number
  ditherMatrixSize: 2 | 4 | 8
  ditherPalette: 0 | 1 | 2 | 3 | 4
  /**
   * When `ditherPalette` is **0** (warm dungeon): blend between quantised dither only (0) and full warm palette snap (1).
   * Ignored for other palette indices.
   */
  ditherPalette0Mix: number
  /** Post-dither levels/contrast. 1 = neutral. Applied after the dither pass. */
  postDitherLevels: number
  /** Post-dither lift (additive). 0 = neutral. Applied after the dither pass. */
  postDitherLift: number
  /** Post-dither gamma. 1 = neutral. Applied after the dither pass. */
  postDitherGamma: number
  /** Drop placement distance ahead of the player (in grid cells). */
  dropAheadCells: number
  /** In-cell jitter radius for floor items (world units; 1.0 == one full cell). */
  dropJitterRadius: number
  /** Max Manhattan distance (cells) allowed when dropping near cursor in the 3D view. */
  dropRangeCells: number
  /** Min time (ms) between Igor portrait idle flashes; actual gap is uniform up to max. */
  portraitIdleGapMinMs: number
  /** Max time (ms) between idle flashes (inclusive upper bound of uniform range with min). */
  portraitIdleGapMaxMs: number
  /** Min visible duration (ms) of one idle flash. */
  portraitIdleFlashMinMs: number
  /** Max visible duration (ms) of one idle flash. */
  portraitIdleFlashMaxMs: number

  /** Feeding “mouth” cue flicker speed (Hz). 0 disables flicker (always visible during cue). */
  portraitMouthFlickerHz: number
  /** Feeding “mouth” cue flicker amount (number of visible chomps / mouth-on pulses). */
  portraitMouthFlickerAmount: number

  /**
   * Portrait interaction shake envelope: hold at full strength (ms) before fade.
   * Used by `ui.portraitShake` (inspect/feed resolution).
   */
  portraitShakeLengthMs: number
  /** Portrait interaction shake linear fade duration (ms) after hold. */
  portraitShakeDecayMs: number
  /** Multiplies `ui.portraitShake.magnitude` (0..n, debug-tunable). */
  portraitShakeMagnitudeScale: number
  /** Portrait interaction shake oscillation frequency (Hz). */
  portraitShakeHz: number

  /**
   * NPC billboard sizing (world units).
   * Size is interpreted as sprite HEIGHT; width is derived from the sprite texture aspect ratio.
   * Randomization is deterministic per-NPC id as ±% around the base size.
   */
  npcFootLift: number
  /**
   * NPC sprite “ground point” within the sprite’s height (in sprite-height units from the bottom).
   * 0.0 means use the bottom edge of the image rectangle (legacy).\n
   * Positive values move the sprite down (as if the feet are higher in the image);
   * negative values move the sprite up (as if the feet are lower than the image bottom).
   */
  npcGroundY_Wurglepup: number
  npcGroundY_Bobr: number
  npcGroundY_Skeleton: number
  npcGroundY_Catoctopus: number
  /** POI Well billboard ground pivot (same units as `npcGroundY_*`). */
  poiGroundY_Well: number
  /** POI Chest closed/open billboard ground pivot (`chest_*.png` sit low in frame). */
  poiGroundY_Chest: number
  /** Multiplies PoI sprite material brightness (1.0 = unchanged). */
  poiSpriteBoost: number
  npcSize_Wurglepup: number
  npcSizeRand_Wurglepup: number
  npcSize_Bobr: number
  npcSizeRand_Bobr: number
  npcSize_Skeleton: number
  npcSizeRand_Skeleton: number
  npcSize_Catoctopus: number
  npcSizeRand_Catoctopus: number
}

export type AudioTuning = {
  masterSfx: number
  masterMusic: number
  distanceMaxCells: number
  volumeNear: number
  volumeFar: number
  lowpassNearHz: number
  lowpassFarHz: number

  /** Munch SFX master scalar (before masterSfx). */
  munchVol: number
  /** Munch noise band: lowpass sweep between these Hz (noise only; thump bypasses HP). */
  munchCutoffHz: number
  munchCutoffEndHz: number
  /** Highpass corner (Hz) on munch noise; clamped below the lowpass sweep so the band stays valid. */
  munchHighpassHz: number
  /** Biquad Q for munch noise highpass. */
  munchHighpassQ: number
  /** Biquad Q for munch noise lowpass. */
  munchLowpassQ: number
  /** Duration of munch envelope (seconds). */
  munchDurSec: number
  /** Thump oscillator frequency for “jaw” feel. */
  munchThumpHz: number
  /** Square LFO tremolo on munch output. */
  munchTremDepth: number
  munchTremHz: number
}

export type GameState = {
  nowMs: number
  ui: UiState
  render: RenderTuning
  audio: AudioTuning

  view: {
    camPos: { x: number; y: number; z: number }
    camYaw: number
    anim?: {
      kind: 'move' | 'turn'
      fromPos: { x: number; y: number; z: number }
      toPos: { x: number; y: number; z: number }
      fromYaw: number
      toYaw: number
      startedAtMs: number
      endsAtMs: number
    }
  }

  floor: {
    seed: number
    /** 0-based floor index (mixed into procgen seed). */
    floorIndex: number
    /** Procgen taxonomy: same as `FloorGenInput.floorType`. */
    floorType: import('../procgen/types').FloorType
    /** Procgen taxonomy: infested/cursed/etc. */
    floorProperties: import('../procgen/types').FloorProperty[]
    /** Procgen pacing: 0 easy, 1 normal, 2 hard (see `FloorGenInput.difficulty`). */
    difficulty: import('../procgen/types').FloorGenDifficulty
    w: number
    h: number
    tiles: Tile[]
    pois: FloorPoi[]
    /** Canonical procgen output bundle (seeded + phase-stable). */
    gen?: import('../procgen/types').FloorGenOutput
    itemsOnFloor: Array<{ id: ItemId; pos: Vec2; jitter: { x: number; z: number } }>
    npcs: Array<{
      id: Id
      kind: NpcKind
      name: string
      pos: Vec2
      status: 'hostile' | 'neutral' | 'friendly'
      hp: number
      language: NpcLanguage
      quest?: { wants: ItemDefId; hated: ItemDefId[] }
    }>
    playerPos: Vec2
    playerDir: 0 | 1 | 2 | 3
  }

  party: {
    chars: Character[]
    inventory: InventoryGrid
    items: Record<ItemId, InventoryItem>
  }
}

export type DragSource =
  | { kind: 'inventorySlot'; slotIndex: number; itemId: ItemId }
  | { kind: 'equipmentSlot'; characterId: CharacterId; slot: EquipmentSlot; itemId: ItemId }
  | { kind: 'floorItem'; itemId: ItemId }

export type DragPayload = {
  itemId: ItemId
  source: DragSource
}

export type DragTarget =
  | { kind: 'inventorySlot'; slotIndex: number }
  | { kind: 'floorDrop'; dropPos?: Vec2 }
  | { kind: 'floorItem'; itemId: ItemId }
  | { kind: 'portrait'; characterId: CharacterId; target: PortraitDropTarget }
  | { kind: 'poi'; poiId: Id }
  | { kind: 'npc'; npcId: Id }
  | { kind: 'equipmentSlot'; characterId: CharacterId; slot: EquipmentSlot }

