import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GameState } from '../../game/types'
import minimapStyles from '../minimap/MinimapPanel.module.css'
import styles from './DebugMinimapModal.module.css'

/** Matches `DebugPanel.module.css` (.root): `right: 14px` + `width: 360px` + outer gap. */
const DEBUG_PANEL_LANE_PX = 14 + 360 + 14

function fitCellPx(w: number, h: number): number {
  if (typeof window === 'undefined') return 10
  const maxW = Math.max(120, window.innerWidth - DEBUG_PANEL_LANE_PX) * 0.88
  const maxH = window.innerHeight * 0.58
  const gap = 2
  const cw = (maxW - (w - 1) * gap) / w
  const ch = (maxH - (h - 1) * gap) / h
  return Math.max(4, Math.min(22, Math.floor(Math.min(cw, ch))))
}

export function DebugMinimapModal(props: { state: GameState; open: boolean; onClose: () => void }) {
  const { state, open, onClose } = props
  const { w, h, tiles, playerPos, playerDir, pois, npcs } = state.floor
  const gen = state.floor.gen

  const [cellPx, setCellPx] = useState(() => fitCellPx(w, h))

  useEffect(() => {
    if (!open) return
    const update = () => setCellPx(fitCellPx(w, h))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [open, w, h])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  const poiByCell = useMemo(() => {
    const m = new Map<string, typeof pois>()
    for (const p of pois) {
      const k = `${p.pos.x},${p.pos.y}`
      const cur = m.get(k)
      if (cur) cur.push(p)
      else m.set(k, [p])
    }
    return m
  }, [pois])

  const gap = Math.max(1, Math.min(3, Math.round(cellPx * 0.12)))
  const step = cellPx + gap
  const mapW = w * cellPx + (w - 1) * gap
  const mapH = h * cellPx + (h - 1) * gap
  const npcDot = Math.max(4, Math.min(10, Math.round(cellPx * 0.42)))

  const cells: ReactNode[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const key = `${x},${y}`
      const isPlayer = x === playerPos.x && y === playerPos.y
      const cellPois = poiByCell.get(key)
      const isPoi = !!cellPois?.length
      const t = tiles[x + y * w]
      const kind = isPlayer ? 'player' : isPoi ? 'poi' : t
      const poiTitle = cellPois?.map((p) => `${p.kind} (${p.id})`).join(', ')

      cells.push(
        <div
          key={key}
          className={`${minimapStyles.cell} ${styles.cellScaled}`}
          data-kind={kind}
          data-dir={isPlayer ? playerDir : undefined}
          data-poi-kind={isPoi && cellPois?.[0] ? cellPois[0].kind : undefined}
          title={isPoi && poiTitle ? poiTitle : `${kind} ${x},${y}`}
          style={{ left: x * step, top: y * step }}
        />,
      )
    }
  }

  const marks: ReactNode[] = []
  if (gen) {
    const { entrance, exit } = gen
    marks.push(
      <div
        key="ent"
        className={`${styles.mark} ${styles.markEntrance}`}
        style={{ left: entrance.x * step, top: entrance.y * step, width: cellPx, height: cellPx }}
        title={`Entrance ${entrance.x},${entrance.y}`}
      />,
    )
    marks.push(
      <div
        key="ex"
        className={`${styles.mark} ${styles.markExit}`}
        style={{ left: exit.x * step, top: exit.y * step, width: cellPx, height: cellPx }}
        title={`Exit ${exit.x},${exit.y}`}
      />,
    )
  }

  const npcDots = npcs.map((n) => {
    const st = n.status === 'hostile' ? styles.npcHostile : n.status === 'friendly' ? styles.npcFriendly : styles.npcNeutral
    const cx = n.pos.x * step + cellPx / 2
    const cy = n.pos.y * step + cellPx / 2
    return (
      <div
        key={n.id}
        className={`${styles.npcDot} ${st}`}
        style={{ left: cx, top: cy, ['--npc-dot' as string]: `${npcDot}px` }}
        title={`${n.kind} — ${n.name} (${n.status})`}
      />
    )
  })

  if (!open) return null

  const portal = (
    <div className={styles.backdrop} role="presentation">
      <div
        className={styles.dimmed}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div
          className={styles.dialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="debug-minimap-title"
          onMouseDown={(e) => e.stopPropagation()}
        >
        <div className={styles.dialogHeader}>
          <h2 id="debug-minimap-title" className={styles.dialogTitle}>
            Debug minimap ({w}×{h})
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            Close
          </button>
        </div>
        <div className={styles.scroll}>
          <div
            className={`${minimapStyles.map} ${styles.map}`}
            style={{
              width: `${mapW}px`,
              height: `${mapH}px`,
              ['--minimap-cell' as string]: `${cellPx}px`,
              ['--minimap-gap' as string]: `${gap}px`,
            }}
          >
            {cells}
            {marks}
            <div className={styles.npcLayer}>{npcDots}</div>
          </div>
        </div>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ background: 'rgb(36, 40, 52)' }} />
            wall
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ background: 'rgb(188, 194, 208)' }} />
            floor
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ background: 'rgb(178, 158, 118)' }} />
            door
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ background: 'rgb(178, 62, 52)' }} />
            locked
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ background: 'rgb(88, 158, 218)' }} />
            POI
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ background: 'rgb(244, 212, 118)' }} />
            player
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ background: 'rgb(220, 72, 72)' }} />
            NPC hostile
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ background: 'rgb(200, 200, 90)' }} />
            NPC neutral
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ background: 'rgb(100, 180, 240)' }} />
            NPC friendly
          </span>
          {gen && (
            <>
              <span className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ boxShadow: 'inset 0 0 0 2px rgba(96, 200, 120, 0.95)', background: 'transparent' }} />
                entrance
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ boxShadow: 'inset 0 0 0 2px rgba(230, 120, 220, 0.95)', background: 'transparent' }} />
                exit marker
              </span>
            </>
          )}
        </div>
        </div>
      </div>
      <div className={styles.panelLane} aria-hidden={true} />
    </div>
  )

  return createPortal(portal, document.body)
}
