import { type Dispatch, useMemo, useState } from 'react'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import { useCursor } from '../cursor/useCursor'
import styles from './DebugPanel.module.css'

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
      { key: 'fogDensity', label: 'FogExp2 density', min: 0, max: 0.3, step: 0.001, format: (v) => v.toFixed(3) },
      { key: 'ditherStrength', label: 'Dither strength', min: 0, max: 1, step: 0.01 },
      { key: 'ditherColourPreserve', label: 'Dither colourPreserve', min: 0, max: 1, step: 0.01 },
      { key: 'ditherPixelSize', label: 'Dither pixelSize', min: 1, max: 6, step: 1 },
      { key: 'ditherLevels', label: 'Dither levels', min: 2, max: 24, step: 1 },
      { key: 'ditherMatrixSize', label: 'Dither matrix', min: 2, max: 8, step: 2 },
      { key: 'ditherPalette', label: 'Palette (0-4)', min: 0, max: 4, step: 1 },
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

  if (!state.ui.debugOpen) return null

  const q = query.trim().toLowerCase()
  const visibleCamera = q ? cameraSliders.filter((s) => `${s.label} ${s.key}`.toLowerCase().includes(q)) : cameraSliders
  const visiblePortrait = q ? portraitSliders.filter((s) => `${s.label} ${s.key}`.toLowerCase().includes(q)) : portraitSliders
  const visibleRender = q ? renderSliders.filter((s) => `${s.label} ${s.key}`.toLowerCase().includes(q)) : renderSliders
  const visibleAudio = q ? audioSliders.filter((s) => `${s.label} ${s.key}`.toLowerCase().includes(q)) : audioSliders

  return (
    <div
      className={styles.root}
      onPointerMove={cursor.onPointerMove}
      onPointerUp={cursor.endPointerUp}
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
      </div>

      <input
        className={styles.search}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search… (will matter later)"
      />

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

