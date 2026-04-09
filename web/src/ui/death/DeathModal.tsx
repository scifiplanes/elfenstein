import type { Dispatch } from 'react'
import { useRef } from 'react'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import {
  MODAL_CHROME_HIT_ATTR,
  modalChromeClickActivate,
  modalChromePointerUpActivate,
} from '../cursor/modalChromeActivate'
import { useCursor } from '../cursor/useCursor'
import popup from '../shared/GamePopup.module.css'
import styles from './DeathModal.module.css'

function fmtMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export type DeathModalVariant = 'interactive' | 'capture'

export function DeathModal(props: {
  state: GameState
  dispatch: Dispatch<Action>
  variant?: DeathModalVariant
}) {
  const { state, dispatch, variant = 'interactive' } = props
  const cursor = useCursor()
  const suppressReloadClick = useRef(false)
  const suppressNewRunClick = useRef(false)

  const death = state.ui.death
  const preview =
    !death && Boolean(state.ui.debugShowDeathPopup) && state.ui.screen === 'game'
  const visible = Boolean(death) || Boolean(preview)

  if (!visible) return null

  const deathData =
    death ??
    ({ atMs: state.nowMs, runId: state.run.runId, floorIndex: state.floor.floorIndex, level: state.run.level } as const)

  const elapsedMs = Math.max(0, deathData.atMs - state.run.startedAtMs)
  const floorLabel = `F${deathData.floorIndex + 1}`
  const levelLabel = `L${deathData.level}`
  const log = state.ui.activityLog ?? []
  const recent = log.slice(Math.max(0, log.length - 6))
  const hasCheckpoint = !!state.run.checkpoint

  const pointerHandlers =
    variant === 'interactive'
      ? {
          onPointerMove: cursor.onPointerMove,
          onPointerCancel: cursor.cancelDrag,
        }
      : {}

  const inner = (
    <div className={`${styles.backdrop} ${popup.backdropDim}`}>
      <div
        className={`${popup.panel} ${popup.panelWidthMd} ${styles.modal}`}
        role="dialog"
        aria-modal="true"
        aria-label="Death screen"
      >
        <div className={styles.title}>You died</div>
        <div className={styles.epitaph}>
          <p className={styles.epitaphBody}>
            Your eyes slowly close, as your mind drifts into an endless sleep. Your last breath, drawn deep within the
            bowels of Elfenstein, marks the quiet end of your adventure. Your physical form, now hollow and soulless,
            becomes one with the earth beneath you — surrendered, at last, to Elfenstein itself.
          </p>
          <p className={styles.epitaphCoda}>Forever...</p>
        </div>

        <div className={styles.stats}>
          <div className={styles.statLabel}>Run</div>
          <div className={styles.statValue}>{deathData.runId}</div>
          <div className={styles.statLabel}>Progress</div>
          <div className={styles.statValue}>
            {floorLabel} · {levelLabel}
          </div>
          <div className={styles.statLabel}>Time</div>
          <div className={styles.statValue}>{fmtMs(elapsedMs)}</div>
          <div className={styles.statLabel}>Checkpoint</div>
          <div className={styles.statValue}>{hasCheckpoint ? 'Well' : '—'}</div>
        </div>

        {recent.length ? (
          <div className={styles.log}>
            {recent.map((x) => (
              <div key={x.id} className={styles.logLine}>
                {x.text}
              </div>
            ))}
          </div>
        ) : null}

        <div className={popup.footer}>
          <button
            className={`${popup.actionBtn} ${styles.deathActionBtn} ${!hasCheckpoint ? popup.actionBtnDisabled : ''}`}
            type="button"
            {...{ [MODAL_CHROME_HIT_ATTR]: '' }}
            aria-disabled={!hasCheckpoint}
            tabIndex={!hasCheckpoint ? -1 : 0}
            onPointerUp={(e) =>
              modalChromePointerUpActivate(
                cursor,
                e,
                () => {
                  if (!hasCheckpoint) return
                  dispatch({ type: 'run/reloadCheckpoint' })
                },
                suppressReloadClick,
              )
            }
            onClick={(e) =>
              modalChromeClickActivate(
                e,
                () => {
                  if (!hasCheckpoint) return
                  dispatch({ type: 'run/reloadCheckpoint' })
                },
                suppressReloadClick,
              )
            }
            title={hasCheckpoint ? 'Reload the last well checkpoint' : 'No checkpoint saved yet'}
          >
            Reload checkpoint
          </button>
          <button
            className={`${popup.actionBtn} ${styles.deathActionBtn} ${popup.actionBtnPrimary}`}
            type="button"
            {...{ [MODAL_CHROME_HIT_ATTR]: '' }}
            onPointerUp={(e) =>
              modalChromePointerUpActivate(cursor, e, () => dispatch({ type: 'run/new' }), suppressNewRunClick)
            }
            onClick={(e) => modalChromeClickActivate(e, () => dispatch({ type: 'run/new' }), suppressNewRunClick)}
          >
            New run
          </button>
        </div>
      </div>
    </div>
  )

  if (variant === 'capture') {
    return inner
  }

  return <div {...pointerHandlers}>{inner}</div>
}
