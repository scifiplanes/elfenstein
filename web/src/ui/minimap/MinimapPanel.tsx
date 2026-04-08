import type { ReactNode } from 'react'
import type { GameState } from '../../game/types'
import styles from './MinimapPanel.module.css'

const MINIMAP_VIEW_W = 10
const MINIMAP_VIEW_H = 10
/** Edge length of one minimap cell in CSS px (grid tracks + `.cell` size). */
const MINIMAP_CELL_PX = 14

export function MinimapPanel(props: { state: GameState }) {
  const { state } = props
  const { w, h, tiles, playerPos, playerDir, pois } = state.floor
  const poiSet = new Set(pois.map((p) => `${p.pos.x},${p.pos.y}`))

  const vw = Math.min(MINIMAP_VIEW_W, w)
  const vh = Math.min(MINIMAP_VIEW_H, h)
  const maxOx = Math.max(0, w - vw)
  const maxOy = Math.max(0, h - vh)
  const originX = Math.max(0, Math.min(playerPos.x - Math.floor(vw / 2), maxOx))
  const originY = Math.max(0, Math.min(playerPos.y - Math.floor(vh / 2), maxOy))

  const cells: ReactNode[] = []
  for (let dy = 0; dy < vh; dy++) {
    for (let dx = 0; dx < vw; dx++) {
      const x = originX + dx
      const y = originY + dy
      const i = y * w + x
      const t = tiles[i]
      const key = `${x},${y}`
      const isPlayer = x === playerPos.x && y === playerPos.y
      const isPoi = poiSet.has(key)
      const kind = isPlayer ? 'player' : isPoi ? 'poi' : t
      cells.push(
        <div
          key={key}
          className={styles.cell}
          data-kind={kind}
          data-dir={isPlayer ? playerDir : undefined}
        />,
      )
    }
  }

  return (
    <div className={styles.root}>
      <div
        className={styles.map}
        style={{
          ['--minimap-cell' as string]: `${MINIMAP_CELL_PX}px`,
          gridTemplateColumns: `repeat(${vw}, ${MINIMAP_CELL_PX}px)`,
          gridTemplateRows: `repeat(${vh}, ${MINIMAP_CELL_PX}px)`,
        }}
      >
        {cells}
      </div>
    </div>
  )
}
