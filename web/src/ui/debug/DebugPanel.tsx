import { type Dispatch, useMemo, useState } from 'react'
import type { Action } from '../../game/reducer'
import { DEFAULT_ITEMS } from '../../game/content/items'
import type {
  GameState,
  HubNormRect,
  ItemDefId,
  NpcKind,
  PoiKind,
  ProcgenDebugOverlayMode,
} from '../../game/types'
import {
  buildDebugUiPersist,
  clearLocalDebugSettings,
  saveDebugSettingsToProject,
} from '../../app/debugSettingsPersistence'
import { useCursor } from '../cursor/useCursor'
import type { FloorProperty } from '../../procgen/types'
import { PROCgen_ALL_NPC_KINDS } from '../../procgen/spawnTables'
import { getThemeLightIntent } from '../../world/themeTuning'
import { BG_NOISE_LABELS, BG_NOISE_TRACKS, BG_SFX_TRACKS } from '../audio/musicTracks'
import { selectBgTrack } from '../audio/musicRules'
import styles from './DebugPanel.module.css'

const TAU = Math.PI * 2

function wrapPi(a: number) {
  const r = ((a + Math.PI) % TAU + TAU) % TAU // [0, 2π)
  return r - Math.PI // (-π, π]
}

function canonicalYawForDir(dir: 0 | 1 | 2 | 3) {
  return wrapPi((dir * Math.PI) / 2)
}

function deg(a: number) {
  return (a * 180) / Math.PI
}

type Slider = {
  key: string
  label: string
  min: number
  max: number
  step: number
  format?: (v: number) => string
}

export function DebugPanel(props: { state: GameState; dispatch: Dispatch<Action> }) {
  const { state, dispatch } = props
  const [query, setQuery] = useState('')
  const cursor = useCursor()
  const [dumpTick, setDumpTick] = useState(0)
  const [floorIndexDraft, setFloorIndexDraft] = useState<string>(String(state.floor.floorIndex))
  const [spawnNpcKind, setSpawnNpcKind] = useState<NpcKind>('Skeleton')
  const [spawnPoiKind, setSpawnPoiKind] = useState<PoiKind>('Chest')
  const [spawnItemDefId, setSpawnItemDefId] = useState<ItemDefId>(() => DEFAULT_ITEMS[0]!.id)
  const itemDefsSpawnSorted = useMemo(
    () => [...DEFAULT_ITEMS].sort((a, b) => a.id.localeCompare(b.id)),
    [],
  )
  const [perfOpen, setPerfOpen] = useState(false)

  const floorPropertyOrder: FloorProperty[] = ['Infested', 'Cursed', 'Destroyed', 'Overgrown']

  const dumpFloorGen = () => {
    const gen = state.floor.gen
    if (!gen) {
      dispatch({ type: 'ui/toast', text: 'No floor.gen to dump yet. Click Regen first.', ms: 1600 })
      return
    }
    try {
      const json = JSON.stringify(gen, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const safeSeed = gen.meta?.inputSeed ?? state.floor.seed
      const attempt = gen.meta?.attempt ?? 0
      a.href = url
      a.download = `elfenstein_floor_gen_seed_${safeSeed}_attempt_${attempt}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setDumpTick((t) => t + 1)
      dispatch({ type: 'ui/toast', text: 'Downloaded floor.gen JSON.', ms: 1200 })
    } catch {
      dispatch({ type: 'ui/toast', text: 'Failed to dump floor.gen JSON.', ms: 1600 })
    }
  }

  const newRun = () => {
    dispatch({ type: 'run/new' })
  }

  const cameraSliders: Array<Omit<Slider, 'key'> & { key: keyof GameState['render'] }> = useMemo(
    () => [
      { key: 'camEyeHeight', label: 'Eye height', min: 0.2, max: 2.2, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'camForwardOffset', label: 'Camera forward/back offset', min: -1.2, max: 1.2, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'camFov', label: 'FOV', min: 20, max: 110, step: 1, format: (v) => String(Math.round(v)) },
      { key: 'camPitchDeg', label: 'Pitch (debug)', min: -30, max: 30, step: 1, format: (v) => `${Math.round(v)}°` },
      { key: 'camShakePosAmp', label: 'Shake pos amp', min: 0, max: 0.12, step: 0.002, format: (v) => v.toFixed(3) },
      { key: 'camShakeRollDeg', label: 'Shake roll (deg)', min: 0, max: 4, step: 0.05, format: (v) => v.toFixed(2) },
      { key: 'camShakeHz', label: 'Shake Hz', min: 0, max: 22, step: 0.5, format: (v) => v.toFixed(1) },
      { key: 'camShakeLengthMs', label: 'Shake length / hold (ms)', min: 0, max: 12_000, step: 10, format: (v) => String(Math.round(v)) },
      { key: 'camShakeDecayMs', label: 'Shake decay / fade (ms)', min: 0, max: 3000, step: 10, format: (v) => String(Math.round(v)) },
      { key: 'camShakeUiMix', label: 'Shake mix (from ui)', min: 0, max: 1.0, step: 0.01, format: (v) => v.toFixed(2) },
    ],
    [],
  )

  const portraitSliders: Array<Omit<Slider, 'key'> & { key: keyof GameState['render'] }> = useMemo(
    () => [
      { key: 'portraitShakeLengthMs', label: 'Portrait shake length / hold (ms)', min: 0, max: 12_000, step: 10, format: (v) => String(Math.round(v)) },
      { key: 'portraitShakeDecayMs', label: 'Portrait shake decay / fade (ms)', min: 0, max: 3000, step: 10, format: (v) => String(Math.round(v)) },
      { key: 'portraitShakeMagnitudeScale', label: 'Portrait shake amplitude', min: 0, max: 10.0, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'portraitShakeHz', label: 'Portrait shake Hz', min: 0, max: 60, step: 0.5, format: (v) => v.toFixed(1) },
      { key: 'portraitMouthFlickerHz', label: 'Portrait mouth flicker Hz', min: 0, max: 40, step: 0.5, format: (v) => v.toFixed(1) },
      { key: 'portraitMouthFlickerAmount', label: 'Portrait mouth flicker amount (chomps)', min: 0, max: 64, step: 1, format: (v) => String(Math.round(v)) },
      {
        key: 'portraitIdleGapMinMs',
        label: 'Portrait idle gap min (ms)',
        min: 0,
        max: 120_000,
        step: 100,
        format: (v) => String(Math.round(v)),
      },
      {
        key: 'portraitIdleGapMaxMs',
        label: 'Portrait idle gap max (ms)',
        min: 0,
        max: 120_000,
        step: 100,
        format: (v) => String(Math.round(v)),
      },
      {
        key: 'portraitIdleFlashMinMs',
        label: 'Portrait idle flash min (ms)',
        min: 0,
        max: 2000,
        step: 10,
        format: (v) => String(Math.round(v)),
      },
      {
        key: 'portraitIdleFlashMaxMs',
        label: 'Portrait idle flash max (ms)',
        min: 0,
        max: 2000,
        step: 10,
        format: (v) => String(Math.round(v)),
      },
    ],
    [],
  )

  const cursorSliders: Array<Omit<Slider, 'key'> & { key: keyof GameState['render'] }> = useMemo(
    () => [
      { key: 'cursorClickShakeMagnitude', label: 'Click shake amplitude', min: 0, max: 1.0, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'cursorClickShakeHz', label: 'Click shake Hz', min: 0, max: 60, step: 0.5, format: (v) => v.toFixed(1) },
      { key: 'cursorClickShakeLengthMs', label: 'Click shake length / hold (ms)', min: 0, max: 800, step: 5, format: (v) => String(Math.round(v)) },
      { key: 'cursorClickShakeDecayMs', label: 'Click shake decay / fade (ms)', min: 0, max: 1200, step: 5, format: (v) => String(Math.round(v)) },
    ],
    [],
  )

  const renderSliders: Array<Omit<Slider, 'key'> & { key: keyof GameState['render'] }> = useMemo(
    () => [
      { key: 'globalIntensity', label: 'Global intensity (3D)', min: 0, max: 3.0, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'themeHueShiftDeg_dungeon_warm', label: 'Theme hue shift (dungeon_warm, deg)', min: -180, max: 180, step: 1, format: (v) => `${Math.round(v)}°` },
      { key: 'themeSaturation_dungeon_warm', label: 'Theme saturation (dungeon_warm)', min: 0, max: 3, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'themeHueShiftDeg_dungeon_cool', label: 'Theme hue shift (dungeon_cool, deg)', min: -180, max: 180, step: 1, format: (v) => `${Math.round(v)}°` },
      { key: 'themeSaturation_dungeon_cool', label: 'Theme saturation (dungeon_cool)', min: 0, max: 3, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'themeHueShiftDeg_cave_damp', label: 'Theme hue shift (cave_damp, deg)', min: -180, max: 180, step: 1, format: (v) => `${Math.round(v)}°` },
      { key: 'themeSaturation_cave_damp', label: 'Theme saturation (cave_damp)', min: 0, max: 3, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'themeHueShiftDeg_cave_deep', label: 'Theme hue shift (cave_deep, deg)', min: -180, max: 180, step: 1, format: (v) => `${Math.round(v)}°` },
      { key: 'themeSaturation_cave_deep', label: 'Theme saturation (cave_deep)', min: 0, max: 3, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'themeHueShiftDeg_ruins_bleach', label: 'Theme hue shift (ruins_bleach, deg)', min: -180, max: 180, step: 1, format: (v) => `${Math.round(v)}°` },
      { key: 'themeSaturation_ruins_bleach', label: 'Theme saturation (ruins_bleach)', min: 0, max: 3, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'themeHueShiftDeg_ruins_umber', label: 'Theme hue shift (ruins_umber, deg)', min: -180, max: 180, step: 1, format: (v) => `${Math.round(v)}°` },
      { key: 'themeSaturation_ruins_umber', label: 'Theme saturation (ruins_umber)', min: 0, max: 3, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'baseEmissive', label: 'Base emissive lift', min: 0, max: 0.4, step: 0.005, format: (v) => v.toFixed(3) },
      { key: 'dropAheadCells', label: 'Drop length (cells ahead)', min: 0, max: 2.5, step: 0.05, format: (v) => v.toFixed(2) },
      { key: 'dropRangeCells', label: 'Drop range (Manhattan cells)', min: 0, max: 20, step: 1, format: (v) => String(Math.round(v)) },
      { key: 'campEveryFloors', label: 'Camp every N dungeon floors', min: 1, max: 99, step: 1, format: (v) => String(Math.round(v)) },
      { key: 'dropJitterRadius', label: 'Drop jitter radius', min: 0, max: 0.45, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'lanternIntensity', label: 'Lantern intensity', min: 0, max: 40, step: 0.01 },
      { key: 'lanternDistance', label: 'Lantern distance', min: 2, max: 80, step: 0.5, format: (v) => v.toFixed(1) },
      { key: 'lanternForwardOffset', label: 'Lantern forward offset', min: 0, max: 0.8, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'lanternVerticalOffset', label: 'Lantern vertical offset', min: -0.3, max: 0.3, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'lanternFlickerAmp', label: 'Lantern flicker amp', min: 0, max: 0.35, step: 0.005, format: (v) => v.toFixed(3) },
      { key: 'lanternFlickerHz', label: 'Lantern flicker Hz', min: 0, max: 10, step: 0.1, format: (v) => v.toFixed(1) },
      { key: 'lanternBeamIntensityScale', label: 'Lantern beam intensity scale', min: 0, max: 2.5, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'lanternBeamDistanceScale', label: 'Lantern beam distance scale', min: 0.5, max: 3.0, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'lanternBeamAngleDeg', label: 'Lantern beam angle (deg)', min: 5, max: 60, step: 1, format: (v) => String(Math.round(v)) },
      { key: 'lanternBeamPenumbra', label: 'Lantern beam penumbra', min: 0, max: 1, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'torchIntensity', label: 'Torch intensity', min: 0, max: 30, step: 0.01 },
      { key: 'torchDistance', label: 'Torch distance', min: 1, max: 60, step: 0.5, format: (v) => v.toFixed(1) },
      {
        key: 'torchPoiLightMax',
        label: 'Torch POI lights max (nearest to player)',
        min: 0,
        max: 6,
        step: 1,
        format: (v) => String(Math.round(v)),
      },
      {
        key: 'shadowLanternPoint',
        label: 'Shadow: lantern point (0/1, cube map)',
        min: 0,
        max: 1,
        step: 1,
        format: (v) => String(Math.round(v)),
      },
      {
        key: 'shadowLanternBeam',
        label: 'Shadow: lantern beam when lit (0/1)',
        min: 0,
        max: 1,
        step: 1,
        format: (v) => String(Math.round(v)),
      },
      { key: 'shadowMapSize', label: 'Shadow map size (px)', min: 128, max: 512, step: 128, format: (v) => String(Math.round(v)) },
      {
        key: 'shadowFilter',
        label: 'Shadow filter (0=basic, 1=pcf, 2=soft)',
        min: 0,
        max: 2,
        step: 1,
        format: (v) => String(Math.round(v)),
      },
      { key: 'fogDensity', label: 'FogExp2 density', min: 0, max: 0.3, step: 0.001, format: (v) => v.toFixed(3) },
      { key: 'ditherStrength', label: 'Dither strength', min: 0, max: 1, step: 0.01 },
      { key: 'ditherColourPreserve', label: 'Dither colourPreserve', min: 0, max: 1, step: 0.01 },
      { key: 'ditherPixelSize', label: 'Dither pixelSize', min: 1, max: 6, step: 1 },
      { key: 'ditherLevels', label: 'Dither levels', min: 2, max: 24, step: 1 },
      { key: 'ditherMatrixSize', label: 'Dither matrix', min: 2, max: 8, step: 2 },
      { key: 'ditherPalette', label: 'Palette (0-4)', min: 0, max: 4, step: 1 },
      { key: 'postDitherLift', label: 'Post-dither lift', min: -1, max: 1, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'postDitherLevels', label: 'Post-dither gain', min: 0, max: 3, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'postDitherGamma', label: 'Post-dither gamma', min: 0.2, max: 3, step: 0.01, format: (v) => v.toFixed(2) },
      {
        key: 'ditherPalette0Mix',
        label: 'Warm palette mix (0=quantised only, 1=full snap; palette 0)',
        min: 0,
        max: 1,
        step: 0.01,
        format: (v) => v.toFixed(2),
      },
    ],
    [],
  )

  const audioSliders: Array<Omit<Slider, 'key'> & { key: keyof GameState['audio'] }> = useMemo(
    () => [
      { key: 'masterMusic', label: 'Master Music', min: 0, max: 1, step: 0.01 },
      { key: 'masterSfx', label: 'Master SFX', min: 0, max: 1, step: 0.01 },
      { key: 'distanceMaxCells', label: 'Distance max (cells)', min: 1, max: 14, step: 1 },
      { key: 'volumeNear', label: 'Emitter volume (near)', min: 0, max: 0.2, step: 0.005, format: (v) => v.toFixed(3) },
      { key: 'volumeFar', label: 'Emitter volume (far)', min: 0, max: 0.1, step: 0.002, format: (v) => v.toFixed(3) },
      { key: 'lowpassNearHz', label: 'Lowpass near (Hz)', min: 200, max: 6000, step: 50 },
      { key: 'lowpassFarHz', label: 'Lowpass far (Hz)', min: 80, max: 1200, step: 20 },
      { key: 'munchVol', label: 'Munch vol', min: 0, max: 2, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'munchCutoffHz', label: 'Munch noise LP sweep start (Hz)', min: 120, max: 4000, step: 20 },
      { key: 'munchCutoffEndHz', label: 'Munch noise LP sweep end (Hz)', min: 80, max: 2000, step: 20 },
      { key: 'munchHighpassHz', label: 'Munch noise HP (Hz)', min: 40, max: 2000, step: 5, format: (v) => String(Math.round(v)) },
      { key: 'munchHighpassQ', label: 'Munch noise HP Q', min: 0.1, max: 6, step: 0.05, format: (v) => v.toFixed(2) },
      { key: 'munchLowpassQ', label: 'Munch noise LP Q', min: 0.1, max: 6, step: 0.05, format: (v) => v.toFixed(2) },
      { key: 'munchDurSec', label: 'Munch duration (s)', min: 0.04, max: 0.6, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'munchThumpHz', label: 'Munch thump (Hz)', min: 30, max: 220, step: 1 },
      { key: 'munchTremDepth', label: 'Munch trem depth', min: 0, max: 1, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'munchTremHz', label: 'Munch trem Hz', min: 2, max: 40, step: 0.5, format: (v) => v.toFixed(1) },
    ],
    [],
  )

  const npcSliders: Array<Omit<Slider, 'key'> & { key: Exclude<keyof GameState['render'], 'npcBillboard'> }> = useMemo(
    () => [
      {
        key: 'hubInnkeeperSpriteScale',
        label: 'Hub innkeeper sprite scale',
        min: 0.25,
        max: 3,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      { key: 'npcFootLift', label: 'NPC foot lift', min: -0.05, max: 0.15, step: 0.005, format: (v) => v.toFixed(3) },
      { key: 'poiFootLift', label: 'POI above ground', min: -0.2, max: 0.5, step: 0.005, format: (v) => v.toFixed(3) },
      { key: 'poiGroundY_Well', label: 'POI Well groundY', min: -0.6, max: 0.6, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'poiGroundY_Chest', label: 'POI Chest groundY', min: -0.6, max: 0.6, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'poiSpriteBoost', label: 'POI sprite boost', min: 0.5, max: 3.0, step: 0.01, format: (v) => v.toFixed(2) },
    ],
    [],
  )

  type NpcBillboardField = 'groundY' | 'size' | 'sizeRand'
  type NpcBillboardSliderDef = {
    kind: NpcKind
    field: NpcBillboardField
    label: string
    min: number
    max: number
    step: number
    format?: (v: number) => string
  }
  const npcBillboardSliderDefs: NpcBillboardSliderDef[] = useMemo(() => {
    const rows: NpcBillboardSliderDef[] = []
    for (const kind of PROCgen_ALL_NPC_KINDS) {
      rows.push(
        { kind, field: 'groundY', label: `${kind} groundY`, min: -0.6, max: 0.6, step: 0.01, format: (v) => v.toFixed(2) },
        { kind, field: 'size', label: `${kind} size (height)`, min: 0.1, max: 2.5, step: 0.01, format: (v) => v.toFixed(2) },
        {
          kind,
          field: 'sizeRand',
          label: `${kind} size rand (±%)`,
          min: 0,
          max: 1.0,
          step: 0.01,
          format: (v) => `${Math.round(v * 100)}%`,
        },
      )
    }
    return rows
  }, [])

  if (!state.ui.debugOpen) return null

  const formatSliderValue = (s: Slider, v: number) => {
    try {
      return s.format ? s.format(v) : String(Math.round(v * 100) / 100)
    } catch {
      return '—'
    }
  }

  const q = query.trim().toLowerCase()
  const visibleCamera = q ? cameraSliders.filter((s) => `${s.label} ${s.key}`.toLowerCase().includes(q)) : cameraSliders
  const visiblePortrait = q ? portraitSliders.filter((s) => `${s.label} ${s.key}`.toLowerCase().includes(q)) : portraitSliders
  const visibleCursor = q ? cursorSliders.filter((s) => `${s.label} ${s.key}`.toLowerCase().includes(q)) : cursorSliders
  const visibleRender = q ? renderSliders.filter((s) => `${s.label} ${s.key}`.toLowerCase().includes(q)) : renderSliders
  const visibleAudio = q ? audioSliders.filter((s) => `${s.label} ${s.key}`.toLowerCase().includes(q)) : audioSliders
  const visibleNpc = q ? npcSliders.filter((s) => `${s.label} ${s.key}`.toLowerCase().includes(q)) : npcSliders
  const visibleNpcBillboard = q ? npcBillboardSliderDefs.filter((s) => s.label.toLowerCase().includes(q)) : npcBillboardSliderDefs

  const canonicalYaw = canonicalYawForDir(state.floor.playerDir)
  const yawRaw = state.view.anim?.kind === 'turn' ? state.view.camYaw : canonicalYaw
  const yawGame = wrapPi(yawRaw)
  // Must match WorldRenderer: Three.js rotation.y uses opposite X sign vs game forward (sin, -cos).
  const yawThree = -yawGame

  const cell = state.floor.playerPos
  const cellSource = 'player'
  const { w: floorW, h: floorH } = state.floor
  const inBounds = cell.x >= 0 && cell.y >= 0 && cell.x < floorW && cell.y < floorH
  const tile = inBounds ? state.floor.tiles[cell.x + cell.y * floorW] : undefined
  const dist = Math.abs(cell.x - state.floor.playerPos.x) + Math.abs(cell.y - state.floor.playerPos.y)
  const room =
    state.floor.gen?.rooms.find((r) => cell.x >= r.rect.x && cell.y >= r.rect.y && cell.x < r.rect.x + r.rect.w && cell.y < r.rect.y + r.rect.h) ??
    null

  return (
    <div
      className={styles.root}
      onPointerUp={cursor.endPointerUp}
      onPointerCancel={cursor.cancelDrag}
    >
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.title}>Debug (F2)</div>
        </div>
        <div className={styles.headerBtns}>
          <button type="button" className={styles.headerBtn} onClick={() => dispatch({ type: 'floor/regen' })}>
            Regen (seed {state.floor.seed})
          </button>
          <button type="button" className={`${styles.headerBtn} ${styles.headerBtnPrimary}`} onClick={newRun} title="Start a fresh run (resets run progression and regenerates).">
            New run
          </button>
          <button
            type="button"
            className={styles.headerBtn}
            onClick={() => dispatch({ type: 'floor/descend' })}
            title="Advance to the next floor (increments floorIndex and regenerates)."
          >
            Descend (debug)
          </button>
          <button
            type="button"
            className={styles.headerBtn}
            onClick={() => dispatch({ type: 'floor/debugCycleRealizer' })}
            title="Cycles segment floor-type order (Cave → … → Golem) for the next Regen"
          >
            Cycle type
          </button>
          <button
            type="button"
            className={styles.headerBtn}
            onClick={() => dispatch({ type: 'floor/debugCycleDifficulty' })}
            title="Cycles easy (0) → normal (1) → hard (2) for the next Regen"
          >
            Cycle difficulty ({state.floor.difficulty})
          </button>
          <button
            type="button"
            className={styles.headerBtn}
            onClick={() => {
              const order: Array<ProcgenDebugOverlayMode | undefined> = [undefined, 'districts', 'roomTags', 'mission']
              const cur = state.ui.procgenDebugOverlay
              const i = Math.max(0, order.indexOf(cur))
              const next = order[(i + 1) % order.length]
              dispatch({ type: 'ui/setProcgenDebugOverlay', mode: next })
            }}
            title="Cycle floor tint overlay in the 3D view (districts → room function → mission nodes → off)"
          >
            Proc overlay: {state.ui.procgenDebugOverlay ?? 'off'}
          </button>
          <button
            type="button"
            className={styles.headerBtn}
            onClick={dumpFloorGen}
            title="Download the canonical procgen output (floor.gen) as JSON"
          >
            Dump floor.gen ({dumpTick ? 'ok' : 'json'})
          </button>

          {import.meta.env.DEV && (
            <>
              <button
                type="button"
                className={`${styles.headerBtn} ${styles.headerBtnPrimary}`}
                onClick={async () => {
                  const ok = await saveDebugSettingsToProject(
                    state.render,
                    state.audio,
                    state.hubHotspots,
                    buildDebugUiPersist(state.ui),
                  )
                  dispatch({
                    type: 'ui/toast',
                    text: ok ? 'Saved debug settings to project.' : 'Failed to save debug settings to project.',
                    ms: ok ? 1400 : 1600,
                  })
                }}
                title="Writes web/public/debug-settings.json (dev server only)"
              >
                Save to project
              </button>
              <button
                type="button"
                className={styles.headerBtn}
                onClick={() => {
                  clearLocalDebugSettings()
                  dispatch({
                    type: 'ui/toast',
                    text: 'Cleared local debug overrides. Reloading…',
                    ms: 1200,
                  })
                  window.setTimeout(() => window.location.reload(), 350)
                }}
                title="Removes elfenstein.debugSettings from localStorage and reloads so project JSON applies cleanly"
              >
                Clear local overrides
              </button>
            </>
          )}
        </div>
      </div>

      <input
        className={styles.search}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search… (will matter later)"
      />

      {(!q || 'popup modal dialog death npc ui overlay'.includes(q)) && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>UI</div>
          <div className={styles.row}>
            <div className={styles.label}>NPC dialog popup</div>
            <div className={`${styles.value} ${styles.popupPreviewValue}`}>
              {state.ui.screen !== 'game' ? (
                <span className={styles.popupPreviewHint}>In run only</span>
              ) : state.floor.npcs.length === 0 ? (
                <span className={styles.popupPreviewHint}>Spawn an NPC first</span>
              ) : null}
              <label className={styles.pill} title="Shows the dialog for the first NPC on this floor. Does not open a real encounter.">
                <input
                  type="checkbox"
                  checked={Boolean(state.ui.debugShowNpcDialogPopup)}
                  disabled={
                    state.ui.screen !== 'game' ||
                    !!state.ui.npcDialogFor ||
                    !!state.ui.death ||
                    state.floor.npcs.length === 0
                  }
                  onChange={(e) => {
                    const on = e.target.checked
                    if (on && state.floor.npcs.length === 0) {
                      dispatch({ type: 'ui/toast', text: 'No NPCs on this floor. Use Spawn (NPC) below.', ms: 2200 })
                      return
                    }
                    dispatch({ type: 'debug/setShowNpcDialogPopupPreview', show: on })
                  }}
                />
                Show
              </label>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.label}>Death popup</div>
            <div className={`${styles.value} ${styles.popupPreviewValue}`}>
              {state.ui.screen !== 'game' ? <span className={styles.popupPreviewHint}>In run only</span> : null}
              <label className={styles.pill} title="Shows the post-death modal without killing the party or blocking input.">
                <input
                  type="checkbox"
                  checked={Boolean(state.ui.debugShowDeathPopup)}
                  disabled={state.ui.screen !== 'game' || !!state.ui.death}
                  onChange={(e) => dispatch({ type: 'debug/setShowDeathPopupPreview', show: e.target.checked })}
                />
                Show
              </label>
            </div>
          </div>
        </div>
      )}

      {(!q || 'floor floors procgen floorindex floorproperties properties'.includes(q)) && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Floors</div>

          <div className={styles.row}>
            <div className={styles.label}>set floorIndex</div>
            <div className={styles.value}>
              <input
                className={styles.inlineInput}
                inputMode="numeric"
                value={floorIndexDraft}
                onChange={(e) => setFloorIndexDraft(e.target.value)}
                onBlur={() => setFloorIndexDraft(String(state.floor.floorIndex))}
              />
            </div>
            <div className={styles.inlineBtns}>
              <button
                type="button"
                className={styles.headerBtn}
                onClick={() => {
                  const n = Number(floorIndexDraft)
                  dispatch({ type: 'floor/debugSetFloorIndex', floorIndex: n })
                }}
                title="Sets floorIndex (0-based). Regen separately to materialize."
              >
                Apply
              </button>
              <button
                type="button"
                className={styles.headerBtn}
                onClick={() => {
                  const n = Number(floorIndexDraft)
                  dispatch({ type: 'floor/debugSetFloorIndex', floorIndex: n })
                  dispatch({ type: 'floor/regen' })
                }}
                title="Sets floorIndex and immediately regenerates."
              >
                Apply & Regen
              </button>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.label}>floorProperties</div>
            <div className={styles.value}>{state.floor.floorProperties.length ? state.floor.floorProperties.join(', ') : '—'}</div>
            <div className={styles.inlineBtns}>
              {floorPropertyOrder.map((p) => {
                const checked = state.floor.floorProperties.includes(p)
                return (
                  <label key={p} className={styles.pill} title="Affects procgen on Regen/Descend.">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => dispatch({ type: 'floor/debugToggleFloorProperty', property: p })}
                    />
                    {p}
                  </label>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {(!q || 'spawn npc poi item entity'.includes(q)) && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Spawn (1 cell ahead)</div>
          <div className={styles.row}>
            <div className={styles.label}>NPC</div>
            <div className={styles.value}>
              <select
                className={styles.inlineInput}
                value={spawnNpcKind}
                onChange={(e) => setSpawnNpcKind(e.target.value as NpcKind)}
              >
                {PROCgen_ALL_NPC_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.inlineBtns}>
              <button
                type="button"
                className={styles.headerBtn}
                onClick={() => dispatch({ type: 'debug/spawnNpc', kind: spawnNpcKind })}
              >
                Spawn
              </button>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.label}>POI</div>
            <div className={styles.value}>
              <select
                className={styles.inlineInput}
                value={spawnPoiKind}
                onChange={(e) => setSpawnPoiKind(e.target.value as PoiKind)}
              >
                {(['Well', 'Chest', 'Barrel', 'Crate', 'Bed', 'Shrine', 'CrackedWall', 'Exit'] satisfies PoiKind[]).map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            <div className={styles.inlineBtns}>
              <button
                type="button"
                className={styles.headerBtn}
                onClick={() => dispatch({ type: 'debug/spawnPoi', kind: spawnPoiKind })}
              >
                Spawn
              </button>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.label}>Item</div>
            <div className={styles.value}>
              <select
                className={styles.inlineInput}
                value={spawnItemDefId}
                onChange={(e) => setSpawnItemDefId(e.target.value as ItemDefId)}
              >
                {itemDefsSpawnSorted.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.id})
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.inlineBtns}>
              <button
                type="button"
                className={styles.headerBtn}
                onClick={() => dispatch({ type: 'debug/spawnItem', defId: spawnItemDefId })}
              >
                Spawn
              </button>
            </div>
          </div>
        </div>
      )}

      {(!q || 'cell current player tile room district'.includes(q)) && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Cell</div>
          <div className={styles.row}>
            <div className={styles.label}>source</div>
            <div className={styles.value}>{cellSource}</div>
            <div />
          </div>
          <div className={styles.row}>
            <div className={styles.label}>pos</div>
            <div className={styles.value}>
              {cell.x},{cell.y}
            </div>
            <div />
          </div>
          <div className={styles.row}>
            <div className={styles.label}>inBounds</div>
            <div className={styles.value}>{inBounds ? 'yes' : 'no'}</div>
            <div />
          </div>
          <div className={styles.row}>
            <div className={styles.label}>tile</div>
            <div className={styles.value}>{tile ?? '—'}</div>
            <div />
          </div>
          <div className={styles.row}>
            <div className={styles.label}>distToPlayer</div>
            <div className={styles.value}>{String(dist)}</div>
            <div />
          </div>

          <div className={styles.row}>
            <div className={styles.label}>roomId</div>
            <div className={styles.value}>{room?.id ?? '—'}</div>
            <div />
          </div>
          <div className={styles.row}>
            <div className={styles.label}>district</div>
            <div className={styles.value}>{room?.district ?? '—'}</div>
            <div />
          </div>
          <div className={styles.row}>
            <div className={styles.label}>roomFunction</div>
            <div className={styles.value}>{room?.tags?.roomFunction ?? '—'}</div>
            <div />
          </div>
          <div className={styles.row}>
            <div className={styles.label}>roomProperties</div>
            <div className={styles.value}>{room?.tags?.roomProperties ?? '—'}</div>
            <div />
          </div>
          <div className={styles.row}>
            <div className={styles.label}>roomStatus</div>
            <div className={styles.value}>{room?.tags?.roomStatus ?? '—'}</div>
            <div />
          </div>
          <div className={styles.row}>
            <div className={styles.label}>roomSize</div>
            <div className={styles.value}>{room?.tags?.size ?? '—'}</div>
            <div />
          </div>
        </div>
      )}

      {(!q || 'telegraph room property post fx vignette tint'.includes(q)) && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Telegraph (roomProperties)</div>
          <div className={styles.row}>
            <div className={styles.label}>mode</div>
            <div className={styles.value}>
              <select
                className={styles.inlineInput}
                value={state.ui.roomTelegraphMode}
                onChange={(e) => {
                  const v = e.target.value as GameState['ui']['roomTelegraphMode']
                  dispatch({ type: 'debug/setRoomTelegraphMode', mode: v })
                }}
              >
                <option value="auto">auto (from room tag)</option>
                <option value="off">off</option>
                <option value="Burning">force Burning</option>
                <option value="Flooded">force Flooded</option>
                <option value="Infected">force Infected</option>
              </select>
            </div>
            <div />
          </div>
          <div className={styles.row}>
            <div className={styles.label}>strength</div>
            <div className={styles.value}>{state.ui.roomTelegraphStrength.toFixed(2)}</div>
            <input
              className={styles.slider}
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={state.ui.roomTelegraphStrength}
              onChange={(e) =>
                dispatch({ type: 'debug/setRoomTelegraphStrength', strength: Number(e.target.value) })
              }
            />
          </div>
        </div>
      )}

      {(!q || 'perf performance frame fps'.includes(q)) && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Perf</div>
          <div className={styles.row}>
            <div className={styles.label}>perf HUD</div>
            <div className={styles.value}>{perfOpen ? 'On' : 'Off'}</div>
            <input className={styles.slider} type="checkbox" checked={perfOpen} onChange={(e) => setPerfOpen(e.target.checked)} />
          </div>
          {perfOpen && (
            <>
              {(() => {
                const p = (window as any).__elfensteinPerf as
                  | undefined
                  | {
                      frameMs?: number
                      worldMs?: number
                      presentMs?: number
                      uiCaptureMs?: number | null
                      emaFrameMs?: number
                      emaWorldMs?: number
                      emaPresentMs?: number
                      counts?: {
                        tiles?: number
                        pois?: number
                        npcs?: number
                        itemsOnFloor?: number
                        floorGeomRevision?: number
                      }
                    }
                const f = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(2) : '—')
                const fi = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? String(Math.round(v)) : '—')
                return (
                  <>
                    <div className={styles.row}>
                      <div className={styles.label}>frame (ms)</div>
                      <div className={styles.value}>{f(p?.frameMs)} (ema {f(p?.emaFrameMs)})</div>
                      <div />
                    </div>
                    <div className={styles.row}>
                      <div className={styles.label}>world (ms)</div>
                      <div className={styles.value}>{f(p?.worldMs)} (ema {f(p?.emaWorldMs)})</div>
                      <div />
                    </div>
                    <div className={styles.row}>
                      <div className={styles.label}>present (ms)</div>
                      <div className={styles.value}>{f(p?.presentMs)} (ema {f(p?.emaPresentMs)})</div>
                      <div />
                    </div>
                    <div className={styles.row}>
                      <div className={styles.label}>ui capture (ms)</div>
                      <div className={styles.value}>{f(p?.uiCaptureMs)}</div>
                      <div />
                    </div>
                    <div className={styles.row}>
                      <div className={styles.label}>counts</div>
                      <div className={styles.value}>
                        tiles {fi(p?.counts?.tiles)} | pois {fi(p?.counts?.pois)} | npcs {fi(p?.counts?.npcs)} | items {fi(p?.counts?.itemsOnFloor)} | geomRev{' '}
                        {fi(p?.counts?.floorGeomRevision)}
                      </div>
                      <div />
                    </div>
                  </>
                )
              })()}
            </>
          )}
        </div>
      )}

      {(!q || 'procgen floor gen mission district score difficulty'.includes(q)) && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Procgen</div>
          <div className={styles.row}>
            <div className={styles.label}>difficulty</div>
            <div className={styles.value}>
              {state.floor.difficulty === 0 ? 'easy (0)' : state.floor.difficulty === 1 ? 'normal (1)' : 'hard (2)'}
            </div>
            <div />
          </div>
          <div className={styles.row}>
            <div className={styles.label}>floorType</div>
            <div className={styles.value}>{state.floor.floorType}</div>
            <div />
          </div>
          <div className={styles.row}>
            <div className={styles.label}>floorIndex</div>
            <div className={styles.value}>{state.floor.floorIndex}</div>
            <div />
          </div>
          <div className={styles.row}>
            <div className={styles.label}>floorProperties</div>
            <div className={styles.value}>{state.floor.floorProperties.length ? state.floor.floorProperties.join(', ') : '—'}</div>
            <div />
          </div>
          {state.floor.gen && (
            <>
              <div className={styles.row}>
                <div className={styles.label}>genVersion</div>
                <div className={styles.value}>{state.floor.gen.meta.genVersion}</div>
                <div />
              </div>
              <div className={styles.row}>
                <div className={styles.label}>stream mission</div>
                <div className={styles.value}>
                  {state.floor.gen.meta.streams.mission !== undefined
                    ? String(state.floor.gen.meta.streams.mission)
                    : '—'}
                </div>
                <div />
              </div>
              <div className={styles.row}>
                <div className={styles.label}>attempt</div>
                <div className={styles.value}>{state.floor.gen.meta.attempt}</div>
                <div />
              </div>
              <div className={styles.row}>
                <div className={styles.label}>layoutScore</div>
                <div className={styles.value}>
                  {state.floor.gen.meta.layoutScore !== undefined ? String(Math.round(state.floor.gen.meta.layoutScore)) : '—'}
                </div>
                <div />
              </div>
              <div className={styles.row}>
                <div className={styles.label}>theme</div>
                <div className={styles.value}>{state.floor.gen.theme?.id ?? '—'}</div>
                <div />
              </div>
              <div className={styles.row}>
                <div className={styles.label}>themeTuning</div>
                <div className={styles.value}>
                  {(() => {
                    const it = getThemeLightIntent(state.floor.gen.theme?.id)
                    const torch = it.torchIntensityMult != null ? ` torchI×${it.torchIntensityMult.toFixed(2)}` : ''
                    const lan = it.lanternIntensityMult != null ? ` lanternI×${it.lanternIntensityMult.toFixed(2)}` : ''
                    return `intent=${it.intentHex} mix=${it.mix.toFixed(2)}${lan}${torch}`
                  })()}
                </div>
                <div />
              </div>
              <div className={styles.row}>
                <div className={styles.label}>missionGraph</div>
                <div className={styles.value}>
                  {state.floor.gen.missionGraph
                    ? `${state.floor.gen.missionGraph.nodes.length} nodes, ${state.floor.gen.missionGraph.edges.length} edges` +
                      (state.floor.gen.missionGraph.hasAlternateEntranceExitRoute ? ', altRoute' : '')
                    : '—'}
                </div>
                <div />
              </div>
            </>
          )}
        </div>
      )}

      {(!q || 'combat encounter turn queue initiative speed'.includes(q)) && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Combat</div>
          <div className={styles.row}>
            <div className={styles.label}>active</div>
            <div className={styles.value}>{state.combat ? 'yes' : 'no'}</div>
            <div />
          </div>
          <div className={styles.row}>
            <div className={styles.label}>actions</div>
            <div className={styles.value}>
              <button type="button" className={styles.headerBtn} onClick={() => dispatch({ type: 'combat/fleeAttempt' })} disabled={!state.combat}>
                Flee (R)
              </button>{' '}
              <button type="button" className={styles.headerBtn} onClick={() => dispatch({ type: 'combat/defend' })} disabled={!state.combat}>
                Defend (F)
              </button>
            </div>
            <div />
          </div>
          {state.combat && (
            <>
              <div className={styles.row}>
                <div className={styles.label}>encounterId</div>
                <div className={styles.value}>{state.combat.encounterId}</div>
                <div />
              </div>
              <div className={styles.row}>
                <div className={styles.label}>turn</div>
                <div className={styles.value}>
                  {state.combat.turnQueue.length
                    ? `${state.combat.turnIndex + 1}/${state.combat.turnQueue.length}`
                    : '—'}
                </div>
                <div />
              </div>
              <div className={styles.row}>
                <div className={styles.label}>queue</div>
                <div className={styles.value}>
                  {state.combat.turnQueue.length
                    ? state.combat.turnQueue
                        .slice(0, 8)
                        .map((t) => {
                          const name =
                            t.kind === 'pc'
                              ? state.party.chars.find((c) => c.id === t.id)?.name ?? t.id
                              : state.floor.npcs.find((n) => n.id === t.id)?.name ?? t.id
                          return `${t.kind}:${name}(${t.initiative.toFixed(2)})`
                        })
                        .join(' | ')
                    : '—'}
                </div>
                <div />
              </div>
            </>
          )}
        </div>
      )}

      {(!q || 'pose yaw direction playerdir camyaw'.includes(q)) && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Pose</div>
          <div className={styles.row}>
            <div className={styles.label}>playerDir</div>
            <div className={styles.value}>{state.floor.playerDir}</div>
            <div />
          </div>
          <div className={styles.row}>
            <div className={styles.label}>view.anim</div>
            <div className={styles.value}>{state.view.anim ? state.view.anim.kind : 'none'}</div>
            <div />
          </div>
          <div className={styles.row}>
            <div className={styles.label}>view.camYaw</div>
            <div className={styles.value}>{deg(wrapPi(state.view.camYaw)).toFixed(1)}°</div>
            <div />
          </div>
          <div className={styles.row}>
            <div className={styles.label}>canonicalYaw(dir)</div>
            <div className={styles.value}>{deg(canonicalYaw).toFixed(1)}°</div>
            <div />
          </div>
          <div className={styles.row}>
            <div className={styles.label}>yawGame (logic)</div>
            <div className={styles.value}>{deg(yawGame).toFixed(1)}°</div>
            <div />
          </div>
          <div className={styles.row}>
            <div className={styles.label}>rotation.y (Three.js)</div>
            <div className={styles.value}>{deg(yawThree).toFixed(1)}°</div>
            <div />
          </div>
        </div>
      )}

      {(!q || 'hub hotspot village tavern 2d scene rect'.includes(q)) && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Hub hotspots (normalized 0–1 in game viewport)</div>
          {(
            [
              { label: 'Village · Tavern', spot: 'village.tavern' as const },
              { label: 'Village · Cave', spot: 'village.cave' as const },
              { label: 'Tavern · Bartender sprite', spot: 'tavern.innkeeper' as const },
              { label: 'Tavern · Open trade (click)', spot: 'tavern.innkeeperTrade' as const },
            ] as const
          ).map(({ label, spot }) => {
            const rect: HubNormRect =
              spot === 'village.tavern'
                ? state.hubHotspots.village.tavern
                : spot === 'village.cave'
                  ? state.hubHotspots.village.cave
                  : spot === 'tavern.innkeeper'
                    ? state.hubHotspots.tavern.innkeeper
                    : state.hubHotspots.tavern.innkeeperTrade
            const axes = [
              { key: 'x' as const, label: 'x' },
              { key: 'y' as const, label: 'y' },
              { key: 'w' as const, label: 'w' },
              { key: 'h' as const, label: 'h' },
            ]
            return (
              <div key={spot}>
                <div className={styles.subSectionTitle}>{label}</div>
                {axes.map(({ key, label: axisLabel }) => {
                  const v = rect[key]
                  return (
                    <div key={key} className={styles.row}>
                      <div className={styles.label}>{axisLabel}</div>
                      <div className={styles.value}>{v.toFixed(3)}</div>
                      <input
                        className={styles.slider}
                        type="range"
                        min={0}
                        max={1}
                        step={0.005}
                        value={v}
                        onChange={(e) =>
                          dispatch({
                            type: 'hubHotspot/setAxis',
                            spot,
                            key,
                            value: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Camera</div>
        {visibleCamera.map((s) => {
          const raw = state.render[s.key]
          const v = typeof raw === 'number' && Number.isFinite(raw) ? raw : s.min
          return (
            <div key={s.key} className={styles.row}>
              <div className={styles.label}>{s.label}</div>
              <div className={styles.value}>{formatSliderValue(s, v)}</div>
              <input
                className={styles.slider}
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={v}
                onChange={(e) => dispatch({ type: 'render/set', key: s.key, value: Number(e.target.value) })}
              />
            </div>
          )
        })}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Portrait</div>
        {visiblePortrait.map((s) => {
          const raw = state.render[s.key]
          const v = typeof raw === 'number' && Number.isFinite(raw) ? raw : s.min
          return (
            <div key={s.key} className={styles.row}>
              <div className={styles.label}>{s.label}</div>
              <div className={styles.value}>{formatSliderValue(s, v)}</div>
              <input
                className={styles.slider}
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={v}
                onChange={(e) => dispatch({ type: 'render/set', key: s.key, value: Number(e.target.value) })}
              />
            </div>
          )
        })}
      </div>

      {(!q || 'cursor click shake'.includes(q) || visibleCursor.length) && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Cursor</div>
          <div className={styles.row}>
            <div className={styles.label}>Click shake enabled</div>
            <div className={styles.value}>{state.render.cursorClickShakeEnabled > 0 ? 'On' : 'Off'}</div>
            <input
              className={styles.slider}
              type="checkbox"
              checked={state.render.cursorClickShakeEnabled > 0}
              onChange={(e) => dispatch({ type: 'render/set', key: 'cursorClickShakeEnabled', value: e.target.checked ? 1 : 0 })}
            />
          </div>
          {visibleCursor.map((s) => {
            const raw = state.render[s.key]
            const v = typeof raw === 'number' && Number.isFinite(raw) ? raw : s.min
            return (
              <div key={s.key} className={styles.row}>
                <div className={styles.label}>{s.label}</div>
                <div className={styles.value}>{formatSliderValue(s, v)}</div>
                <input
                  className={styles.slider}
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={v}
                  onChange={(e) => dispatch({ type: 'render/set', key: s.key, value: Number(e.target.value) })}
                />
              </div>
            )
          })}
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Rendering</div>
        {(!q || 'fog enabled fogenabled fog'.includes(q)) && (
          <div className={styles.row}>
            <div className={styles.label}>Fog enabled</div>
            <div className={styles.value}>{state.render.fogEnabled > 0 ? 'On' : 'Off'}</div>
            <input
              className={styles.slider}
              type="checkbox"
              checked={state.render.fogEnabled > 0}
              onChange={(e) => dispatch({ type: 'render/set', key: 'fogEnabled', value: e.target.checked ? 1 : 0 })}
            />
          </div>
        )}
        {visibleRender.map((s) => {
          const raw = state.render[s.key]
          const v = typeof raw === 'number' && Number.isFinite(raw) ? raw : s.min
          return (
            <div key={s.key} className={styles.row}>
              <div className={styles.label}>{s.label}</div>
              <div className={styles.value}>{formatSliderValue(s, v)}</div>
              <input
                className={styles.slider}
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={v}
                onChange={(e) => dispatch({ type: 'render/set', key: s.key, value: Number(e.target.value) })}
              />
            </div>
          )
        })}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>NPCs</div>
        {visibleNpc.map((s) => {
          const raw = state.render[s.key]
          const v = typeof raw === 'number' && Number.isFinite(raw) ? raw : s.min
          return (
            <div key={s.key} className={styles.row}>
              <div className={styles.label}>{s.label}</div>
              <div className={styles.value}>{formatSliderValue(s, v)}</div>
              <input
                className={styles.slider}
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={v}
                onChange={(e) => dispatch({ type: 'render/set', key: s.key, value: Number(e.target.value) })}
              />
            </div>
          )
        })}
        {visibleNpcBillboard.map((s) => {
          const raw = state.render.npcBillboard[s.kind][s.field]
          const v = typeof raw === 'number' && Number.isFinite(raw) ? raw : s.min
          const sliderLike: Slider = { key: `${s.kind}-${s.field}`, label: s.label, min: s.min, max: s.max, step: s.step, format: s.format }
          return (
            <div key={`${s.kind}-${s.field}`} className={styles.row}>
              <div className={styles.label}>{s.label}</div>
              <div className={styles.value}>{formatSliderValue(sliderLike, v)}</div>
              <input
                className={styles.slider}
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={v}
                onChange={(e) =>
                  dispatch({
                    type: 'render/npcBillboard',
                    kind: s.kind,
                    field: s.field,
                    value: Number(e.target.value),
                  })
                }
              />
            </div>
          )
        })}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Background music</div>
        <div className={styles.row}>
          <div className={styles.label}>Now playing</div>
          <div className={styles.value}>
            {BG_NOISE_LABELS[state.ui.debugBgTrack ?? selectBgTrack(state)] ?? '?'}
            {state.ui.debugBgTrack ? ' (override)' : ''}
          </div>
        </div>
        <div className={styles.audioBtns}>
          {Object.values(BG_NOISE_TRACKS).map((url) => (
            <button
              key={url}
              type="button"
              className={styles.audioBtn}
              style={{ fontWeight: state.ui.debugBgTrack === url ? 'bold' : undefined }}
              onClick={() =>
                dispatch({
                  type: 'ui/setDebugBgTrack',
                  track: state.ui.debugBgTrack === url ? undefined : url,
                })
              }
            >
              {BG_NOISE_LABELS[url] ?? url}
            </button>
          ))}
        </div>
        <div className={styles.audioBtns}>
          {BG_SFX_TRACKS.map((url, i) => (
            <button
              key={url}
              type="button"
              className={styles.audioBtn}
              onClick={() => dispatch({ type: 'ui/triggerDebugBgSfx', index: i })}
            >
              {url.split('/').pop()}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Audio (distance)</div>
        <div className={styles.audioBtns}>
          <button type="button" className={styles.audioBtn} onClick={() => dispatch({ type: 'ui/sfx', kind: 'munch' })}>
            Play munch
          </button>
          <button type="button" className={styles.audioBtn} onClick={() => dispatch({ type: 'ui/sfx', kind: 'ui' })}>
            Play ui
          </button>
          <button type="button" className={styles.audioBtn} onClick={() => dispatch({ type: 'ui/sfx', kind: 'reject' })}>
            Play reject
          </button>
          <button type="button" className={styles.audioBtn} onClick={() => dispatch({ type: 'ui/sfx', kind: 'pickup' })}>
            Play pickup
          </button>
          <button type="button" className={styles.audioBtn} onClick={() => dispatch({ type: 'ui/sfx', kind: 'hit' })}>
            Play hit
          </button>
          <button type="button" className={styles.audioBtn} onClick={() => dispatch({ type: 'ui/sfx', kind: 'swing' })}>
            Play swing
          </button>
          <button type="button" className={styles.audioBtn} onClick={() => dispatch({ type: 'ui/sfx', kind: 'step' })}>
            Play step
          </button>
          <button type="button" className={styles.audioBtn} onClick={() => dispatch({ type: 'ui/sfx', kind: 'bump' })}>
            Play bump
          </button>
        </div>
        {visibleAudio.map((s) => {
          const v = state.audio[s.key]
          return (
            <div key={s.key} className={styles.row}>
              <div className={styles.label}>{s.label}</div>
              <div className={styles.value}>{s.format ? s.format(v) : String(Math.round(v * 100) / 100)}</div>
              <input
                className={styles.slider}
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={v}
                onChange={(e) => dispatch({ type: 'audio/set', key: s.key, value: Number(e.target.value) })}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

