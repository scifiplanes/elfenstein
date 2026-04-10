import { type Dispatch, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Action } from '../../game/reducer'
import { BOBR_INTRO_TOTAL_MS } from '../../game/bobrIntroMs'
import type { GameState } from '../../game/types'
import { useTitleCutscenePortalEl } from './TitleCutscenePortalContext'
import styles from './TitleScreen.module.css'

const BOBR_INTRO_SRC = '/content/npc_bobr.png'

/** Full-screen Bobr intro above the presenter; hub already runs underneath (**ADR-0328**). */
export function BobrIntroPortal(props: { state: GameState; dispatch: Dispatch<Action> }) {
  const { state, dispatch } = props
  const titleCutsceneMountEl = useTitleCutscenePortalEl()
  const until = state.ui.bobrIntroUntilMs
  const active = until != null && state.nowMs < until
  const introEndOnceRef = useRef(false)

  const onEnd = useCallback(() => {
    if (introEndOnceRef.current) return
    introEndOnceRef.current = true
    dispatch({ type: 'ui/dismissBobrIntro' })
  }, [dispatch])

  useEffect(() => {
    if (!active) return
    introEndOnceRef.current = false
    const t = window.setTimeout(onEnd, BOBR_INTRO_TOTAL_MS)
    return () => window.clearTimeout(t)
  }, [active, until, onEnd])

  if (!active || !titleCutsceneMountEl) return null

  return createPortal(
    <div className={styles.introOverlay} aria-hidden="true">
      <img className={styles.introSprite} src={BOBR_INTRO_SRC} alt="" onAnimationEnd={onEnd} />
    </div>,
    titleCutsceneMountEl,
  )
}
