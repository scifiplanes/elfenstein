import type { ReactNode } from 'react'
import type { GameState } from '../../game/types'
import styles from './MinimapPanel.module.css'

/** Include floor cells with integer distance from player ≤ this (Euclidean, grid steps). */
const MINIMAP_RADIUS_UNITS = 3
/** Virtual grid span for layout: (2R+1) per axis; only in-bounds + in-disk tiles are rendered. */
const MINIMAP_SIDE = MINIMAP_RADIUS_UNITS * 2 + 1
const MINIMAP_R2 = MINIMAP_RADIUS_UNITS * MINIMAP_RADIUS_UNITS

/** Edge length of one minimap cell in CSS px (grid tracks + `.cell` size). */
const MINIMAP_CELL_PX = 22.5
/** Tight gap reads as chunky “pixel” tiles inside the circle. */
const MINIMAP_GAP_PX = 2.5

export function MinimapPanel(props: { state: GameState }) {
  const { state } = props
  const { w, h, tiles, playerPos, playerDir, pois } = state.floor
  const poiSet = new Set(pois.map((p) => `${p.pos.x},${p.pos.y}`))

  const step = MINIMAP_CELL_PX + MINIMAP_GAP_PX
  const mapPx = MINIMAP_SIDE * MINIMAP_CELL_PX + (MINIMAP_SIDE - 1) * MINIMAP_GAP_PX

  const cells: ReactNode[] = []
  for (let dy = -MINIMAP_RADIUS_UNITS; dy <= MINIMAP_RADIUS_UNITS; dy++) {
    for (let dx = -MINIMAP_RADIUS_UNITS; dx <= MINIMAP_RADIUS_UNITS; dx++) {
      if (dx * dx + dy * dy > MINIMAP_R2) continue

      const wx = playerPos.x + dx
      const wy = playerPos.y + dy
      const inFloor = wx >= 0 && wx < w && wy >= 0 && wy < h
      if (!inFloor) continue

      const key = `${wx},${wy}`
      const isPlayer = dx === 0 && dy === 0
      const isPoi = poiSet.has(key)
      const t = tiles[wy * w + wx]
      const kind = isPlayer ? 'player' : isPoi ? 'poi' : t
      const col = dx + MINIMAP_RADIUS_UNITS
      const row = dy + MINIMAP_RADIUS_UNITS

      cells.push(
        <div
          key={key}
          className={styles.cell}
          data-kind={kind}
          data-dir={isPlayer ? playerDir : undefined}
          style={{ left: col * step, top: row * step }}
        />,
      )
    }
  }

  const track = `${MINIMAP_CELL_PX}px`
  const gap = `${MINIMAP_GAP_PX}px`

  return (
    <div className={styles.root}>
      <div className={styles.circleFrame} aria-hidden={true}>
        <div
          className={styles.map}
          style={{
            ['--minimap-cell' as string]: track,
            ['--minimap-gap' as string]: gap,
            width: `${mapPx}px`,
            height: `${mapPx}px`,
          }}
        >
          {cells}
        </div>
      </div>
    </div>
  )
}
