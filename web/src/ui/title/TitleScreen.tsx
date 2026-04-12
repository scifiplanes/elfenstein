import type { Dispatch } from 'react'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import { quitApplication } from '../settings/quitApplication'
import { CURSOR_HAND_ACTIVE_ATTR } from '../cursor/cursorHandActiveAttr'
import popup from '../shared/GamePopup.module.css'
import styles from './TitleScreen.module.css'

export type TitleScreenVariant = 'interactive' | 'capture'

const TITLE_LOGO_SRC = '/content/ui/ui_logo.png'

export function TitleScreen(props: {
  state: GameState
  dispatch: Dispatch<Action>
  variant?: TitleScreenVariant
  /** When `false` and `variant === 'interactive'`, show tap-to-unlock audio before the main menu. */
  titleAudioPrimed?: boolean
  onPrimeTitleAudio?: () => void
}) {
  const { state, dispatch, variant = 'interactive', titleAudioPrimed, onPrimeTitleAudio } = props

  if (state.ui.screen !== 'title') return null

  const hasCheckpoint = !!state.run.checkpoint
  const interactive = variant === 'interactive'
  const showAudioGate = interactive && titleAudioPrimed === false

  const primeAudio = () => {
    onPrimeTitleAudio?.()
  }

  const tree = (
    <div
      className={styles.root}
      role="dialog"
      aria-modal="true"
      aria-label="Title screen"
    >
      {showAudioGate ? (
        <button
          type="button"
          className={styles.audioGate}
          autoFocus
          {...{ [CURSOR_HAND_ACTIVE_ATTR]: '' }}
          onPointerDown={() => {
            primeAudio()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              primeAudio()
            }
          }}
        >
          <span className={styles.audioGateTitle}>Tap to start</span>
          <span className={`${popup.sub} ${styles.audioGateSub}`}>Press anywhere · Enter or Space also works</span>
        </button>
      ) : (
        <>
          <div className={styles.centerBlock}>
            <img className={styles.logo} src={TITLE_LOGO_SRC} alt="Elfenstein" draggable={false} />
            <div className={`${popup.sub} ${styles.sub}`}>Copyright 1995-2026 Mafra Studios</div>
          </div>

          <div className={styles.bottomBlock}>
            <div className={styles.footerPanel}>
              <div className={`${popup.footer} ${styles.titleMenuFooter}`}>
                {hasCheckpoint ? (
                  <button
                    className={popup.actionBtn}
                    type="button"
                    {...{ [CURSOR_HAND_ACTIVE_ATTR]: '' }}
                    onClick={() => dispatch({ type: 'run/reloadCheckpoint' })}
                  >
                    Continue
                  </button>
                ) : null}
                <button
                  className={`${popup.actionBtn} ${popup.actionBtnPrimary}`}
                  type="button"
                  {...{ [CURSOR_HAND_ACTIVE_ATTR]: '' }}
                  onClick={() =>
                    interactive ? dispatch({ type: 'run/new', playBobrIntro: true }) : dispatch({ type: 'run/new' })
                  }
                >
                  Start
                </button>
                <button
                  className={popup.actionBtn}
                  type="button"
                  {...{ [CURSOR_HAND_ACTIVE_ATTR]: '' }}
                  onClick={() => quitApplication()}
                >
                  Quit
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )

  return tree
}
