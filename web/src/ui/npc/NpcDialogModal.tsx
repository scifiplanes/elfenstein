import type { Dispatch, MouseEvent, RefObject } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ContentDB } from '../../game/content/contentDb'
import { toGibberish } from '../../game/npc/gibberish'
import { npcQuestEnglishLine } from '../../game/npc/npcQuestSpeech'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import { useCursor } from '../cursor/useCursor'
import popup from '../shared/GamePopup.module.css'
import styles from './NpcDialogModal.module.css'

type GameViewportRect = {
  left: number
  top: number
  width: number
  height: number
  /** `position: fixed` **`bottom`** as **%** of the layout viewport height (speech sits `NPC_SPEECH_BOTTOM_INSET_PX` above the game viewport’s bottom edge in client space). */
  speechBottomPct: number
}

/** Gap from the top edge of the 3D game viewport to the dialog panel. */
const NPC_MODAL_TOP_INSET_PX = 10
/** Gap from the bottom edge of the 3D game viewport up to the speech strip’s bottom edge (includes +15px lift vs the original 10px). */
const NPC_SPEECH_BOTTOM_INSET_PX = 25

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
  const [captureSpeechBottomPct, setCaptureSpeechBottomPct] = useState<number | null>(null)
  const captureRootRef = useRef<HTMLDivElement>(null)
  const cursor = useCursor()
  const dialogNpcId = state.ui.npcDialogFor
  const previewNpc =
    Boolean(state.ui.debugShowNpcDialogPopup) && state.ui.screen === 'game' && !dialogNpcId
  const npcId = dialogNpcId ?? (previewNpc ? state.floor.npcs[0]?.id : undefined)

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
      const h = typeof window !== 'undefined' ? window.innerHeight : 1
      const bottom = h - (r.top + r.height) + NPC_SPEECH_BOTTOM_INSET_PX
      const speechBottomPct = h > 0 ? (bottom / h) * 100 : 0
      setViewportRect({
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
        speechBottomPct,
      })
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

  useLayoutEffect(() => {
    if (variant !== 'capture' || !npcId) {
      setCaptureSpeechBottomPct(null)
      return
    }
    const el = captureRootRef.current
    if (!el) {
      setCaptureSpeechBottomPct(null)
      return
    }
    const sync = () => {
      const h = el.getBoundingClientRect().height
      if (h <= 0) return
      setCaptureSpeechBottomPct((NPC_SPEECH_BOTTOM_INSET_PX / h) * 100)
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [variant, npcId])

  if (!npcId) return null
  const npc = state.floor.npcs.find((n) => n.id === npcId)
  if (!npc) return null

  const english = npcQuestEnglishLine(npc, (id) => content.item(id).name) ?? `…`
  const gib = toGibberish(npc.language, english, Math.floor(state.floor.seed) ^ 0xabc, npc.id)

  const panelChrome = `${popup.panel} ${popup.panelWidthMd}`
  const topPanelClass =
    variant === 'capture' ? `${panelChrome} ${styles.capturePanelTop}` : `${panelChrome} ${styles.modal}`

  const dropKind = variant === 'interactive' ? 'npc' : undefined
  const dropNpcId = variant === 'interactive' ? npc.id : undefined
  const stopBackdrop =
    variant === 'interactive' ? (e: MouseEvent<HTMLDivElement>) => e.stopPropagation() : undefined

  const topPanel = (
    <div
      className={topPanelClass}
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
      data-drop-kind={dropKind}
      data-drop-npc-id={dropNpcId}
      onClick={stopBackdrop}
    >
      <div className={popup.header}>
        <div className={popup.titleRow}>
          <div className={popup.title}>
            {npc.name} · {npc.status}
          </div>
        </div>
        <button className={popup.close} type="button" onClick={() => dispatch({ type: 'ui/closeNpcDialog' })}>
          Close
        </button>
      </div>

      <div className={popup.hint}>Tip: drag an item from inventory onto them.</div>
    </div>
  )

  const speechStripStyle =
    variant === 'interactive' && viewportRect != null
      ? {
          position: 'fixed' as const,
          left: viewportRect.left + viewportRect.width / 2,
          bottom: `${viewportRect.speechBottomPct}%`,
          transform: 'translateX(-50%)',
        }
      : variant === 'capture' && captureSpeechBottomPct != null
        ? { bottom: `${captureSpeechBottomPct}%` }
        : undefined

  const speechStrip = (
    <div
      className={`${styles.speechStrip} ${variant === 'capture' ? styles.captureSpeech : ''} ${
        variant === 'interactive' && viewportRect == null ? styles.speechInteractiveFallback : ''
      }`}
      style={speechStripStyle}
      data-drop-kind={dropKind}
      data-drop-npc-id={dropNpcId}
      onClick={stopBackdrop}
    >
      <div className={popup.body}>{gib}</div>
    </div>
  )

  if (variant === 'capture') {
    return (
      <div className={styles.captureInGameCell} aria-hidden>
        <div ref={captureRootRef} className={styles.captureRoot}>
          {topPanel}
          {speechStrip}
        </div>
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
      {topPanel}
      {speechStrip}
    </div>
  )

  // `FixedStageViewport` applies `transform: scale` on `.stage`; `position:fixed` inside it uses that
  // ancestor as the containing block, so viewport `getBoundingClientRect()` numbers do not match `left`/`top`.
  if (typeof document !== 'undefined' && document.body) {
    return createPortal(tree, document.body)
  }
  return tree
}
