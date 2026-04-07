import type { Dispatch } from 'react'
import type { ContentDB } from '../../game/content/contentDb'
import type { Action } from '../../game/reducer'
import type { EquipmentSlot, GameState } from '../../game/types'
import { useCursor } from '../cursor/useCursor'
import styles from './PaperdollModal.module.css'

const SLOT_ORDER: EquipmentSlot[] = ['head', 'handLeft', 'handRight', 'feet', 'clothing', 'accessory']

export function PaperdollModal(props: { state: GameState; dispatch: Dispatch<Action>; content: ContentDB }) {
  const { state, dispatch, content } = props
  const cursor = useCursor()
  const characterId = state.ui.paperdollFor
  if (!characterId) return null
  const c = state.party.chars.find((x) => x.id === characterId)
  if (!c) return null

  return (
    <div
      className={styles.backdrop}
      onClick={() => dispatch({ type: 'ui/closePaperdoll' })}
      onPointerMove={cursor.onPointerMove}
      onPointerCancel={cursor.cancelDrag}
      onPointerUp={(e) => {
        const result = cursor.endPointerUp(e)
        if (result) dispatch({ type: 'drag/drop', payload: result.payload, target: result.target })
      }}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>Paperdoll · {c.name}</div>
          <button className={styles.close} type="button" onClick={() => dispatch({ type: 'ui/closePaperdoll' })}>
            Close
          </button>
        </div>

        <div className={styles.grid}>
          {SLOT_ORDER.map((slot) => {
            const itemId = c.equipment[slot]
            const item = itemId ? state.party.items[itemId] : null
            const def = item ? content.item(item.defId) : null

            return (
              <div
                key={slot}
                className={styles.slot}
                data-drop-kind="equipmentSlot"
                data-drop-character-id={characterId}
                data-drop-equip-slot={slot}
              >
                <div className={styles.slotName}>{slot}</div>
                {item && def ? (
                  <button
                    className={styles.itemBtn}
                    type="button"
                    onPointerDown={(e) => {
                      cursor.beginPointerDown(
                        { itemId: item.id, source: { kind: 'equipmentSlot', characterId, slot, itemId: item.id } },
                        e,
                      )
                    }}
                    onPointerMove={cursor.onPointerMove}
                    onPointerCancel={cursor.cancelDrag}
                    onPointerUp={(e) => {
                      const result = cursor.endPointerUp(e)
                      if (result) dispatch({ type: 'drag/drop', payload: result.payload, target: result.target })
                    }}
                    onDoubleClick={() => {
                      // MVP convenience: double-click unequips (later: drag back to inventory).
                      dispatch({ type: 'equip/unequip', characterId, slot })
                      dispatch({ type: 'ui/toast', text: 'Unequipped.' })
                    }}
                    aria-label={`Equipped: ${def.name}`}
                  >
                    {def.icon.kind === 'emoji' ? def.icon.value : '□'}
                  </button>
                ) : (
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                    drop item
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

