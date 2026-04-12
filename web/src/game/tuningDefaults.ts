import type { AudioTuning, RenderTuning } from './types'
import { DEFAULT_ELDER_DISTORTION } from './elderDistortionTuning'
import { DEFAULT_NPC_BILLBOARD } from './npcBillboardTuning'
import { DEFAULT_NPC_SPAWN_COUNT_MAX, DEFAULT_NPC_SPAWN_COUNT_MIN } from './npcSpawnTuning'

/** Baseline render/audio tuning when no `public/debug-settings.json` exists or keys are missing. */
export const DEFAULT_RENDER: RenderTuning = {
  globalIntensity: 1.0,
  themeHueShiftDeg_dungeon_warm: 0,
  themeHueShiftDeg_dungeon_cool: 0,
  themeHueShiftDeg_cave_damp: 0,
  themeHueShiftDeg_cave_deep: 0,
  themeHueShiftDeg_ruins_bleach: 0,
  themeHueShiftDeg_ruins_umber: 0,
  themeSaturation_dungeon_warm: 1.0,
  themeSaturation_dungeon_cool: 1.0,
  themeSaturation_cave_damp: 1.0,
  themeSaturation_cave_deep: 1.0,
  themeSaturation_ruins_bleach: 1.0,
  themeSaturation_ruins_umber: 1.0,
  baseEmissive: 0.02,
  bareLightIntensity: 4.0,
  bareLightDistance: 24,
  heldTorchIntensity: 6.5,
  heldTorchDistance: 12,
  equippedLanternIntensity: 12,
  equippedLanternDistance: 28,
  headlampIntensity: 15,
  headlampDistance: 32.94,
  glowbugIntensity: 1.1,
  glowbugDistance: 5,
  equippedLightIntensityCap: 120,
  lanternForwardOffset: 0.28,
  lanternVerticalOffset: -0.06,
  lanternFlickerAmp: 0.06,
  lanternFlickerHz: 2.0,
  lanternBeamIntensityScale: 0.0,
  lanternBeamDistanceScale: 1.0,
  lanternBeamAngleDeg: 22,
  lanternBeamPenumbra: 0.2,
  torchIntensity: 1.0,
  torchDistance: 6,
  shadowLanternPoint: 0,
  shadowLanternBeam: 1,
  shadowMapSize: 256,
  shadowFilter: 2,
  torchPoiLightMax: 3,
  playerLightFloorItemMax: 2,
  fogEnabled: 0,
  fogDensity: 0.0,
  camEyeHeight: 1.15,
  camForwardOffset: 0.0,
  camFov: 60,
  camPitchDeg: 0,
  camShakePosAmp: 0.02,
  camShakeRollDeg: 0.3,
  camShakeHz: 10,
  camShakeLengthMs: 0,
  camShakeDecayMs: 220,
  camShakeUiMix: 0.22,

  // Cursor micro-shake on pointer down (debug; tuned to be subtle by default).
  cursorClickShakeEnabled: 1,
  cursorClickShakeMagnitude: 0.12,
  cursorClickShakeLengthMs: 40,
  cursorClickShakeDecayMs: 80,
  cursorClickShakeHz: 14,

  ditherStrength: 0.55,
  ditherColourPreserve: 0.6,
  ditherPixelSize: 1,
  ditherLevels: 10,
  ditherMatrixSize: 4,
  ditherPalette: 4,
  ditherPalette0Mix: 1,
  postDitherLevels: 1.0,
  postDitherLift: 0.0,
  postDitherGamma: 1.0,
  dropAheadCells: 0.8,
  dropJitterRadius: 0.28,
  dropRangeCells: 5,
  portraitIdleGapMinMs: 8000,
  portraitIdleGapMaxMs: 18000,
  portraitIdleFlashMinMs: 70,
  portraitIdleFlashMaxMs: 220,
  portraitMouthFlickerHz: 18,
  portraitMouthFlickerAmount: 8,
  // Start by matching camera shake envelope so existing feel is unchanged until tuned.
  portraitShakeLengthMs: 0,
  portraitShakeDecayMs: 220,
  portraitShakeMagnitudeScale: 1.0,
  portraitShakeHz: 11,

  portraitHatOffsetXPctByDefId: {},
  portraitHatOffsetYPctByDefId: {},
  portraitHatSlotHeightPctByDefId: {},

  // NPC billboard sizing (height in world units; width derived from texture aspect).
  // Defaults chosen to roughly match the prior hardcoded 0.65 scale used for all NPCs.
  npcFootLift: 0.02,
  npcBillboard: DEFAULT_NPC_BILLBOARD,
  npcSpriteBoost: 1,
  poiGroundY_Well: 0.0,
  /** ~opaque bottom of `chest_closed.png` / `chest_open.png` (~3% from texture bottom). */
  poiGroundY_Chest: 0.04,
  poiGroundY_Barrel: 0,
  poiGroundY_Crate: 0,
  poiGroundY_Bed: 0,
  poiGroundY_Shrine: 0,
  poiGroundY_CrackedWall: 0,
  poiGroundY_Exit: 0,
  poiGroundY_Campfire: 0,
  poiGroundY_KuratkoNest: 0,
  poiCampfireSpriteScale: 1,
  poiKuratkoNestSpriteScale: 1,
  poiSpriteBoost: 1.5,
  poiWellGlowNudgeX: 0,
  poiWellGlowNudgeY: 0,
  poiWellGlowNudgeZ: 0,
  poiWellSparkleNudgeX: 0,
  poiWellSparkleNudgeY: 0.02,
  poiWellSparkleNudgeZ: 0,
  poiFootLift: 0.02,
  hubInnkeeperSpriteScale: 1,
  itemDurabilityEnabled: 1,
  itemDurabilityToolUseCost: 1,
  itemDurabilityWeaponHitCost: 1,
  doorWoodenSpriteHeight: 1,
  doorWoodenSpriteCenterY: 0.55,
  doorWoodenSpriteNudgeX: 0,
  doorWoodenSpriteNudgeZ: 0,
  doorOctopusSpriteHeight: 1,
  doorOctopusSpriteCenterY: 0.55,
  doorOctopusSpriteNudgeX: 0,
  doorOctopusSpriteNudgeZ: 0,
  /** Matches prior hardcoded `scale.y` on floor-item sprites. */
  floorItemSpriteHeight: 0.5,
  floorItemSpriteNudgeX: 0,
  floorItemSpriteNudgeY: 0,
  floorItemSpriteNudgeZ: 0,
  campEveryFloors: 10,
  /** Inclusive; procgen rolls uniform integer in [min, max]. Mean default (4+8)/2 = 6 (~2× old ~3). */
  npcSpawnCountMin: DEFAULT_NPC_SPAWN_COUNT_MIN,
  npcSpawnCountMax: DEFAULT_NPC_SPAWN_COUNT_MAX,
  combatEncounterJoinChebyshevMax: 5,

  staminaCostStep: 2,
  staminaCostStepEveryN: 1,
  staminaDrainStepMultiplier: 1,
  staminaCostStrafe: 2,
  staminaCostStrafeEveryN: 1,
  staminaCostTurn: 1,
  staminaCostPickup: 1,
  staminaCostPoiUse: 2,
  staminaCostDoorOpen: 2,
  staminaCostCraft: 1,
  staminaCostInspect: 1,
  craftDurationScale: 1,

  portraitRestStaminaGain: 6,
  portraitRestHungerCost: 4,
  portraitRestThirstCost: 4,
  portraitRestCooldownMs: 900,
  portraitToastTtlMs: 1600,
  portraitToastFontPx: 20,
  portraitToastAnimMs: 1450,
  portraitToastFloatPx: 36,
  portraitToastOffsetXPx: 0,
  portraitToastGapPx: 4,
  lowStaminaWarnFrac: 0.22,
  lowHungerWarnFrac: 0.25,
  lowThirstWarnFrac: 0.25,
  lowVitalWarnCooldownMs: 7000,

  vitalsHungerDrainPerStep: 0.12,
  vitalsThirstDrainPerStep: 0.16,
  vitalsHungerDrainPerTurn: 0.04,
  vitalsThirstDrainPerTurn: 0.05,
  vitalsDrainStaminaStepPenaltyStarving: 1,
  vitalsDrainStaminaStepPenaltyDehydrated: 1,
  vitalsDefensePenaltyStarving: 1,
  vitalsDefensePenaltyDehydrated: 1,

  elderDistortion: DEFAULT_ELDER_DISTORTION,
  elderShaderQuality: 2,

  gpuTier: 'high',
  pixelRatioCap: 1.5,
}

/**
 * Copy only keys present in `DEFAULT_RENDER` so `debug-settings.json` always includes the full schema
 * (e.g. per-mode camera lights, **npcSpawnCountMin** / **npcSpawnCountMax**) and drops stale fields.
 * Missing or nullish values on `render` fall back to `DEFAULT_RENDER` so the project file stays complete.
 */
export function pickRenderTuningForPersistence(render: RenderTuning): RenderTuning {
  const out = {} as Record<keyof RenderTuning, RenderTuning[keyof RenderTuning]>
  for (const key of Object.keys(DEFAULT_RENDER) as (keyof RenderTuning)[]) {
    const v = render[key]
    out[key] = (v ?? DEFAULT_RENDER[key]) as RenderTuning[typeof key]
  }
  return out as RenderTuning
}

export const DEFAULT_AUDIO: AudioTuning = {
  masterSfx: 0.6,
  masterMusic: 0.4,
  distanceMaxCells: 7,
  volumeNear: 0.06,
  volumeFar: 0.0,
  lowpassNearHz: 2400,
  lowpassFarHz: 260,
  munchVol: 1.0,
  munchCutoffHz: 900,
  munchCutoffEndHz: 420,
  munchHighpassHz: 176,
  munchHighpassQ: 0.707,
  munchLowpassQ: 0.8,
  munchDurSec: 0.18,
  munchThumpHz: 90,
  munchTremDepth: 0.35,
  munchTremHz: 18,
}

/** Same idea as `pickRenderTuningForPersistence` for the audio block in `debug-settings.json`. */
export function pickAudioTuningForPersistence(audio: AudioTuning): AudioTuning {
  const out = {} as AudioTuning
  for (const key of Object.keys(DEFAULT_AUDIO) as (keyof AudioTuning)[]) {
    out[key] = audio[key]
  }
  return out
}
