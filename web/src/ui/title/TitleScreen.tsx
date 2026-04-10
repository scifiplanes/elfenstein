import { type Dispatch, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import { quitApplication } from '../settings/quitApplication'
import { CURSOR_HAND_ACTIVE_ATTR } from '../cursor/cursorHandActiveAttr'
import popup from '../shared/GamePopup.module.css'
import { useTitleCutscenePortalEl } from './TitleCutscenePortalContext'
import styles from './TitleScreen.module.css'

export type TitleScreenVariant = 'interactive' | 'capture'

const BOBR_INTRO_SRC = '/content/npc_bobr.png'
const TITLE_LOGO_SRC = '/content/ui/ui_logo.png'
/** Must match `TitleScreen.module.css` `bobrIntroOpacity` duration (0.3 + 3 + 2 + 3 + 0.3 s). */
const BOBR_INTRO_TOTAL_MS = 8600

export function TitleScreen(props: {
  state: GameState
  dispatch: Dispatch<Action>
  variant?: TitleScreenVariant
}) {
  const { state, dispatch, variant = 'interactive' } = props
  const [introPlaying, setIntroPlaying] = useState(false)
  const introEndOnceRef = useRef(false)
  const titleCutscenePortalEl = useTitleCutscenePortalEl()

  useEffect(() => {
    if (state.ui.screen !== 'title') setIntroPlaying(false)
  }, [state.ui.screen])

  const onBobrIntroEnd = useCallback(() => {
    if (introEndOnceRef.current) return
    introEndOnceRef.current = true
    dispatch({ type: 'run/new' })
    setIntroPlaying(false)
  }, [dispatch])

  /** Some engines omit `animationend` on `<img>` opacity animations; match the CSS timeline. */
  useEffect(() => {
    if (!introPlaying || variant !== 'interactive') return
    const t = window.setTimeout(onBobrIntroEnd, BOBR_INTRO_TOTAL_MS)
    return () => window.clearTimeout(t)
  }, [introPlaying, variant, onBobrIntroEnd])

  if (state.ui.screen !== 'title') return null

  const hasCheckpoint = !!state.run.checkpoint
  const interactive = variant === 'interactive'
  const chromeDisabled = interactive && introPlaying

  const onStart = () => {
    if (!interactive) return
    if (introPlaying) return
    introEndOnceRef.current = false
    setIntroPlaying(true)
  }

  const tree = (
    <div
      className={styles.root}
      role="dialog"
      aria-modal="true"
      aria-label="Title screen"
      aria-busy={chromeDisabled || undefined}
    >
      <div className={styles.centerBlock}>
        <img className={styles.logo} src={TITLE_LOGO_SRC} alt="Elfenstein" draggable={false} />
        <div className={`${popup.sub} ${styles.sub}`}>Copyright 1995-2026 Mafra Studios</div>
      </div>

      <div className={styles.bottomBlock}>
        <div className={styles.footerPanel}>
          <div className={popup.footer}>
            {hasCheckpoint ? (
              <button
                className={popup.actionBtn}
                type="button"
                disabled={chromeDisabled}
                {...{ [CURSOR_HAND_ACTIVE_ATTR]: '' }}
                onClick={() => dispatch({ type: 'run/reloadCheckpoint' })}
              >
                Continue
              </button>
            ) : null}
            <button
              className={`${popup.actionBtn} ${popup.actionBtnPrimary}`}
              type="button"
              disabled={chromeDisabled}
              {...{ [CURSOR_HAND_ACTIVE_ATTR]: '' }}
              onClick={() => (interactive ? onStart() : dispatch({ type: 'run/new' }))}
            >
              Start
            </button>
            <button
              className={popup.actionBtn}
              type="button"
              disabled={chromeDisabled}
              {...{ [CURSOR_HAND_ACTIVE_ATTR]: '' }}
              onClick={() => quitApplication()}
            >
              Quit
            </button>
          </div>
        </div>
      </div>

    </div>
  )

  const visibleIntro =
    interactive && introPlaying && titleCutscenePortalEl
      ? createPortal(
          <div
            className={styles.introOverlay}
            aria-hidden="true"
            onPointerDown={(e) => {
              if (e.button !== 0) return
              onBobrIntroEnd()
            }}
          >
            <img
              className={styles.introSprite}
              src={BOBR_INTRO_SRC}
              alt=""
              onAnimationEnd={onBobrIntroEnd}
            />
          </div>,
          titleCutscenePortalEl,
        )
      : null

  return (
    <>
      {visibleIntro}
      {tree}
    </>
  )
}
