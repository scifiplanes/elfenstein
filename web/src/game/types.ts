export type Id = string

export type Vec2 = { x: number; y: number }

export type ItemId = Id
export type ItemDefId = Id
export type CharacterId = Id

export type Species = 'Igor' | 'Mycyclops' | 'Frosch' | 'Afonso'
export type SkillId = 'weaving' | 'chipping' | 'cooking' | 'foraging'
export type DamageType = 'Blunt' | 'Pierce' | 'Cut' | 'Fire' | 'Water' | 'Thunder' | 'Earth'
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
  | 'NanoTagged'
  | 'Spored'
  | 'Parasitized'
export type NpcLanguage = 'DeepGnome' | 'Zalgo' | 'Mojibake'
export type NpcKind =
  | 'Wurglepup'
  | 'Bobr'
  | 'Skeleton'
  | 'Catoctopus'
  | 'Swarm'
  | 'Chumbo'
  | 'Grub'
  | 'Kuratko'
  | 'Grechka'
  | 'Snailord'
  | 'Bulba'
  | 'Elder'
  | 'Kerekere'
  | 'Bok'
  | 'RegularBok'
  | 'BigHands'
  | 'Gargantula'

/** Per-kind NPC sprite billboard pivot and height (F2-tunable). */
export type NpcBillboardRow = { groundY: number; size: number; sizeRand: number }
export type NpcBillboardByKind = Record<NpcKind, NpcBillboardRow>

export type EquipmentSlot =
  | 'head'
  | 'handLeft'
  | 'handRight'
  | 'feet'
  | 'clothing'
  | 'accessory'

export type PortraitDropTarget = 'eyes' | 'mouth' | 'hat' | 'hands'

export type Tile = 'wall' | 'floor' | 'door' | 'lockedDoor' | 'doorOctopus' | 'lockedDoorOctopus'

export type PoiKind = 'Well' | 'Chest' | 'Barrel' | 'Crate' | 'Bed' | 'Shrine' | 'CrackedWall' | 'Exit'

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

export type CharacterStats = {
  strength: number
  agility: number
  speed: number
  perception: number
  endurance: number
  intelligence: number
  wisdom: number
  luck: number
}

/** 0..1 multiplier reduction by damage type (e.g. 0.2 = 20% reduced). */
export type Resistances = Partial<Record<DamageType, number>>

export type Character = {
  id: CharacterId
  name: string
  species: Species
  endurance: number
  stats: CharacterStats
  /** Flat damage mitigation (MVP; refined later). */
  armor: number
  resistances: Resistances
  skills: Partial<Record<SkillId, number>>
  hunger: number
  thirst: number
  hp: number
  stamina: number
  statuses: Array<{ id: StatusEffectId; untilMs?: number }>
  equipment: Partial<Record<EquipmentSlot, ItemId>>
}

export type ProcgenDebugOverlayMode = 'districts' | 'roomTags' | 'mission'

/** F2 room-property telegraph override (compositor tint). */
export type RoomTelegraphMode =
  | 'auto'
  | 'off'
  | 'Burning'
  | 'Flooded'
  | 'Infected'
  | 'SporeMist'
  | 'NanoHaze'
  | 'Unstable'
  | 'Haunted'
  | 'RoyalMiasma'

export type UiScreen = 'title' | 'hub' | 'game'

/** Normalized rect (0–1) for hub click regions inside the game viewport. */
export type HubNormRect = { x: number; y: number; w: number; h: number }

export type HubHotspotConfig = {
  village: { tavern: HubNormRect; cave: HubNormRect }
  tavern: { innkeeper: HubNormRect; exit: HubNormRect }
}

/** Merchant row: remaining quantity (hub persists in `run.hubInnkeeperTradeStock`; floor NPCs store under `npc.trade`). */
export type TradeStockRow = { defId: ItemDefId; qty: number }

export type NpcTrade = { stock: TradeStockRow[]; wants: ItemDefId[] }

export type TradeSession =
  | {
      kind: 'hub_innkeeper'
      offerItemId: ItemId | null
      askStockIndex: number | null
      stock: TradeStockRow[]
      wants: ItemDefId[]
    }
  | {
      kind: 'floor_npc'
      npcId: Id
      offerItemId: ItemId | null
      askStockIndex: number | null
    }

export type UiState = {
  screen: UiScreen
  /** Escape / pause: audio and run controls (blocks dungeon/hub input while open). */
  settingsOpen: boolean
  /** When `screen === 'hub'`, which bespoke 2D scene is shown. */
  hubScene?: 'village' | 'tavern'
  /** Mid-run rest hub after every `render.campEveryFloors` floors; uses camp art/trade. */
  hubKind?: 'camp'
  /** Active barter UI (tavern innkeeper or a trading floor NPC). */
  tradeSession?: TradeSession
  debugOpen: boolean
  /** F2-only: tint floor cells from `floor.gen` (dev visualization). */
  procgenDebugOverlay?: ProcgenDebugOverlayMode
  /** F2-only: override which bg ambient track plays (URL string). */
  debugBgTrack?: string
  /** F2-only: trigger a one-shot bg sfx play; seq increments on each trigger. */
  debugBgSfxTrigger?: { index: number; seq: number }
  /** F2 room telegraph: `auto` uses `roomProperties` under the player. */
  roomTelegraphMode: RoomTelegraphMode
  /** F2 room telegraph blend strength when a hazard tint is active (0–1). */
  roomTelegraphStrength: number
  /** Present when the entire party is dead; blocks gameplay until a new run starts. */
  death?: { atMs: number; runId: string; floorIndex: number; level: number }
  /** F2: show the death modal with current run stats without setting `death` (no gameplay lock). */
  debugShowDeathPopup?: boolean
  paperdollFor?: CharacterId
  npcDialogFor?: Id
  /** F2: show the NPC dialog using the first floor NPC when `npcDialogFor` is unset (UI tuning). */
  debugShowNpcDialogPopup?: boolean
  /** Persistent lines inside the game viewport activity log (newest last; capped). */
  activityLog?: Array<{ id: Id; text: string; atMs: number }>
  shake?: { untilMs: number; magnitude: number; startedAtMs: number }
  sfxQueue?: Array<{ id: Id; kind: 'ui' | 'hit' | 'swing' | 'reject' | 'pickup' | 'munch' | 'step' | 'bump' | 'nav' | 'bones' }>
  /** Short-lived sprite FX when opening a door (rendered in 3D viewport). */
  doorOpenFx?: Array<{
    id: Id
    pos: Vec2
    startedAtMs: number
    untilMs: number
    /** Octopus doors use a 3-frame opening strip; wooden uses `door_open.png`. */
    visual?: 'wooden' | 'octopus'
  }>
  /** Short-lived portrait “mouth visible” interaction cue. */
  portraitMouth?: { characterId: CharacterId; startedAtMs: number; untilMs: number }
  /** Short-lived portrait frame shake (inspect/feed resolution; NPC hit damage). */
  portraitShake?: { characterId: CharacterId; untilMs: number; magnitude: number; startedAtMs: number }
  /** Brief idle-overlay visibility after a portrait-frame tap (opens paperdoll). */
  portraitIdlePulse?: { characterId: CharacterId; untilMs: number }
  crafting?: {
    startedAtMs: number
    endsAtMs: number
    srcItemId: ItemId
    dstItemId: ItemId
    /** Destination inventory slot when crafting started from inventory drag/drop. */
    dstSlotIndex?: number
    resultDefId: ItemDefId
    /** Ingredient def ids (order-sensitive) for discovery messaging. */
    aDefId: ItemDefId
    bDefId: ItemDefId
    failDestroyChancePct: number
    recipeKey: string
    skill: SkillId
    dc: number
  }
  /** Discovered crafting recipes (order-sensitive). */
  knownRecipes?: Record<string, true>
}

export type CheckpointSnapshot = {
  /** Timestamp at save time (for summary/debug). */
  atMs: number
  run: GameState['run'] extends infer R ? Omit<Extract<R, object>, 'checkpoint'> : never
  floor: GameState['floor']
  party: GameState['party']
  view: GameState['view']
  /** Only the persistent UI bits we want to restore. */
  ui: Pick<UiState, 'screen' | 'debugOpen' | 'procgenDebugOverlay' | 'activityLog' | 'knownRecipes'>
}

export type RunCheckpoint = {
  kind: 'well'
  savedAtMs: number
  snapshot: CheckpointSnapshot
}

export type RenderTuning = {
  /** Global scalar for 3D scene brightness (lights + 3D sprites). */
  globalIntensity: number
  /** Per-theme hue shift (degrees) applied to 3D light/sprite tint. */
  themeHueShiftDeg_dungeon_warm: number
  themeHueShiftDeg_dungeon_cool: number
  themeHueShiftDeg_cave_damp: number
  themeHueShiftDeg_cave_deep: number
  themeHueShiftDeg_ruins_bleach: number
  themeHueShiftDeg_ruins_umber: number
  /** Per-theme saturation multiplier applied to 3D light/sprite tint. */
  themeSaturation_dungeon_warm: number
  themeSaturation_dungeon_cool: number
  themeSaturation_cave_damp: number
  themeSaturation_cave_deep: number
  themeSaturation_ruins_bleach: number
  themeSaturation_ruins_umber: number
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
  /** 0/1: lantern SpotLight may cast shadows when beam intensity is nonzero. */
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

  /** 0/1: enable micro-shake of the custom cursor on pointer down (debug). */
  cursorClickShakeEnabled: number
  /** Cursor click shake amplitude scalar (unitless; mapped to px/deg in `shakeTransform`). */
  cursorClickShakeMagnitude: number
  /** Cursor click shake envelope: hold at full strength (ms) before fade. */
  cursorClickShakeLengthMs: number
  /** Cursor click shake envelope: linear fade duration (ms) after hold. */
  cursorClickShakeDecayMs: number
  /** Cursor click shake oscillation frequency (Hz). */
  cursorClickShakeHz: number

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
   * Portrait shake envelope: hold at full strength (ms) before fade.
   * Used by `ui.portraitShake` (inspect/feed and NPC hit damage).
   */
  portraitShakeLengthMs: number
  /** Portrait shake linear fade duration (ms) after hold. */
  portraitShakeDecayMs: number
  /** Multiplies `ui.portraitShake.magnitude` (0..n, debug-tunable). */
  portraitShakeMagnitudeScale: number
  /** Portrait shake oscillation frequency (Hz). */
  portraitShakeHz: number

  /**
   * NPC billboard sizing (world units).
   * Size is interpreted as sprite HEIGHT; width is derived from the sprite texture aspect ratio.
   * Randomization is deterministic per-NPC id as ±% around the base size.
   */
  npcFootLift: number
  /**
   * NPC sprite “ground point” within the sprite’s height (in sprite-height units from the bottom).
   * 0.0 means use the bottom edge of the image rectangle (legacy).
   * Positive values move the sprite down (as if the feet are higher in the image);
   * negative values move the sprite up (as if the feet are lower than the image bottom).
   * Stored per `NpcKind` in `npcBillboard` (see `NpcBillboardRow`).
   */
  npcBillboard: NpcBillboardByKind
  /** POI Well billboard ground pivot (same units as `npcBillboard.*.groundY`). */
  poiGroundY_Well: number
  /** POI Chest closed/open billboard ground pivot (`chest_*.png` sit low in frame). */
  poiGroundY_Chest: number
  /** Multiplies PoI sprite material brightness (1.0 = unchanged). */
  poiSpriteBoost: number
  /**
   * World-space Y offset for the POI ground contact point (sprite bottom pivot).
   * Independent of `npcFootLift`; use F2 to nudge POIs vs the floor without moving NPCs.
   */
  poiFootLift: number
  /** Hub tavern 2D innkeeper/bartender sprite visual scale (1 = default). Does not change the hotspot rect. */
  hubInnkeeperSpriteScale: number
  /** Dungeon floors per segment before a camp hub (1–99; default 10). */
  campEveryFloors: number
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

export type CombatTurn = { kind: 'pc'; id: CharacterId; initiative: number } | { kind: 'npc'; id: Id; initiative: number }

export type CombatState = {
  encounterId: Id
  startedAtMs: number
  participants: { party: CharacterId[]; npcs: Id[] }
  turnQueue: CombatTurn[]
  turnIndex: number
  lastAction?: { actorKind: 'pc' | 'npc'; actorId: Id; action: 'attack' | 'defend' | 'flee'; atMs: number }
  /** Active until that PC's next turn begins (cleared in advanceTurnIndex). */
  pcDefense?: Partial<Record<CharacterId, { armorBonus: number; resistBonusPct: number }>>
  /**
   * Fireshield (and similar): extra Fire resist for a PC; `turnsRemaining` ticks down each time
   * that character's initiative comes up (see advanceTurnIndex).
   */
  pcFireshield?: Partial<Record<CharacterId, { fireResistBonusPct: number; turnsRemaining: number }>>
}

export type GameState = {
  nowMs: number
  ui: UiState
  render: RenderTuning
  audio: AudioTuning
  /** F2-tunable hit areas for hub 2D scenes (normalized to game viewport). */
  hubHotspots: HubHotspotConfig

  /** Roguelite run-scoped progression (XP/level/perks). */
  run: {
    /** Stable id for the current run instance. */
    runId: string
    startedAtMs: number
    xp: number
    level: number
    perkHistory: Array<{ level: number; perkId: string }>
    bonuses: {
      hpMaxBonus: number
      staminaMaxBonus: number
      /** Additive percent bonus, e.g. 0.1 = +10%. */
      damageBonusPct: number
    }
    checkpoint?: RunCheckpoint
    /** Remaining tavern innkeeper stock for this run (undefined = use content defaults on next open). */
    hubInnkeeperTradeStock?: TradeStockRow[]
  }

  combat?: CombatState

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
    /**
     * Monotonic revision bump when floor geometry/render-relevant entities change.
     * Used to avoid per-frame deep comparisons/serialization in the renderer.
     */
    floorGeomRevision: number
    npcs: Array<{
      id: Id
      kind: NpcKind
      name: string
      pos: Vec2
      status: 'hostile' | 'neutral' | 'friendly'
      hp: number
      /** Max HP at spawn; used for encounter HUD. Older saves may omit (hydrate fills from kind). */
      hpMax: number
      language: NpcLanguage
      quest?: { wants: ItemDefId; hated: ItemDefId[] }
      trade?: NpcTrade
      statuses: Array<{ id: StatusEffectId; untilMs?: number }>
    }>
    playerPos: Vec2
    playerDir: 0 | 1 | 2 | 3
    /**
     * Last procgen room id for which `applyRoomHazardOnEnter` already ran this visit.
     * Cleared when stepping into a cell with no `roomProperties`; re-applies after leaving and re-entering the same room.
     */
    roomHazardAppliedForRoomId?: string
  }

  party: {
    chars: Character[]
    inventory: InventoryGrid
    items: Record<ItemId, InventoryItem>
  }
}

export type DragSource =
  | { kind: 'inventorySlot'; slotIndex: number; itemId: ItemId }
  | {
      kind: 'equipmentSlot'
      characterId: CharacterId
      slot: EquipmentSlot
      itemId: ItemId
      /** Set when drag started from portrait equip icons (enables void-drop unequip). */
      fromPortrait?: boolean
    }
  | { kind: 'floorItem'; itemId: ItemId }
  /** Staged offer in the trade modal (`itemId` is the offered stack). */
  | { kind: 'tradeOffer'; itemId: ItemId }
  /** NPC merchant row in the trade modal (`stockIndex` into current stock list). */
  | { kind: 'tradeStockSlot'; stockIndex: number }

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
  /** Portrait-only: drop with no valid target stows to first free inventory slot (via unequip). */
  | { kind: 'stowEquipped' }
  | { kind: 'tradeOfferSlot' }
  | { kind: 'tradeAskSlot' }

