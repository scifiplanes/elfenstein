import type { Dispatch, PointerEvent } from 'react'
import type { Action } from '../../game/reducer'
import type { GameState, GpuTier } from '../../game/types'
import { CURSOR_HAND_ACTIVE_ATTR } from '../cursor/cursorHandActiveAttr'
import popup from '../shared/GamePopup.module.css'
import styles from './SettingsMenu.module.css'

export type SettingsMenuVariant = 'interactive' | 'capture'

export function SettingsMenu(props: {
  state: GameState
  dispatch: Dispatch<Action>
  variant?: SettingsMenuVariant
}) {
  const { state, dispatch, variant = 'interactive' } = props
  if (!state.ui.settingsOpen) return null

  const onBackdropPointerDown = (e: PointerEvent) => {
    if (e.target === e.currentTarget) dispatch({ type: 'ui/setSettingsOpen', open: false })
  }

  const tree = (
    <div
      className={`${styles.backdrop} ${popup.backdropDim}`}
      onPointerDown={variant === 'interactive' ? onBackdropPointerDown : undefined}
    >
      <div
        className={`${popup.panel} ${popup.panelWidthMd} ${styles.modal}`}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onPointerDown={variant === 'interactive' ? (e) => e.stopPropagation() : undefined}
      >
        <div className={`${popup.title} ${styles.title}`}>Settings</div>

        <div className={styles.sliderRow}>
          <span className={styles.sliderLabel}>Music</span>
          <span className={styles.sliderValue}>{Math.round(state.audio.masterMusic * 100)}%</span>
          <input
            className={styles.slider}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={state.audio.masterMusic}
            aria-label="Music volume"
            onChange={(e) =>
              dispatch({ type: 'audio/set', key: 'masterMusic', value: Number(e.target.value) })
            }
          />
        </div>
        <div className={styles.sliderRow}>
          <span className={styles.sliderLabel}>Sound effects</span>
          <span className={styles.sliderValue}>{Math.round(state.audio.masterSfx * 100)}%</span>
          <input
            className={styles.slider}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={state.audio.masterSfx}
            aria-label="Sound effects volume"
            onChange={(e) =>
              dispatch({ type: 'audio/set', key: 'masterSfx', value: Number(e.target.value) })
            }
          />
        </div>

        <div className={styles.sliderRow}>
          <span className={styles.sliderLabel}>Graphics quality</span>
          <span className={styles.sliderValue}>
            {state.render.gpuTier === 'custom' ? 'Custom' : state.render.gpuTier}
          </span>
          <select
            className={styles.select}
            aria-label="Graphics quality"
            value={state.render.gpuTier}
            onChange={(e) => {
              const v = e.target.value as GpuTier
              if (v === 'low' || v === 'balanced' || v === 'high') {
                dispatch({ type: 'render/setGpuTier', tier: v })
              }
            }}
          >
            <option value="low">Low</option>
            <option value="balanced">Balanced</option>
            <option value="high">High</option>
            <option value="custom" disabled={state.render.gpuTier !== 'custom'}>
              Custom (F2 debug)
            </option>
          </select>
        </div>

        <div className={styles.divider} />

        <div className={popup.footer}>
          <button
            className={popup.actionBtn}
            type="button"
            {...{ [CURSOR_HAND_ACTIVE_ATTR]: '' }}
            onClick={() => dispatch({ type: 'ui/setSettingsOpen', open: false })}
          >
            Resume
          </button>
          <button
            className={popup.actionBtn}
            type="button"
            {...{ [CURSOR_HAND_ACTIVE_ATTR]: '' }}
            onClick={() => dispatch({ type: 'run/new' })}
          >
            Restart run
          </button>
          <button
            className={popup.actionBtn}
            type="button"
            {...{ [CURSOR_HAND_ACTIVE_ATTR]: '' }}
            onClick={() => dispatch({ type: 'ui/goTitle' })}
          >
            Quit to main menu
          </button>
        </div>
      </div>
    </div>
  )

  return tree
}
