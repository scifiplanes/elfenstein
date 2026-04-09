import type { Dispatch } from 'react'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import popup from '../shared/GamePopup.module.css'
import styles from './TitleScreen.module.css'

export function TitleScreen(props: { state: GameState; dispatch: Dispatch<Action> }) {
  const { state, dispatch } = props
  if (state.ui.screen !== 'title') return null

  const hasCheckpoint = !!state.run.checkpoint

  return (
    <div className={`${styles.backdrop} ${popup.backdropDim}`}>
      <div
        className={`${popup.panel} ${popup.panelWidthMd} ${styles.modal}`}
        role="dialog"
        aria-modal="true"
        aria-label="Title screen"
      >
        <div className={`${popup.title} ${styles.title}`}>Elfenstein</div>
        <div className={`${popup.sub} ${styles.sub}`}>A small dungeon experiment.</div>

        <div className={popup.footer}>
          {hasCheckpoint ? (
            <button className={popup.actionBtn} type="button" onClick={() => dispatch({ type: 'run/reloadCheckpoint' })}>
              Continue
            </button>
          ) : null}
          <button className={`${popup.actionBtn} ${popup.actionBtnPrimary}`} type="button" onClick={() => dispatch({ type: 'run/new' })}>
            New run
          </button>
        </div>
      </div>
    </div>
  )
}

