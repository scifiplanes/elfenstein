import type { AudioTuning, RenderTuning } from './types'
import { DEFAULT_NPC_BILLBOARD } from './npcBillboardTuning'

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
  heldTorchIntensity: 1.0,
  heldTorchDistance: 6,
  equippedLanternIntensity: 4.0,
  equippedLanternDistance: 24,
  headlampIntensity: 4.0,
  headlampDistance: 24,
  glowbugIntensity: 0.45,
  glowbugDistance: 4,
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

  // NPC billboard sizing (height in world units; width derived from texture aspect).
  // Defaults chosen to roughly match the prior hardcoded 0.65 scale used for all NPCs.
  npcFootLift: 0.02,
  npcBillboard: DEFAULT_NPC_BILLBOARD,
  poiGroundY_Well: 0.0,
  /** ~opaque bottom of `chest_closed.png` / `chest_open.png` (~3% from texture bottom). */
  poiGroundY_Chest: 0.04,
  poiSpriteBoost: 1.5,
  poiFootLift: 0.02,
  hubInnkeeperSpriteScale: 1,
  campEveryFloors: 10,
}

/** Copy only keys present in `DEFAULT_RENDER` so `debug-settings.json` always includes the full schema (e.g. per-mode camera lights) and drops stale fields. */
export function pickRenderTuningForPersistence(render: RenderTuning): RenderTuning {
  const out = {} as RenderTuning
  for (const key of Object.keys(DEFAULT_RENDER) as (keyof RenderTuning)[]) {
    out[key] = render[key]
  }
  return out
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
