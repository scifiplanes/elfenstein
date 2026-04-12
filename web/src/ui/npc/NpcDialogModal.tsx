import type { Dispatch, MouseEvent } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import type { ContentDB } from '../../game/content/contentDb'
import { toGibberish } from '../../game/npc/gibberish'
import { npcQuestGibberishLine, npcQuestGibberishSeed } from '../../game/npc/npcQuestSpeech'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import { useCursor } from '../cursor/useCursor'
import {
  MODAL_CHROME_HIT_ATTR,
  modalChromeClickActivate,
  modalChromePointerUpActivate,
} from '../cursor/modalChromeActivate'
import popup from '../shared/GamePopup.module.css'
import styles from './NpcDialogModal.module.css'

/** Gap from the bottom edge of the capture root to the speech strip (same **25px** as `.speechInteractiveInGame` in CSS). */
const NPC_SPEECH_BOTTOM_INSET_PX = 25

export type NpcDialogModalVariant = 'interactive' | 'capture'

export function NpcDialogModal(props: {
  state: GameState
  dispatch: Dispatch<Action>
  content: ContentDB
  variant?: NpcDialogModalVariant
}) {
  const { state, dispatch, content, variant = 'interactive' } = props
  const [captureSpeechBottomPct, setCaptureSpeechBottomPct] = useState<number | null>(null)
  const captureRootRef = useRef<HTMLDivElement>(null)
  const suppressTradeClick = useRef(false)
  const suppressCloseClick = useRef(false)
  const cursor = useCursor()
  const dialogNpcId = state.ui.npcDialogFor
  const previewNpc =
    Boolean(state.ui.debugShowNpcDialogPopup) && state.ui.screen === 'game' && !dialogNpcId
  const npcId = dialogNpcId ?? (previewNpc ? state.floor.npcs[0]?.id : undefined)

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

  const gib =
    npcQuestGibberishLine(npc, (id) => content.item(id).name, state.floor.seed) ??
    toGibberish(npc.language, '…', npcQuestGibberishSeed(state.floor.seed), npc.id)

  const panelChrome = `${popup.panel} ${popup.panelWidthMd}`
  const topPanelClass =
    variant === 'capture'
      ? `${panelChrome} ${styles.capturePanelTop}`
      : `${panelChrome} ${styles.panelInteractiveInGame}`

  const dropKind = variant === 'interactive' ? 'npc' : undefined
  const dropNpcId = variant === 'interactive' ? npc.id : undefined
  const stopBackdrop =
    variant === 'interactive' ? (e: MouseEvent<HTMLDivElement>) => e.stopPropagation() : undefined

  const topPanel = (
    <div
      className={topPanelClass}
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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
          {npc.status === 'friendly' && npc.trade && variant === 'interactive' ? (
            <button
              className={popup.actionBtn}
              type="button"
              {...{ [MODAL_CHROME_HIT_ATTR]: '' }}
              onPointerUp={(e) =>
                modalChromePointerUpActivate(
                  cursor,
                  e,
                  () => dispatch({ type: 'trade/openNpc', npcId: npc.id }),
                  suppressTradeClick,
                )
              }
              onClick={(e) =>
                modalChromeClickActivate(e, () => dispatch({ type: 'trade/openNpc', npcId: npc.id }), suppressTradeClick)
              }
            >
              Trade
            </button>
          ) : null}
          <button
            className={popup.close}
            type="button"
            {...{ [MODAL_CHROME_HIT_ATTR]: '' }}
            onPointerUp={(e) =>
              modalChromePointerUpActivate(cursor, e, () => dispatch({ type: 'ui/closeNpcDialog' }), suppressCloseClick)
            }
            onClick={(e) =>
              modalChromeClickActivate(e, () => dispatch({ type: 'ui/closeNpcDialog' }), suppressCloseClick)
            }
          >
            Close
          </button>
        </div>
      </div>

      <div className={popup.hint}>Tip: drag an item from inventory onto them.</div>
    </div>
  )

  const speechStripStyle =
    variant === 'capture' && captureSpeechBottomPct != null ? { bottom: `${captureSpeechBottomPct}%` } : undefined

  const speechStripClass =
    variant === 'capture'
      ? `${styles.speechStrip} ${styles.captureSpeech}`
      : `${styles.speechStrip} ${styles.speechInteractiveInGame}`

  const speechStrip = (
    <div
      className={speechStripClass}
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

  return (
    <div
      className={`${styles.backdropInteractiveInGame} ${styles.backdropHitLayer}`}
      onClick={() => dispatch({ type: 'ui/closeNpcDialog' })}
      onPointerCancel={cursor.cancelDrag}
      onPointerUp={(e) => {
        const { drop } = cursor.endPointerUp(e)
        if (drop) dispatch({ type: 'drag/drop', payload: drop.payload, target: drop.target, nowMs: performance.now() })
      }}
    >
      {topPanel}
      {speechStrip}
    </div>
  )
}
