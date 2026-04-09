import type { Dispatch } from 'react'
import { useLayoutEffect, useRef } from 'react'
import type { ContentDB } from '../../game/content/contentDb'
import type { Action } from '../../game/reducer'
import type { EquipmentSlot, GameState } from '../../game/types'
import { useCursor } from '../cursor/useCursor'
import {
  MODAL_CHROME_HIT_ATTR,
  modalChromeClickActivate,
  modalChromePointerUpActivate,
} from '../cursor/modalChromeActivate'
import popup from '../shared/GamePopup.module.css'
import styles from './PaperdollModal.module.css'

const SLOT_ORDER: EquipmentSlot[] = ['head', 'handLeft', 'handRight', 'feet', 'clothing', 'accessory']

export type PaperdollModalVariant = 'interactive' | 'capture'

export function PaperdollModal(props: {
  state: GameState
  dispatch: Dispatch<Action>
  content: ContentDB
  variant?: PaperdollModalVariant
}) {
  const { state, dispatch, content, variant = 'interactive' } = props
  const cursor = useCursor()
  const characterId = state.ui.paperdollFor
  /** Opening from a portrait tap dispatches before the synthetic `click`; the click then hits this full-screen backdrop and would close immediately. */
  const suppressBackdropCloseUntilRef = useRef(0)
  const suppressCloseClick = useRef(false)
  useLayoutEffect(() => {
    if (characterId && variant === 'interactive') {
      suppressBackdropCloseUntilRef.current = performance.now() + 450
    }
  }, [characterId, variant])

  if (!characterId) return null
  const c = state.party.chars.find((x) => x.id === characterId)
  if (!c) return null

  const backdropClass =
    variant === 'capture' ? `${styles.backdropCapture} ${popup.backdropDim}` : `${styles.backdrop} ${popup.backdropDim}`

  const tree = (
    <div
      className={backdropClass}
      onClick={
        variant === 'interactive'
          ? (e) => {
              if (performance.now() < suppressBackdropCloseUntilRef.current) {
                e.preventDefault()
                e.stopPropagation()
                return
              }
              dispatch({ type: 'ui/closePaperdoll' })
            }
          : undefined
      }
      onPointerMove={variant === 'interactive' ? cursor.onPointerMove : undefined}
      onPointerCancel={variant === 'interactive' ? cursor.cancelDrag : undefined}
      onPointerUp={
        variant === 'interactive'
          ? (e) => {
              const { drop } = cursor.endPointerUp(e)
              if (drop) dispatch({ type: 'drag/drop', payload: drop.payload, target: drop.target, nowMs: performance.now() })
            }
          : undefined
      }
    >
      <div className={`${popup.panel} ${styles.modal}`} onClick={variant === 'interactive' ? (e) => e.stopPropagation() : undefined}>
        <div className={popup.header}>
          <div className={popup.titleRow}>
            <div className={popup.title}>Paperdoll · {c.name}</div>
          </div>
          <button
            className={popup.close}
            type="button"
            {...{ [MODAL_CHROME_HIT_ATTR]: '' }}
            onPointerUp={(e) =>
              modalChromePointerUpActivate(
                cursor,
                e,
                () => dispatch({ type: 'ui/closePaperdoll' }),
                suppressCloseClick,
              )
            }
            onClick={(e) =>
              modalChromeClickActivate(e, () => dispatch({ type: 'ui/closePaperdoll' }), suppressCloseClick)
            }
          >
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
                data-drop-kind={variant === 'interactive' ? 'equipmentSlot' : undefined}
                data-drop-character-id={variant === 'interactive' ? characterId : undefined}
                data-drop-equip-slot={variant === 'interactive' ? slot : undefined}
              >
                <div className={styles.slotName}>{slot}</div>
                {item && def ? (
                  variant === 'interactive' ? (
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
                        const { drop } = cursor.endPointerUp(e)
                        e.stopPropagation()
                        if (drop) dispatch({ type: 'drag/drop', payload: drop.payload, target: drop.target, nowMs: performance.now() })
                      }}
                      onDoubleClick={() => {
                        dispatch({ type: 'equip/unequip', characterId, slot })
                        dispatch({ type: 'ui/toast', text: 'Unequipped.' })
                      }}
                      aria-label={`Equipped: ${def.name}`}
                    >
                      {def.icon.kind === 'emoji' ? def.icon.value : '□'}
                    </button>
                  ) : (
                    <span className={styles.itemBtn} aria-hidden>
                      {def.icon.kind === 'emoji' ? def.icon.value : '□'}
                    </span>
                  )
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

  if (variant === 'capture') {
    return tree
  }

  return tree
}
