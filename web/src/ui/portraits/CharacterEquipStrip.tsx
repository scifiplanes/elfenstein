import { useMemo, type Dispatch, type PointerEvent } from 'react'
import type { ContentDB } from '../../game/content/contentDb'
import type { Action } from '../../game/reducer'
import { itemFitsCharacterEquipmentSlot } from '../../game/state/equipment'
import type { EquipmentSlot, GameState } from '../../game/types'
import { useCursor } from '../cursor/useCursor'
import { EquipIcon } from './EquipIcon'
import styles from './CharacterEquipStrip.module.css'

export function CharacterEquipStrip(props: {
  state: GameState
  dispatch: Dispatch<Action>
  content: ContentDB
  characterId: string
  /** Merged onto root (e.g. `HudLayout` `charRailPushEnd` when strip is the second flex child). */
  className?: string
  /** `translateX` in CSS px. `HudLayout` passes **+n** on left rails and **−n** on right rails (mirror toward game). */
  equipTranslateXPx?: number
  /** Nudge **up** by this many px (`translateY(-n)`); `HudLayout` passes the same value on **all** four strips. */
  equipNudgeUpPx?: number
}) {
  const { state, dispatch, content, characterId, className, equipTranslateXPx, equipNudgeUpPx } = props
  const cursor = useCursor()
  const c = state.party.chars.find((x) => x.id === characterId) ?? null

  if (!c) return null

  const headItemId = c.equipment.head
  const handLeftId = c.equipment.handLeft
  const handRightId = c.equipment.handRight
  const headItem = headItemId ? state.party.items[headItemId] : null
  const leftHandItem = handLeftId ? state.party.items[handLeftId] : null
  const rightHandItem = handRightId ? state.party.items[handRightId] : null
  const headDef = headItem ? content.item(headItem.defId) : null
  const leftHandDef = leftHandItem ? content.item(leftHandItem.defId) : null
  const rightHandDef = rightHandItem ? content.item(rightHandItem.defId) : null
  const twoHandHeld =
    Boolean(handLeftId && handRightId && handLeftId === handRightId && leftHandDef)

  const showEquipHandLeft = !twoHandHeld && !!leftHandDef
  const showEquipHandRightTwoHand = twoHandHeld && !!leftHandDef
  const showEquipHandRightOneHand = !twoHandHeld && !!rightHandDef

  const beginEquipDrag = (slot: EquipmentSlot, itemId: string, e: PointerEvent<HTMLButtonElement>) => {
    cursor.beginPointerDown(
      {
        itemId,
        source: { kind: 'equipmentSlot', characterId, slot, itemId, fromPortrait: true },
      },
      e,
    )
  }

  const onPointerUpStrip = (e: PointerEvent) => {
    const result = cursor.endPointerUp(e)
    if (result) dispatch({ type: 'drag/drop', payload: result.payload, target: result.target, nowMs: performance.now() })
  }

  const draggingItemId = cursor.state.dragging?.started ? cursor.state.dragging.payload.itemId : null
  const afford = useMemo(() => {
    if (!draggingItemId) {
      return { head: false, handLeft: false, handRight: false }
    }
    return {
      head: itemFitsCharacterEquipmentSlot(state, content, characterId, 'head', draggingItemId),
      handLeft: itemFitsCharacterEquipmentSlot(state, content, characterId, 'handLeft', draggingItemId),
      handRight: itemFitsCharacterEquipmentSlot(state, content, characterId, 'handRight', draggingItemId),
    }
  }, [draggingItemId, state, content, characterId])

  const tx = equipTranslateXPx ?? 0
  const up = equipNudgeUpPx ?? 0
  const transformParts: string[] = []
  if (tx !== 0) transformParts.push(`translateX(${tx}px)`)
  if (up !== 0) transformParts.push(`translateY(-${up}px)`)
  const nudgeStyle = transformParts.length ? ({ transform: transformParts.join(' ') } as const) : undefined

  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      style={nudgeStyle}
      onPointerMove={cursor.onPointerMove}
      onPointerCancel={cursor.cancelDrag}
      onPointerUp={onPointerUpStrip}
    >
      <div
        className={`${styles.slot} ${styles.slotHead}${afford.head ? ` ${styles.slotAffordEquip}` : ''}`}
        data-drop-kind="equipmentSlot"
        data-drop-character-id={characterId}
        data-drop-equip-slot="head"
      >
        <div className={styles.slotInner}>
          {headDef && headItem ? (
            <button
              type="button"
              className={styles.equipBtn}
              onPointerDown={(e) => beginEquipDrag('head', headItem.id, e)}
              aria-label={`Equipped hat: ${headDef.name}`}
            >
              <EquipIcon def={headDef} emojiClass={styles.emoji} imgClass={styles.img} />
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={`${styles.slot} ${styles.slotHandLeft}${afford.handLeft ? ` ${styles.slotAffordEquip}` : ''}`}
        data-drop-kind="equipmentSlot"
        data-drop-character-id={characterId}
        data-drop-equip-slot="handLeft"
      >
        <div className={styles.slotInner}>
          {showEquipHandLeft && leftHandDef && leftHandItem ? (
            <button
              type="button"
              className={styles.equipBtn}
              onPointerDown={(e) => beginEquipDrag('handLeft', leftHandItem.id, e)}
              aria-label={`Equipped left hand: ${leftHandDef.name}`}
            >
              <EquipIcon def={leftHandDef} emojiClass={styles.emoji} imgClass={styles.img} />
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={`${styles.slot} ${styles.slotHandRight}${afford.handRight ? ` ${styles.slotAffordEquip}` : ''}`}
        data-drop-kind="equipmentSlot"
        data-drop-character-id={characterId}
        data-drop-equip-slot="handRight"
      >
        <div className={styles.slotInner}>
          {showEquipHandRightTwoHand && leftHandDef && leftHandItem ? (
            <button
              type="button"
              className={styles.equipBtn}
              onPointerDown={(e) => beginEquipDrag('handLeft', leftHandItem.id, e)}
              aria-label={`Equipped two-hand: ${leftHandDef.name}`}
            >
              <EquipIcon def={leftHandDef} emojiClass={styles.emojiTwoHand} imgClass={styles.imgTwoHand} />
            </button>
          ) : showEquipHandRightOneHand && rightHandDef && rightHandItem ? (
            <button
              type="button"
              className={styles.equipBtn}
              onPointerDown={(e) => beginEquipDrag('handRight', rightHandItem.id, e)}
              aria-label={`Equipped right hand: ${rightHandDef.name}`}
            >
              <EquipIcon def={rightHandDef} emojiClass={styles.emoji} imgClass={styles.img} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
