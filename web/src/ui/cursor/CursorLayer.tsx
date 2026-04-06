import { useContext, useEffect } from 'react'
import { CursorContext } from './CursorContext'
import styles from './CursorLayer.module.css'
import type { GameState } from '../../game/types'
import type { ContentDB } from '../../game/content/contentDb'

export function CursorLayer(props: { state: GameState; content: ContentDB }) {
  const api = useContext(CursorContext)
  if (!api) return null

  const { pointer, dragging, affordance, hoverRect, isPointerDown, hoverTarget } = api.state

  useEffect(() => {
    // Always hide the system cursor for the intended “hand cursor” feel.
    const prev = document.body.style.cursor
    document.body.style.cursor = 'none'
    return () => {
      document.body.style.cursor = prev
    }
  }, [])

  useEffect(() => {
    // Preload cursor sprites so state changes don’t hitch on image decode.
    const srcs = ['/content/Hand_Point.png', '/content/Hand_Hold.png', '/content/Hand_Active.png']
    const imgs = srcs.map((src) => {
      const img = new Image()
      img.decoding = 'async'
      img.src = src
      return img
    })
    return () => {
      // Keep GC-able references only; no listeners attached.
      void imgs
    }
  }, [])

  const x = pointer.x
  const y = pointer.y

  const isHold = Boolean(dragging?.started || isPointerDown)
  const isActive = !isHold && Boolean(hoverTarget) && hoverTarget?.kind !== 'floorDrop'

  const ghost =
    dragging?.started && dragging.payload
      ? { itemId: dragging.payload.itemId }
      : null

  const crafting = props.state.ui.crafting ?? null
  const craftProgress =
    crafting ? Math.max(0, Math.min(1, (props.state.nowMs - crafting.startedAtMs) / Math.max(1, crafting.endsAtMs - crafting.startedAtMs))) : 0

  const npcAffordance =
    dragging?.started && hoverTarget?.kind === 'npc'
      ? (() => {
          const item = props.state.party.items[dragging.payload.itemId]
          const defId = item?.defId
          const isWeapon = defId === 'Club' || defId === 'Stick' || defId === 'Stone' || defId === 'Spear'
          return isWeapon ? { icon: '⚔', label: 'Attack' } : { icon: '🎁', label: 'Give' }
        })()
      : null

  const isHoveringValidTarget = Boolean(dragging?.started && (npcAffordance ?? affordance))
  const ghostText = (() => {
    if (!ghost) return ''
    const item = props.state.party.items[ghost.itemId]
    const def = item ? props.content.item(item.defId) : null
    if (!def) return ghost.itemId
    return def.icon.kind === 'emoji' ? def.icon.value : def.name
  })()

  return (
    <div className={styles.layer}>
      <div
        className={`${styles.hand} ${isHold ? styles.hold : isActive ? styles.active : styles.point}`}
        style={{ left: x, top: y }}
      />
      {ghost ? (
        <div className={`${styles.ghost} ${isHoveringValidTarget ? styles.ghostShake : ''}`} style={{ left: x, top: y }}>
          {ghostText}
        </div>
      ) : null}
      {crafting ? (
        <div className={styles.craft} style={{ left: x, top: y }}>
          <div className={styles.craftFill} style={{ width: `${Math.round(craftProgress * 100)}%` }} />
        </div>
      ) : null}
      {dragging?.started && (npcAffordance ?? affordance) && hoverRect ? (
        <div
          className={styles.affordance}
          style={{
            left: hoverRect.right,
            top: (hoverRect.top + hoverRect.bottom) / 2,
          }}
        >
          <span aria-hidden="true">{(npcAffordance ?? affordance)!.icon}</span>
          <span>{(npcAffordance ?? affordance)!.label}</span>
        </div>
      ) : null}
    </div>
  )
}

