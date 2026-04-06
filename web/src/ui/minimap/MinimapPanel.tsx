import type { GameState } from '../../game/types'
import styles from './MinimapPanel.module.css'

export function MinimapPanel(props: { state: GameState }) {
  const { state } = props
  const { w, h, tiles, playerPos, pois } = state.floor
  const poiSet = new Set(pois.map((p) => `${p.pos.x},${p.pos.y}`))

  return (
    <div className={styles.root}>
      <div className={styles.map} style={{ gridTemplateColumns: `repeat(${w}, 10px)`, gridTemplateRows: `repeat(${h}, 10px)` }}>
        {tiles.map((t, i) => {
          const x = i % w
          const y = Math.floor(i / w)
          const key = `${x},${y}`
          const isPlayer = x === playerPos.x && y === playerPos.y
          const isPoi = poiSet.has(key)
          const kind = isPlayer ? 'player' : isPoi ? 'poi' : t
          return <div key={i} className={styles.cell} data-kind={kind} />
        })}
      </div>
    </div>
  )
}

