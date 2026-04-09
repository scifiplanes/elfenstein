import type { Dispatch, RefObject } from 'react'
import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import { useCursor } from '../cursor/useCursor'
import popup from '../shared/GamePopup.module.css'
import styles from './DeathModal.module.css'

function fmtMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

type GameViewportRect = { left: number; top: number; width: number; height: number }

export type DeathModalVariant = 'interactive' | 'capture'

export function DeathModal(props: {
  state: GameState
  dispatch: Dispatch<Action>
  variant?: DeathModalVariant
  /** Interactive: align dim + panel to the live 3D viewport rect (`FixedStageViewport` scale-safe). */
  gameViewportRef?: RefObject<HTMLDivElement | null>
}) {
  const { state, dispatch, variant = 'interactive', gameViewportRef } = props
  const [viewportRect, setViewportRect] = useState<GameViewportRect | null>(null)
  const cursor = useCursor()

  const death = state.ui.death
  const preview =
    !death && Boolean(state.ui.debugShowDeathPopup) && state.ui.screen === 'game'
  const visible = Boolean(death) || Boolean(preview)

  useLayoutEffect(() => {
    if (variant !== 'interactive' || !visible) {
      setViewportRect(null)
      return
    }
    const el = gameViewportRef?.current
    if (!el) {
      setViewportRect(null)
      return
    }
    const sync = () => {
      const r = el.getBoundingClientRect()
      setViewportRect({ left: r.left, top: r.top, width: r.width, height: r.height })
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    window.addEventListener('resize', sync)
    window.visualViewport?.addEventListener('resize', sync)
    window.visualViewport?.addEventListener('scroll', sync)
    window.addEventListener('scroll', sync, true)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', sync)
      window.visualViewport?.removeEventListener('resize', sync)
      window.visualViewport?.removeEventListener('scroll', sync)
      window.removeEventListener('scroll', sync, true)
    }
  }, [variant, gameViewportRef, visible])

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
            disabled={!hasCheckpoint}
            onClick={() => dispatch({ type: 'run/reloadCheckpoint' })}
            title={hasCheckpoint ? 'Reload the last well checkpoint' : 'No checkpoint saved yet'}
          >
            Reload checkpoint
          </button>
          <button
            className={`${popup.actionBtn} ${styles.deathActionBtn} ${popup.actionBtnPrimary}`}
            type="button"
            onClick={() => dispatch({ type: 'run/new' })}
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

  const shell =
    viewportRect != null ? (
      <div
        className={styles.gameViewportShell}
        style={{
          left: viewportRect.left,
          top: viewportRect.top,
          width: viewportRect.width,
          height: viewportRect.height,
        }}
        {...pointerHandlers}
      >
        {inner}
      </div>
    ) : (
      <div className={`${styles.gameViewportShell} ${styles.gameViewportShellFallback}`} {...pointerHandlers}>
        {inner}
      </div>
    )

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(<div className={popup.modalPortalHitRoot}>{shell}</div>, document.body)
  }
  return shell
}
