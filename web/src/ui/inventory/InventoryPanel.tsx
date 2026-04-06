import type { Dispatch } from 'react'
import type { ContentDB } from '../../game/content/contentDb'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import styles from './InventoryPanel.module.css'
import { useCursor } from '../cursor/useCursor'

export function InventoryPanel(props: { state: GameState; dispatch: Dispatch<Action>; content: ContentDB }) {
  const { state, dispatch, content } = props
  const cursor = useCursor()

  const inv = state.party.inventory
  const slots = inv.slots
  const hover = cursor.state.hoverTarget?.kind === 'inventorySlot' ? cursor.state.hoverTarget.slotIndex : null

  return (
    <div
      className={styles.grid}
      style={{ ['--inv-cols' as any]: inv.cols }}
      data-drop-kind="floorDrop"
      onPointerMove={cursor.onPointerMove}
      onPointerUp={(e) => {
        const result = cursor.endPointerUp(e)
        if (result) dispatch({ type: 'drag/drop', payload: result.payload, target: result.target })
      }}
    >
      {slots.map((itemId, idx) => {
        const item = itemId ? state.party.items[itemId] : null
        const def = item ? content.item(item.defId) : null
        return (
          <div
            key={idx}
            className={styles.slot}
            data-drop-kind="inventorySlot"
            data-drop-slot-index={idx}
            data-hover={hover === idx ? 'true' : 'false'}
          >
            {item && def ? (
              <>
                <button
                  type="button"
                  className={styles.item}
                  onPointerDown={(e) => {
                    cursor.beginPointerDown({ itemId: item.id, source: { kind: 'inventorySlot', slotIndex: idx, itemId: item.id } }, e)
                  }}
                  onPointerMove={cursor.onPointerMove}
                  onPointerUp={(e) => {
                    const result = cursor.endPointerUp(e)
                    if (result) dispatch({ type: 'drag/drop', payload: result.payload, target: result.target })
                  }}
                  aria-label={def.name}
                >
                  {def.icon.kind === 'emoji' ? def.icon.value : '□'}
                </button>
                {item.qty > 1 ? <div className={styles.qty}>{item.qty}</div> : null}
              </>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

