import type { Dispatch } from 'react'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import popup from '../shared/GamePopup.module.css'
import styles from './DeathModal.module.css'

function fmtMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export function DeathModal(props: { state: GameState; dispatch: Dispatch<Action> }) {
  const { state, dispatch } = props
  const death = state.ui.death
  if (!death) return null

  const elapsedMs = Math.max(0, death.atMs - state.run.startedAtMs)
  const floorLabel = `F${death.floorIndex + 1}`
  const levelLabel = `L${death.level}`
  const log = state.ui.activityLog ?? []
  const recent = log.slice(Math.max(0, log.length - 6))
  const hasCheckpoint = !!state.run.checkpoint

  return (
    <div className={`${styles.backdrop} ${popup.backdropDim}`}>
      <div
        className={`${popup.panel} ${popup.panelWidthMd} ${styles.modal}`}
        role="dialog"
        aria-modal="true"
        aria-label="Death screen"
      >
        <div className={`${popup.title} ${styles.title}`}>You died</div>
        <div className={`${popup.sub} ${styles.sub}`}>This run is over.</div>

        <div className={styles.stats}>
          <div className={styles.statLabel}>Run</div>
          <div className={styles.statValue}>{death.runId}</div>
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
          <button className={popup.actionBtn} type="button" onClick={() => dispatch({ type: 'ui/goTitle' })}>
            Title
          </button>
          <button
            className={`${popup.actionBtn} ${!hasCheckpoint ? popup.actionBtnDisabled : ''}`}
            type="button"
            disabled={!hasCheckpoint}
            onClick={() => dispatch({ type: 'run/reloadCheckpoint' })}
            title={hasCheckpoint ? 'Reload the last well checkpoint' : 'No checkpoint saved yet'}
          >
            Reload checkpoint
          </button>
          <button
            className={`${popup.actionBtn} ${popup.actionBtnPrimary}`}
            type="button"
            onClick={() => dispatch({ type: 'run/new' })}
          >
            New run
          </button>
        </div>
      </div>
    </div>
  )
}

