import type { Dispatch, RefObject } from 'react'
import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ContentDB } from '../../game/content/contentDb'
import { toGibberish } from '../../game/npc/gibberish'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import { useCursor } from '../cursor/useCursor'
import styles from './NpcDialogModal.module.css'

type GameViewportRect = { left: number; top: number; width: number; height: number }

/** Gap from the top edge of the 3D game viewport to the dialog panel. */
const NPC_MODAL_TOP_INSET_PX = 10

export type NpcDialogModalVariant = 'interactive' | 'capture'

export function NpcDialogModal(props: {
  state: GameState
  dispatch: Dispatch<Action>
  content: ContentDB
  variant?: NpcDialogModalVariant
  /** Interactive: screen-fixed portal positioning (scaled stage). */
  gameViewportRef?: RefObject<HTMLDivElement | null>
}) {
  const { state, dispatch, content, variant = 'interactive', gameViewportRef } = props
  const [viewportRect, setViewportRect] = useState<GameViewportRect | null>(null)
  const cursor = useCursor()
  const npcId = state.ui.npcDialogFor

  useLayoutEffect(() => {
    if (!npcId || variant === 'capture') {
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
  }, [variant, gameViewportRef, npcId])

  if (!npcId) return null
  const npc = state.floor.npcs.find((n) => n.id === npcId)
  if (!npc) return null

  const wants = npc.quest?.wants ? content.item(npc.quest.wants).name : null
  const english = wants ? `…bring me ${wants}.` : `…`
  const gib = toGibberish(npc.language, english, Math.floor(state.floor.seed) ^ 0xabc)

  const modalPanel = (
    <div
      className={variant === 'capture' ? styles.modalCapture : styles.modal}
      style={
        variant === 'interactive' && viewportRect != null
          ? {
              position: 'fixed' as const,
              left: viewportRect.left + viewportRect.width / 2,
              top: viewportRect.top + NPC_MODAL_TOP_INSET_PX,
              transform: 'translateX(-50%)',
            }
          : undefined
      }
      data-drop-kind={variant === 'interactive' ? 'npc' : undefined}
      data-drop-npc-id={variant === 'interactive' ? npc.id : undefined}
      onClick={variant === 'interactive' ? (e) => e.stopPropagation() : undefined}
    >
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <div className={styles.title}>
            {npc.name} · {npc.status}
          </div>
        </div>
        <button className={styles.close} type="button" onClick={() => dispatch({ type: 'ui/closeNpcDialog' })}>
          Close
        </button>
      </div>

      <div className={styles.body}>{gib}</div>
      <div className={styles.hint}>Tip: drag an item from inventory onto them.</div>
    </div>
  )

  if (variant === 'capture') {
    return (
      <div className={styles.captureInGameCell} aria-hidden>
        {modalPanel}
      </div>
    )
  }

  const tree = (
    <div
      className={`${styles.backdrop} ${styles.backdropHitLayer}`}
      onClick={() => dispatch({ type: 'ui/closeNpcDialog' })}
      onPointerMove={cursor.onPointerMove}
      onPointerCancel={cursor.cancelDrag}
      onPointerUp={(e) => {
        const result = cursor.endPointerUp(e)
        if (result) dispatch({ type: 'drag/drop', payload: result.payload, target: result.target, nowMs: performance.now() })
      }}
    >
      {modalPanel}
    </div>
  )

  // `FixedStageViewport` applies `transform: scale` on `.stage`; `position:fixed` inside it uses that
  // ancestor as the containing block, so viewport `getBoundingClientRect()` numbers do not match `left`/`top`.
  if (typeof document !== 'undefined' && document.body) {
    return createPortal(tree, document.body)
  }
  return tree
}
