import type { Dispatch } from 'react'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import styles from './NavigationPanel.module.css'

export function NavigationPanel(props: { state: GameState; dispatch: Dispatch<Action> }) {
  const { state, dispatch } = props
  const busy = Boolean(state.view.anim)

  return (
    <div className={styles.root}>
      <div className={styles.hint}>
        <strong>Keyboard</strong>
        <ul className={styles.list}>
          <li>
            <kbd>W</kbd> / <kbd>S</kbd> (or <kbd>↑</kbd> <kbd>↓</kbd>) — forward / back
          </li>
          <li>
            <kbd>A</kbd> / <kbd>D</kbd> — strafe left / right
          </li>
          <li>
            <kbd>Q</kbd> / <kbd>E</kbd> — turn left / right
          </li>
          <li>
            <kbd>F2</kbd> — debug panel
          </li>
        </ul>
        <p className={styles.note}>Click POIs, items, NPCs, and doors in the 3D view. Clicking a door tries to step into it (open/unlock).</p>
        {busy ? <p className={styles.busy}>Wait for move/turn to finish.</p> : null}
      </div>
      <div className={styles.pad} aria-label="On-screen movement">
        <div className={styles.padRow}>
          <span className={styles.padCell} />
          <button type="button" className={styles.padBtn} disabled={busy} onClick={() => dispatch({ type: 'player/step', forward: 1 })} title="Forward (W)">
            ↑
          </button>
          <span className={styles.padCell} />
        </div>
        <div className={styles.padRow}>
          <button type="button" className={styles.padBtn} disabled={busy} onClick={() => dispatch({ type: 'player/turn', dir: -1 })} title="Turn left (Q)">
            ↺
          </button>
          <button type="button" className={styles.padBtn} disabled={busy} onClick={() => dispatch({ type: 'player/step', forward: -1 })} title="Back (S)">
            ↓
          </button>
          <button type="button" className={styles.padBtn} disabled={busy} onClick={() => dispatch({ type: 'player/turn', dir: 1 })} title="Turn right (E)">
            ↻
          </button>
        </div>
        <div className={styles.padRow}>
          <button type="button" className={styles.padBtn} disabled={busy} onClick={() => dispatch({ type: 'player/strafe', side: -1 })} title="Strafe left (A)">
            ◀
          </button>
          <span className={styles.padCell} />
          <button type="button" className={styles.padBtn} disabled={busy} onClick={() => dispatch({ type: 'player/strafe', side: 1 })} title="Strafe right (D)">
            ▶
          </button>
        </div>
      </div>
    </div>
  )
}
