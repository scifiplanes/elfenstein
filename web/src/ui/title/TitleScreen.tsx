import type { Dispatch } from 'react'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import { quitApplication } from '../settings/quitApplication'
import { CURSOR_HAND_ACTIVE_ATTR } from '../cursor/cursorHandActiveAttr'
import popup from '../shared/GamePopup.module.css'
import styles from './TitleScreen.module.css'

export type TitleScreenVariant = 'interactive' | 'capture'

export function TitleScreen(props: {
  state: GameState
  dispatch: Dispatch<Action>
  variant?: TitleScreenVariant
}) {
  const { state, dispatch, variant = 'interactive' } = props
  if (state.ui.screen !== 'title') return null

  const hasCheckpoint = !!state.run.checkpoint

  const tree = (
    <div className={styles.root} role="dialog" aria-modal="true" aria-label="Title screen">
      <div className={styles.topBlock}>
        <div className={`${popup.title} ${styles.title}`}>Elfenstein</div>
        <div className={`${popup.sub} ${styles.sub}`}>A small dungeon experiment.</div>
      </div>

      <div className={styles.bottomBlock}>
        <div className={styles.footerPanel}>
          <div className={popup.footer}>
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
              onClick={() => dispatch({ type: 'run/new' })}
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
    </div>
  )

  return tree
}
