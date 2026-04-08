import type { Dispatch } from 'react'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import styles from './TitleScreen.module.css'

export function TitleScreen(props: { state: GameState; dispatch: Dispatch<Action> }) {
  const { state, dispatch } = props
  if (state.ui.screen !== 'title') return null

  const hasCheckpoint = !!state.run.checkpoint

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Title screen">
        <div className={styles.title}>Elfenstein</div>
        <div className={styles.sub}>A small dungeon experiment.</div>

        <div className={styles.footer}>
          {hasCheckpoint ? (
            <button className={styles.btn} type="button" onClick={() => dispatch({ type: 'run/reloadCheckpoint' })}>
              Continue
            </button>
          ) : null}
          <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={() => dispatch({ type: 'run/new' })}>
            New run
          </button>
        </div>
      </div>
    </div>
  )
}

