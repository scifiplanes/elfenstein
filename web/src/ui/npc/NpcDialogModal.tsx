import type { Dispatch, RefObject } from 'react'
import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ContentDB } from '../../game/content/contentDb'
import { toGibberish } from '../../game/npc/gibberish'
import { NPC_SPRITE_SRC } from '../../game/npc/npcDefs'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import { STAGE_CSS_HEIGHT } from '../../app/stageDesign'
import { useCursor } from '../cursor/useCursor'
import styles from './NpcDialogModal.module.css'

type GameViewportRect = { left: number; top: number; width: number; height: number }

/** Upward shift scales with game viewport height; equals 100px when height === STAGE_CSS_HEIGHT. */
const NPC_MODAL_UP_SHIFT_RATIO = 100 / STAGE_CSS_HEIGHT
/** Downward nudge after that shift; equals 30px when height === STAGE_CSS_HEIGHT. */
const NPC_MODAL_DOWN_SHIFT_RATIO = 30 / STAGE_CSS_HEIGHT

export function NpcDialogModal(props: {
  state: GameState
  dispatch: Dispatch<Action>
  content: ContentDB
  gameViewportRef?: RefObject<HTMLDivElement | null>
}) {
  const { state, dispatch, content, gameViewportRef } = props
  const [viewportRect, setViewportRect] = useState<GameViewportRect | null>(null)
  const cursor = useCursor()
  const npcId = state.ui.npcDialogFor

  useLayoutEffect(() => {
    if (!npcId) {
      setViewportRect(null)
      return
    }
    const el = gameViewportRef?.current
    if (!el) {
      setViewportRect(null)
      return
    }
    const sync = () => {
      const r = el.getBoundingClientRect()
      setViewportRect({ left: r.left, top: r.top, width: r.width, height: r.height })
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    window.addEventListener('resize', sync)
    window.addEventListener('scroll', sync, true)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', sync)
      window.removeEventListener('scroll', sync, true)
    }
  }, [gameViewportRef, npcId])

  if (!npcId) return null
  const npc = state.floor.npcs.find((n) => n.id === npcId)
  if (!npc) return null

  const wants = npc.quest?.wants ? content.item(npc.quest.wants).name : null
  const english = wants ? `…bring me ${wants}.` : `…`
  const gib = toGibberish(npc.language, english, Math.floor(state.floor.seed) ^ 0xabc)

  const modalPositionStyle =
    viewportRect != null
      ? (() => {
          const horizontalPad = 12
          const topInset = 10
          const upShift = viewportRect.height * NPC_MODAL_UP_SHIFT_RATIO
          const downShift = viewportRect.height * NPC_MODAL_DOWN_SHIFT_RATIO
          const maxW = 620
          const w = Math.min(maxW, Math.max(160, viewportRect.width - horizontalPad * 2))
          const centerX = viewportRect.left + viewportRect.width / 2
          return {
            position: 'fixed' as const,
            left: centerX,
            top: viewportRect.top + topInset - upShift + downShift,
            width: w,
            transform: 'translateX(-50%)',
          }
        })()
      : undefined

  const tree = (
    <div
      className={styles.backdrop}
      onClick={() => dispatch({ type: 'ui/closeNpcDialog' })}
      onPointerMove={cursor.onPointerMove}
      onPointerCancel={cursor.cancelDrag}
      onPointerUp={(e) => {
        const result = cursor.endPointerUp(e)
        if (result) dispatch({ type: 'drag/drop', payload: result.payload, target: result.target, nowMs: performance.now() })
      }}
    >
      <div
        className={styles.modal}
        style={modalPositionStyle}
        data-drop-kind="npc"
        data-drop-npc-id={npc.id}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <img className={styles.portrait} src={NPC_SPRITE_SRC[npc.kind]} alt="" draggable={false} />
            <div className={styles.title}>
              {npc.name} · {npc.status} · {npc.language}
            </div>
          </div>
          <button className={styles.close} type="button" onClick={() => dispatch({ type: 'ui/closeNpcDialog' })}>
            Close
          </button>
        </div>

        <div className={styles.body}>{gib}</div>
        <div className={styles.hint}>Tip: drag an item from inventory onto them.</div>
        <div className={styles.footer}>
          <button
            className={styles.pet}
            type="button"
            onClick={() => dispatch({ type: 'npc/pet', npcId: npc.id })}
          >
            Pet {npc.name}
          </button>
        </div>
      </div>
    </div>
  )

  // `FixedStageViewport` applies `transform: scale` on `.stage`; `position:fixed` inside it uses that
  // ancestor as the containing block, so viewport `getBoundingClientRect()` numbers do not match `left`/`top`.
  if (typeof document !== 'undefined' && document.body) {
    return createPortal(tree, document.body)
  }
  return tree
}

