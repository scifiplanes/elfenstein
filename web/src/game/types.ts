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

export type UiState = {
  debugOpen: boolean
  paperdollFor?: CharacterId
  npcDialogFor?: Id
  toast?: { id: Id; text: string; untilMs: number }
  shake?: { untilMs: number; magnitude: number; startedAtMs: number }
  sfxQueue?: Array<{ id: Id; kind: 'ui' | 'hit' | 'reject' | 'pickup' | 'munch' | 'step' | 'bump' }>
  /** Short-lived portrait “mouth visible” interaction cue. */
  portraitMouth?: { characterId: CharacterId; startedAtMs: number; untilMs: number }
  /** Short-lived portrait frame shake (inspect/feed resolution). */
  portraitShake?: { characterId: CharacterId; untilMs: number; magnitude: number; startedAtMs: number }
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
  fogDensity: number
  /** First-person eye height in world units (matches camera Y on flat floor). */
  camEyeHeight: number
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
   * Applies to 3D camera, HUD overlay, and portrait CSS shake.
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
  /** Min time (ms) between Igor portrait idle flashes; actual gap is uniform up to max. */
  portraitIdleGapMinMs: number
  /** Max time (ms) between idle flashes (inclusive upper bound of uniform range with min). */
  portraitIdleGapMaxMs: number
  /** Min visible duration (ms) of one idle flash. */
  portraitIdleFlashMinMs: number
  /** Max visible duration (ms) of one idle flash. */
  portraitIdleFlashMaxMs: number
}

export type AudioTuning = {
  masterSfx: number
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
    w: number
    h: number
    tiles: Tile[]
    pois: FloorPoi[]
    itemsOnFloor: Array<{ id: ItemId; pos: Vec2 }>
    npcs: Array<{
      id: Id
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

export type DragPayload = {
  itemId: ItemId
  source: DragSource
}

export type DragTarget =
  | { kind: 'inventorySlot'; slotIndex: number }
  | { kind: 'floorDrop' }
  | { kind: 'floorItem'; itemId: ItemId }
  | { kind: 'portrait'; characterId: CharacterId; target: PortraitDropTarget }
  | { kind: 'poi'; poiId: Id }
  | { kind: 'npc'; npcId: Id }
  | { kind: 'equipmentSlot'; characterId: CharacterId; slot: EquipmentSlot }

