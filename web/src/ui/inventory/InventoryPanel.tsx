import type { Dispatch } from 'react'
import type { ContentDB } from '../../game/content/contentDb'
import type { Action } from '../../game/reducer'
import type { GameState, ItemDefId } from '../../game/types'
import styles from './InventoryPanel.module.css'
import { useCursor } from '../cursor/useCursor'

export function InventoryPanel(props: {
  state: GameState
  dispatch: Dispatch<Action>
  content: ContentDB
  /** While trading: highlight inventory slots whose `defId` the merchant will buy. */
  tradeWantDefIds?: readonly ItemDefId[]
}) {
  const { state, dispatch, content, tradeWantDefIds } = props
  const cursor = useCursor()
  const wantSet = tradeWantDefIds?.length ? new Set(tradeWantDefIds) : null

  const inv = state.party.inventory
  const slots = inv.slots
  const hover = cursor.state.hoverTarget?.kind === 'inventorySlot' ? cursor.state.hoverTarget.slotIndex : null

  return (
    <div
      className={styles.grid}
      style={{ ['--inv-cols' as any]: inv.cols }}
      data-drop-kind="floorDrop"
      onPointerCancel={cursor.cancelDrag}
      onPointerUp={(e) => {
        const { drop } = cursor.endPointerUp(e)
        if (drop) dispatch({ type: 'drag/drop', payload: drop.payload, target: drop.target, nowMs: performance.now() })
      }}
    >
      {slots.map((itemId, idx) => {
        const item = itemId ? state.party.items[itemId] : null
        const def = item ? content.item(item.defId) : null
        const tradeEligible = Boolean(wantSet && item && wantSet.has(item.defId))
        return (
          <div
            key={idx}
            className={`${styles.slot}${tradeEligible ? ` ${styles.slotTradeEligible}` : ''}`}
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
                  onPointerCancel={cursor.cancelDrag}
                  onPointerUp={(e) => {
                    const btn = e.currentTarget as HTMLButtonElement
                    const { drop, promotedToDrag } = cursor.endPointerUp(e)
                    e.stopPropagation()
                    if (drop) {
                      dispatch({ type: 'drag/drop', payload: drop.payload, target: drop.target, nowMs: performance.now() })
                      return
                    }
                    if (!tradeEligible || !item || !state.ui.tradeSession) return
                    const r = btn.getBoundingClientRect()
                    const inButton =
                      e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
                    if (!promotedToDrag || inButton) {
                      e.preventDefault()
                      dispatch({ type: 'trade/stageOfferFromInventory', slotIndex: idx })
                    }
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

