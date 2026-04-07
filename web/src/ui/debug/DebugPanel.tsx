import { type Dispatch, useMemo, useState } from 'react'
import type { Action } from '../../game/reducer'
import type { GameState, ProcgenDebugOverlayMode } from '../../game/types'
import { useCursor } from '../cursor/useCursor'
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

  const renderSliders: Array<Omit<Slider, 'key'> & { key: keyof GameState['render'] }> = useMemo(
    () => [
      { key: 'baseEmissive', label: 'Base emissive lift', min: 0, max: 0.4, step: 0.005, format: (v) => v.toFixed(3) },
      { key: 'dropAheadCells', label: 'Drop length (cells ahead)', min: 0, max: 2.5, step: 0.05, format: (v) => v.toFixed(2) },
      { key: 'dropRangeCells', label: 'Drop range (Manhattan cells)', min: 0, max: 20, step: 1, format: (v) => String(Math.round(v)) },
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

  const npcSliders: Array<Omit<Slider, 'key'> & { key: keyof GameState['render'] }> = useMemo(
    () => [
      { key: 'npcFootLift', label: 'NPC foot lift', min: -0.05, max: 0.15, step: 0.005, format: (v) => v.toFixed(3) },
      { key: 'poiGroundY_Well', label: 'POI Well groundY', min: -0.6, max: 0.6, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'poiGroundY_Chest', label: 'POI Chest groundY', min: -0.6, max: 0.6, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'npcGroundY_Wurglepup', label: 'Wurglepup groundY', min: -0.6, max: 0.6, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'npcSize_Wurglepup', label: 'Wurglepup size (height)', min: 0.1, max: 2.5, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'npcSizeRand_Wurglepup', label: 'Wurglepup size rand (±%)', min: 0, max: 1.0, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
      { key: 'npcGroundY_Bobr', label: 'Bobr groundY', min: -0.6, max: 0.6, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'npcSize_Bobr', label: 'Bobr size (height)', min: 0.1, max: 2.5, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'npcSizeRand_Bobr', label: 'Bobr size rand (±%)', min: 0, max: 1.0, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
      { key: 'npcGroundY_Skeleton', label: 'Skeleton groundY', min: -0.6, max: 0.6, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'npcSize_Skeleton', label: 'Skeleton size (height)', min: 0.1, max: 2.5, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'npcSizeRand_Skeleton', label: 'Skeleton size rand (±%)', min: 0, max: 1.0, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
      { key: 'npcGroundY_Catoctopus', label: 'Catoctopus groundY', min: -0.6, max: 0.6, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'npcSize_Catoctopus', label: 'Catoctopus size (height)', min: 0.1, max: 2.5, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'npcSizeRand_Catoctopus', label: 'Catoctopus size rand (±%)', min: 0, max: 1.0, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
    ],
    [],
  )

  if (!state.ui.debugOpen) return null

  const q = query.trim().toLowerCase()
  const visibleCamera = q ? cameraSliders.filter((s) => `${s.label} ${s.key}`.toLowerCase().includes(q)) : cameraSliders
  const visiblePortrait = q ? portraitSliders.filter((s) => `${s.label} ${s.key}`.toLowerCase().includes(q)) : portraitSliders
  const visibleRender = q ? renderSliders.filter((s) => `${s.label} ${s.key}`.toLowerCase().includes(q)) : renderSliders
  const visibleAudio = q ? audioSliders.filter((s) => `${s.label} ${s.key}`.toLowerCase().includes(q)) : audioSliders
  const visibleNpc = q ? npcSliders.filter((s) => `${s.label} ${s.key}`.toLowerCase().includes(q)) : npcSliders

  const canonicalYaw = canonicalYawForDir(state.floor.playerDir)
  const yawRaw = state.view.anim?.kind === 'turn' ? state.view.camYaw : canonicalYaw
  const yawGame = wrapPi(yawRaw)
  // Must match WorldRenderer: Three.js rotation.y uses opposite X sign vs game forward (sin, -cos).
  const yawThree = -yawGame

  return (
    <div
      className={styles.root}
      onPointerMove={cursor.onPointerMove}
      onPointerUp={cursor.endPointerUp}
      onPointerCancel={cursor.cancelDrag}
    >
      <div className={styles.header}>
        <div className={styles.title}>Debug (F2)</div>
        <button
          type="button"
          onClick={() => dispatch({ type: 'floor/regen' })}
          style={{
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(0,0,0,0.28)',
            color: 'rgba(255,255,255,0.86)',
            borderRadius: 10,
            padding: '6px 10px',
            fontFamily: 'var(--mono)',
            fontSize: 11,
          }}
        >
          Regen (seed {state.floor.seed})
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'floor/debugCycleRealizer' })}
          title="Cycles Dungeon → Cave → Ruins for the next Regen"
          style={{
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(0,0,0,0.28)',
            color: 'rgba(255,255,255,0.86)',
            borderRadius: 10,
            padding: '6px 10px',
            fontFamily: 'var(--mono)',
            fontSize: 11,
          }}
        >
          Cycle type
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'floor/debugCycleDifficulty' })}
          title="Cycles easy (0) → normal (1) → hard (2) for the next Regen"
          style={{
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(0,0,0,0.28)',
            color: 'rgba(255,255,255,0.86)',
            borderRadius: 10,
            padding: '6px 10px',
            fontFamily: 'var(--mono)',
            fontSize: 11,
          }}
        >
          Cycle difficulty ({state.floor.difficulty})
        </button>
        <button
          type="button"
          onClick={() => {
            const order: Array<ProcgenDebugOverlayMode | undefined> = [
              undefined,
              'districts',
              'roomTags',
              'mission',
            ]
            const cur = state.ui.procgenDebugOverlay
            const i = Math.max(0, order.indexOf(cur))
            const next = order[(i + 1) % order.length]
            dispatch({ type: 'ui/setProcgenDebugOverlay', mode: next })
          }}
          title="Cycle floor tint overlay in the 3D view (districts → room function → mission nodes → off)"
          style={{
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(0,0,0,0.28)',
            color: 'rgba(255,255,255,0.86)',
            borderRadius: 10,
            padding: '6px 10px',
            fontFamily: 'var(--mono)',
            fontSize: 11,
          }}
        >
          Proc overlay: {state.ui.procgenDebugOverlay ?? 'off'}
        </button>
        <button
          type="button"
          onClick={dumpFloorGen}
          title="Download the canonical procgen output (floor.gen) as JSON"
          style={{
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(0,0,0,0.28)',
            color: 'rgba(255,255,255,0.86)',
            borderRadius: 10,
            padding: '6px 10px',
            fontFamily: 'var(--mono)',
            fontSize: 11,
          }}
        >
          Dump floor.gen ({dumpTick ? 'ok' : 'json'})
        </button>
      </div>

      <input
        className={styles.search}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search… (will matter later)"
      />

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

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Camera</div>
        {visibleCamera.map((s) => {
          const v = state.render[s.key]
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
                onChange={(e) => dispatch({ type: 'render/set', key: s.key, value: Number(e.target.value) })}
              />
            </div>
          )
        })}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Portrait</div>
        {visiblePortrait.map((s) => {
          const v = state.render[s.key]
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
                onChange={(e) => dispatch({ type: 'render/set', key: s.key, value: Number(e.target.value) })}
              />
            </div>
          )
        })}
      </div>

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
          const v = state.render[s.key]
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
                onChange={(e) => dispatch({ type: 'render/set', key: s.key, value: Number(e.target.value) })}
              />
            </div>
          )
        })}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>NPCs</div>
        {visibleNpc.map((s) => {
          const v = state.render[s.key]
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
                onChange={(e) => dispatch({ type: 'render/set', key: s.key, value: Number(e.target.value) })}
              />
            </div>
          )
        })}
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

