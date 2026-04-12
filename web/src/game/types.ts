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
/** Procgen / combat: floor NPC boss variant (same `NpcKind`, scaled rules). */
export type NpcVariant = 'boss'
export type NpcKind =
  | 'Wurglepup'
  | 'Bobr'
  | 'Skeleton'
  | 'Catoctopus'
  | 'Swarm'
  | 'Chumbo'
  | 'Grub'
  | 'SporeGrub'
  | 'SunGrub'
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

/**
 * F2 / `debug-settings.json`: **Elder** procedural **3D** billboard shader (`elderDistortionBillboard.ts`).
 * All fields are unitless shader parameters except **`billboardAspect`** (quad width / height, like NPC texture aspect).
 */
export type ElderDistortionTuning = {
  billboardAspect: number
  timeScale: number
  ellipseRx: number
  ellipseRy: number
  bodyEdgeStart: number
  bodyEdgeEnd: number
  noiseUvScale: number
  noiseTimeSpeed: number
  warpSinAmp: number
  warpCosAmp: number
  warpNoiseAmp: number
  warpPhaseX: number
  warpFreqY: number
  warpPhaseY: number
  warpFreqX: number
  sweepPhase: number
  sweepFreqY: number
  sweepFreqX: number
  pulsePhase: number
  pulseRadialFreq: number
  iridPhase: number
  iridFreqX: number
  baseTintMin: number
  baseTintBodyMul: number
  shimmerLow: number
  shimmerSweepMul: number
  shimmerPulseBase: number
  shimmerPulseAmp: number
  alphaEdgeStart: number
  alphaEdgeEnd: number
  alphaBase: number
  alphaBodyMul: number
  alphaSweepMul: number
  alphaMax: number
}

export type EquipmentSlot =
  | 'head'
  | 'handLeft'
  | 'handRight'
  | 'feet'
  | 'clothing'
  | 'accessory'

export type PortraitDropTarget = 'eyes' | 'mouth' | 'hat' | 'hands' | 'body'

/** Bandage decal on portrait art (normalized to `.portrait` frame). Omit `untilMs` for persistent (whole run). */
export type PortraitBandageDecal = {
  id: Id
  characterId: CharacterId
  u: number
  v: number
  rotateDeg: number
  /** When set and passed, pruned in `time/tick` (legacy timed decals only). */
  untilMs?: number
}

export type Tile =
  | 'wall'
  | 'floor'
  | 'door'
  | 'lockedDoor'
  | 'doorOctopus'
  | 'lockedDoorOctopus'
  /** Passable like `floor`; keeps open-door billboard in 3D. */
  | 'doorOpen'
  | 'doorOpenOctopus'

export type PoiKind =
  | 'Well'
  | 'Chest'
  | 'Barrel'
  | 'Crate'
  | 'Bed'
  | 'Shrine'
  | 'CrackedWall'
  | 'Exit'
  | 'Campfire'
  | 'KuratkoNest'

export type FloorPoi = {
  id: Id
  kind: PoiKind
  pos: Vec2
  /** Chest/Barrel/Crate/Shrine; Bed uses one-time rest then stays interactable with “Already used.” */
  opened?: boolean
  /** Well only: no water VFX; base sprite switches to drained art after a successful fill. */
  drained?: boolean
  /** Campfire: successful cooks decrement; at 0 the POI is removed. */
  cookUsesLeft?: number
  /** KuratkoNest: eggs remaining; at 0 the nest is `opened` (empty nest emoji). */
  eggsLeft?: number
}

export type InventoryItem = {
  id: ItemId
  defId: ItemDefId
  qty: number
  /** Remaining durability when `ItemDef.durabilityMax` is set (typically `qty === 1`). */
  durability?: number
  /**
   * **Glowbug jar only**: how many glowbugs are in the jar (1–12). Omitted means 1 (legacy saves).
   * Kept separate from `qty` so Shrine `consumeOffering` removes the whole jar, not one “stack unit”.
   */
  glowbugs?: number
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

/** Optional additive weapon scaling: `floor(stat × 0.25)` in `computePcAttackDamage`. */
export type WeaponDamageStat = 'strength' | 'agility' | 'intelligence'

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
  /** Hub tent replacement: deterministic portrait hue (0..359); unset for starters. */
  tentReplacementPortraitHueDeg?: number
  /**
   * Hub tent replacement: CSS `saturate()` multiplier for the alive portrait chain (see `tentReplacementPortraitTint.ts`).
   * Unset on legacy saves → UI falls back to the pre-range default (1.65).
   */
  tentReplacementPortraitSaturateMult?: number
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

export type PortraitToastKind = 'statDelta' | 'lowStat' | 'status'

export type PortraitToast = {
  id: Id
  characterId: CharacterId
  kind: PortraitToastKind
  text: string
  /**
   * Wall clock when pushed (same basis as `state.nowMs` / `performance.now()`).
   * Optional for legacy rows; UI falls back to `untilMs − portraitToastTtlMs`.
   */
  startedAtMs?: number
  untilMs: number
}

export type UiScreen = 'title' | 'hub' | 'game'

/** Normalized rect (0–1) for hub click regions inside the game viewport. */
export type HubNormRect = { x: number; y: number; w: number; h: number }

export type HubHotspotConfig = {
  village: { tavern: HubNormRect; cave: HubNormRect; tent: HubNormRect }
  /** `innkeeper` frames the bartender sprite; `innkeeperTrade` opens trade. Leave tavern via **`HubViewport`** **Leave tavern** button (not a hotspot). */
  tavern: { innkeeper: HubNormRect; innkeeperTrade: HubNormRect }
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
  /** Hub/camp innkeeper trade: last mojibake line for the bottom speech strip. */
  hubInnkeeperSpeech?: string
  /** Auto-hide delay for `hubInnkeeperSpeech` (ms). Default **2000** when unset; **4000** for the opening welcome line. */
  hubInnkeeperSpeechTtlMs?: number
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
  sfxQueue?: Array<{ id: Id; kind: 'ui' | 'hit' | 'swing' | 'reject' | 'pickup' | 'munch' | 'step' | 'bump' | 'nav' | 'bones' | 'well' | 'deep_gnome' }>
  /**
   * Optional short-lived door-open sprite overlay (3D viewport). Open doors normally use tiles
   * **`doorOpen`** / **`doorOpenOctopus`** with a persistent mesh billboard instead.
   */
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
  /** Floating lines above a portrait (stat deltas, low vitals, status changes); pruned in `time/tick`. */
  portraitToasts?: PortraitToast[]
  /** 🩹 decals after applying a bandage strip (persistent for the run unless `untilMs` set). */
  portraitBandageDecals?: PortraitBandageDecal[]
  /** Per character: `nowMs` must exceed this before another portrait “rest” tap converts hunger/thirst → stamina. */
  portraitRestCooldownUntil?: Partial<Record<CharacterId, number>>
  /** Per character: suppress duplicate low-vital portrait toasts until this time. */
  vitalLowWarnUntil?: Partial<Record<CharacterId, number>>
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
    preserveA?: boolean
    preserveB?: boolean
  }
  /** Discovered crafting recipes (order-sensitive). */
  knownRecipes?: Record<string, true>
  /**
   * While set and `nowMs < bobrIntroUntilMs`, a full-screen Bobr intro is drawn above the presenter
   * (`run/new` with **`playBobrIntro`** from the title **Start** path); hub runs underneath (**ADR-0328**).
   */
  bobrIntroUntilMs?: number
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

/** GPU quality preset; `custom` when tier-owned render fields were changed manually. */
export type GpuTier = 'low' | 'balanced' | 'high' | 'custom'

export type RenderTuning = {
  /** Global scalar for 3D scene brightness (lights + theme tint on lantern; billboards use lit materials + emissive lift). */
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
  /** Primary `PointLight` when no party member has equipped `playerLight` (still × theme `lanternIntensityMult`). */
  bareLightIntensity: number
  bareLightDistance: number
  /** Per equipped torch instance (hands/head); party contributions **sum** (not POI torches; those use `torchIntensity`). */
  heldTorchIntensity: number
  heldTorchDistance: number
  /** Per equipped lantern instance; party contributions **sum**. */
  equippedLanternIntensity: number
  equippedLanternDistance: number
  /** Per equipped headlamp instance; party contributions **sum**. */
  headlampIntensity: number
  headlampDistance: number
  /** Per glowbug row: raw Glowbug ×1, jar × clamped `glowbugs`; party contributions **sum**. */
  glowbugIntensity: number
  glowbugDistance: number
  /** Upper bound on primary equipped light intensity after party sum × `globalIntensity` × flicker (not applied to bare light). */
  equippedLightIntensityCap: number
  /**
   * Primary `playerLight` position tweak: **headlamp** — camera-local forward (−Z) / up; **other kinds** — world XZ
   * forward along **game yaw** from the player cell, and **world Y** as `view.camPos.y + this` (not camera pitch).
   */
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
  /**
   * Max world PointLights for dropped items with `playerLight` (nearest to player by Manhattan grid distance).
   * 0 disables. No shadows.
   */
  playerLightFloorItemMax: number
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
   * Per **equippable hat** def: portrait hat-band height as **%** of the portrait frame (overrides CSS default **16%** when set).
   * F2 **Portrait** section + **`debug-settings.json`**; keys restricted to defs with **`hat`** + **`head`** in content.
   */
  portraitHatSlotHeightPctByDefId: Partial<Record<ItemDefId, number>>
  /**
   * Per **equippable hat** def: additive horizontal offset as **%** of portrait **width** for the hat band (**`calc(8% + offset)`**; **0** = CSS default).
   */
  portraitHatOffsetXPctByDefId: Partial<Record<ItemDefId, number>>
  /**
   * Per **equippable hat** def: vertical offset as **%** of portrait **height** for the hat band (**0** = CSS default **top: 0**).
   */
  portraitHatOffsetYPctByDefId: Partial<Record<ItemDefId, number>>

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
  /**
   * **Lambert** NPC billboards: multiplies **`emissiveIntensity`** and **`color`** (albedo × lights) each frame; **Elder**: procedural **RGB** only.
   * F2 **NPCs** + **`debug-settings.json`**; clamped like **`poiSpriteBoost`** (**1** = unchanged).
   */
  npcSpriteBoost: number
  /** POI Well billboard ground pivot (same units as `npcBillboard.*.groundY`). */
  poiGroundY_Well: number
  /**
   * Filled **Well** only: additive world-space offset for the **glow** `Sprite` vs the main well billboard pivot (same axes as **`door*SpriteNudge*`** / **`floorItemSpriteNudge*`**).
   * F2 **NPCs** + **`debug-settings.json`**. Clamped **−1..0.5** world units (**Y** / **Z** nudges stay **±0.5**).
   */
  poiWellGlowNudgeX: number
  poiWellGlowNudgeY: number
  poiWellGlowNudgeZ: number
  /**
   * Filled **Well** only: additive world-space offset for the **sparkle** `Sprite` vs the main well billboard pivot.
   * Default **`poiWellSparkleNudgeY`** **0.02** preserves the legacy vertical lift vs glow.
   * **X** clamped **−1..0.5**; **Y** / **Z** **±0.5**.
   */
  poiWellSparkleNudgeX: number
  poiWellSparkleNudgeY: number
  poiWellSparkleNudgeZ: number
  /** POI Chest closed/open billboard ground pivot (`chest_*.png` sit low in frame). */
  poiGroundY_Chest: number
  /** POI Barrel billboard ground pivot (same units as `npcBillboard.*.groundY`). */
  poiGroundY_Barrel: number
  /** POI Crate billboard ground pivot. */
  poiGroundY_Crate: number
  /** POI Bed billboard ground pivot. */
  poiGroundY_Bed: number
  /** POI Shrine billboard ground pivot. */
  poiGroundY_Shrine: number
  /** POI CrackedWall billboard ground pivot. */
  poiGroundY_CrackedWall: number
  /** POI Exit billboard ground pivot. */
  poiGroundY_Exit: number
  /** POI Campfire billboard ground pivot (player-placed). */
  poiGroundY_Campfire: number
  /** POI KuratkoNest billboard ground pivot. */
  poiGroundY_KuratkoNest: number
  /**
   * Multiplies **Campfire** (**🔥**) emoji POI billboard height vs the default **0.55** world-unit POI base (**1** = same as other non-Exit POIs).
   * F2 **Viewport** + **`debug-settings.json`**.
   */
  poiCampfireSpriteScale: number
  /**
   * Multiplies **Kuratko nest** emoji POI billboard height vs the default **0.55** world-unit POI base (**1** = same as other non-Exit POIs).
   * F2 **Viewport** + **`debug-settings.json`**.
   */
  poiKuratkoNestSpriteScale: number
  /**
   * **Lambert** POI billboards: multiplies **`emissiveIntensity`** and **`color`** (albedo × lights) each frame (**1** = unchanged).
   * Filled **Well** **glow** / **sparkle** **`SpriteMaterial.color`** uses the same multiplier so POI brightness tuning matches the NPC boost “whole prop” read.
   */
  poiSpriteBoost: number
  /**
   * World-space Y offset for the POI ground contact point (sprite bottom pivot).
   * Independent of `npcFootLift`; use F2 to nudge POIs vs the floor without moving NPCs.
   */
  poiFootLift: number
  /** Hub tavern 2D innkeeper/bartender sprite visual scale (1 = default). Does not resize hub hotspot rects. */
  hubInnkeeperSpriteScale: number
  /**
   * Door billboards — **wooden** (`door` / `lockedDoor` / `doorOpen`): height in world units;
   * width = height × texture aspect. F2 debug; persisted in `debug-settings.json`.
   */
  doorWoodenSpriteHeight: number
  /** World Y of the wooden door sprite center (pivot). */
  doorWoodenSpriteCenterY: number
  /** Additive world X offset on the cell center (wooden doors). */
  doorWoodenSpriteNudgeX: number
  /** Additive world Z offset on the cell center (wooden doors). */
  doorWoodenSpriteNudgeZ: number
  /**
   * Door billboards — **octopus** (`doorOctopus` / `lockedDoorOctopus` / `doorOpenOctopus`):
   * same units as wooden; tune separately when art frames differ.
   */
  doorOctopusSpriteHeight: number
  doorOctopusSpriteCenterY: number
  doorOctopusSpriteNudgeX: number
  doorOctopusSpriteNudgeZ: number
  /**
   * Dropped **floor-item** billboards in the 3D view: height in world units;
   * width = height × texture aspect (emoji icons use a square canvas). F2 debug; `debug-settings.json`.
   */
  floorItemSpriteHeight: number
  /** Additive world **X** offset on the item’s cell+jitter position (floor pickup billboards). F2; `debug-settings.json`. */
  floorItemSpriteNudgeX: number
  /** Additive world **Y** offset on the sprite pivot (added to the baked center height). F2; `debug-settings.json`. */
  floorItemSpriteNudgeY: number
  /** Additive world **Z** offset on the item’s cell+jitter position. F2; `debug-settings.json`. */
  floorItemSpriteNudgeZ: number
  /** Dungeon floors per segment before a camp hub (1–99; default 10). */
  campEveryFloors: number
  /**
   * Procgen NPC count per floor: uniform integer in **[npcSpawnCountMin, npcSpawnCountMax]** (inclusive).
   * Persisted in F2 / `debug-settings.json`; takes effect on **Regen** / **Descend** / new floor gen.
   */
  npcSpawnCountMin: number
  npcSpawnCountMax: number
  /**
   * Encounter roster: non-primary hostiles must be within this Chebyshev distance of the player.
   * The NPC that triggered combat always joins (when `hostileJoinsEncounter` allows).
   * F2 / `debug-settings.json`; default 5.
   */
  combatEncounterJoinChebyshevMax: number

  /** Integer STA a character pays on a step when their personal move tick fires (see `staminaMovePacing.ts`). */
  staminaCostStep: number
  /**
   * Base N for step pacing: per living PC, effective N scales with `stats.endurance` (see `staminaMovePacing.ts`).
   * Floor-scoped counters in `floor.staminaStepPaceByChar`.
   */
  staminaCostStepEveryN: number
  /**
   * Multiplies **`staminaCostStep`** when a step pacing tick fires (F2 / **`debug-settings.json`**; default **1**).
   * Charged amount is **`round(staminaCostStep × this)`**, clamped **0..150**. **Strafe** ignores this.
   */
  staminaDrainStepMultiplier: number
  /** Integer STA a character pays on a strafe when their personal strafe tick fires. */
  staminaCostStrafe: number
  /**
   * Base N for strafe pacing: per living PC, effective N scales with `stats.endurance`.
   * Floor-scoped counters in `floor.staminaStrafePaceByChar`.
   */
  staminaCostStrafeEveryN: number
  /** Party stamina per successful in-place turn (0 allowed). */
  staminaCostTurn: number
  /** Party stamina on successful floor pickup. */
  staminaCostPickup: number
  /** Party stamina when a POI use changes state (not no-op). */
  staminaCostPoiUse: number
  /** Party stamina when a door opens (unlocked or key use). */
  staminaCostDoorOpen: number
  /** Stamina when crafting starts from inventory (one payer: best recipe.skill among affordable; see pickCraftStaminaPayer). */
  staminaCostCraft: number
  /** Single character stamina for inspect (eyes drop). */
  staminaCostInspect: number
  /**
   * Multiplies each recipe’s **`craftMs`** when a craft starts (F2; default **1**).
   * **0** = instant finish on the next eligible tick; values above **1** lengthen the bar.
   */
  craftDurationScale: number

  /** 0/1: lose durability on weapon hits and tool uses (door splinter, Kuratko nest). */
  itemDurabilityEnabled: number
  /** Durability lost per door splinter / Kuratko nest tool use (0–50). */
  itemDurabilityToolUseCost: number
  /** Durability lost per successful PC weapon hit (0–50; 0 = no loss while enabled). */
  itemDurabilityWeaponHitCost: number

  /** Stamina gained from one portrait “rest” tap (clamped to max). */
  portraitRestStaminaGain: number
  /** Hunger spent per rest tap (fixed bundle). */
  portraitRestHungerCost: number
  /** Thirst spent per rest tap. */
  portraitRestThirstCost: number
  /** Minimum ms between rest taps per character. */
  portraitRestCooldownMs: number
  /** Default lifetime for portrait toast lines (ms); how long each line stays eligible before tick prune. */
  portraitToastTtlMs: number
  /** Font size (px) for portrait floating toasts; matches activity-log voice when aligned to defaults. */
  portraitToastFontPx: number
  /** Float/fade animation duration (ms) for each portrait toast; lower = snappier. */
  portraitToastAnimMs: number
  /** Vertical travel (px) while a toast floats up; higher = faster drift for a given duration. */
  portraitToastFloatPx: number
  /** Horizontal offset (px) of the toast stack from portrait-center; positive shifts right. */
  portraitToastOffsetXPx: number
  /** Gap (px) between the portrait frame top and the bottom of the toast stack; negative overlaps the frame (debug). */
  portraitToastGapPx: number
  /** Warn when stamina/max is below this fraction (0–1). */
  lowStaminaWarnFrac: number
  lowHungerWarnFrac: number
  lowThirstWarnFrac: number
  /** Min ms between low-vital portrait toasts per character. */
  lowVitalWarnCooldownMs: number

  /** Elder NPC procedural mesh billboard; F2 **NPCs** → **Elder 3D shader**. */
  elderDistortion: ElderDistortionTuning
  /**
   * Elder procedural shader detail: **0** = simple (fewer ALU), **1** = reduced, **2** = full.
   * Set from **GPU tier** presets; F2 **render** slider or `render/set` overrides force **custom** tier when changed.
   */
  elderShaderQuality: number

  /** Player/debug GPU preset; `custom` when shadow, DPR cap, or dither tier knobs diverge via sliders. */
  gpuTier: GpuTier
  /**
   * Upper bound for `devicePixelRatio` (after visualViewport scale compensation) for the presenter canvas,
   * world offscreen render target, and HUD html2canvas capture. Clamped to 1..1.5 in `clampRenderTuning`.
   */
  pixelRatioCap: number
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
  lastAction?: { actorKind: 'pc' | 'npc'; actorId: Id; action: 'attack' | 'defend' | 'flee' | 'skip'; atMs: number }
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
    /** Successful hub innkeeper barters (offer + request) this run; drives MBA activity-log lines. */
    hubInnkeeperTradesCompleted?: number
    /** Count of heroes recruited via village/camp Tent (deterministic variety). */
    tentRecruitsCompleted?: number
    /** F2 debug: bumped by `debug/regenerateTentPortraitHues` to re-roll tent portrait hue + saturation. */
    debugTentPortraitHueRevision?: number
    /** F2 debug: bumped by `debug/replaceAllPartyWithTentTemplates` so hashes re-roll each click. */
    debugReplaceAllPartyRevision?: number
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
    /**
     * Per living PC: 0..N−1 for step stamina pacing (`staminaCostStepEveryN` × endurance); reset when the floor is replaced.
     */
    staminaStepPaceByChar?: Partial<Record<CharacterId, number>>
    /**
     * Per living PC: 0..N−1 for strafe stamina pacing; reset when the floor is replaced.
     */
    staminaStrafePaceByChar?: Partial<Record<CharacterId, number>>
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
      variant?: NpcVariant
      /** Content row id in `npcBosses` (stable per boss definition). */
      bossTraitId?: string
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
  /** Open passable door tile (`doorOpen` / `doorOpenOctopus`): drag a breaking tool/weapon onto the billboard. */
  | { kind: 'openDoor'; x: number; y: number }
  | { kind: 'equipmentSlot'; characterId: CharacterId; slot: EquipmentSlot }
  /** Portrait-only: drop with no valid target stows to first free inventory slot (via unequip). */
  | { kind: 'stowEquipped' }
  | { kind: 'tradeOfferSlot' }
  /** Merchant “their stock” cell in `TradeModal` (hover tooltip only; not a drop target). */
  | { kind: 'tradeStockSlot'; stockIndex: number }
  /** Hub tavern: click region that opens innkeeper trade (`HubViewport` trade `HotspotBox`). */
  | { kind: 'hubInnkeeperTrade' }

