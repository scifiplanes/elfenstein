import type { GameState } from '../../game/types'
import styles from './ActivityLog.module.css'

const VISIBLE_ROW_CAP = 4

export function ActivityLog(props: { entries: NonNullable<GameState['ui']['activityLog']> }) {
  const { entries } = props
  const visible = entries.length <= VISIBLE_ROW_CAP ? entries : entries.slice(-VISIBLE_ROW_CAP)

  if (!visible.length) return null

  return (
    <div className={styles.wrap} aria-label="Activity log">
      <div className={styles.scroller} role="log" aria-live="polite" aria-relevant="additions">
        {visible.map((e) => (
          <div key={e.id} className={styles.line}>
            {e.text}
          </div>
        ))}
      </div>
    </div>
  )
}
