import type { CSSProperties, Dispatch, RefObject } from 'react'
import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Action } from '../../game/reducer'
import { HUB_INNKEEPER_SPEECH_AUTO_HIDE_MS } from '../../game/npc/innkeeperSpeechTiming'
import { npcCaptureInteractiveRectFromGameViewportEl } from '../hud/npcCaptureInteractiveRect'
import npcDlgStyles from '../npc/NpcDialogModal.module.css'
import popup from '../shared/GamePopup.module.css'

/** Same bottom gap as `NpcDialogModal` speech strip above the game viewport. */
const SPEECH_BOTTOM_INSET_PX = 25

type SpeechRect = {
  left: number
  width: number
  speechBottomPct: number
}

/**
 * Renders innkeeper mojibake in a **`document.body`** portal (`position: fixed`) so it never
 * covers the invisible `interactiveHud` hit tree (trade buttons stay clickable). Mirrors NPC
 * dialog speech positioning (`npcCaptureInteractiveRectFromGameViewportEl`).
 */
export function InnkeeperTradeSpeechPortal(props: {
  text: string
  /** When set, overrides default **2000** ms before `ui/clearHubInnkeeperSpeech`. */
  autoHideMs?: number
  gameViewportRef?: RefObject<HTMLDivElement | null>
  active: boolean
  dispatch: Dispatch<Action>
}) {
  const { text, autoHideMs, gameViewportRef, active, dispatch } = props
  const [rect, setRect] = useState<SpeechRect | null>(null)
  const hideAfterMs = autoHideMs ?? HUB_INNKEEPER_SPEECH_AUTO_HIDE_MS

  useEffect(() => {
    if (!active || !text) return
    const id = window.setTimeout(() => {
      dispatch({ type: 'ui/clearHubInnkeeperSpeech' })
    }, hideAfterMs)
    return () => window.clearTimeout(id)
  }, [active, text, dispatch, hideAfterMs])

  useLayoutEffect(() => {
    if (!active) {
      setRect(null)
      return
    }
    const el = gameViewportRef?.current
    if (!el) {
      setRect(null)
      return
    }
    const sync = () => {
      const r = npcCaptureInteractiveRectFromGameViewportEl(el)
      if (!r) {
        setRect(null)
        return
      }
      const h = typeof window !== 'undefined' ? window.innerHeight : 1
      const bottom = h - (r.top + r.height) + SPEECH_BOTTOM_INSET_PX
      const speechBottomPct = h > 0 ? (bottom / h) * 100 : 0
      setRect({ left: r.left, width: r.width, speechBottomPct })
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
  }, [active, gameViewportRef])

  if (!active || !text) return null
  if (typeof document === 'undefined') return null

  const style: CSSProperties =
    rect != null
      ? {
          position: 'fixed',
          left: rect.left + rect.width / 2,
          bottom: `${rect.speechBottomPct}%`,
          transform: 'translateX(-50%)',
          zIndex: 10050,
          pointerEvents: 'none',
        }
      : {
          position: 'fixed',
          left: '50%',
          bottom: '2.315%',
          transform: 'translateX(-50%)',
          zIndex: 10050,
          pointerEvents: 'none',
        }

  return createPortal(
    <div className={npcDlgStyles.speechStrip} style={style} aria-live="polite">
      <div className={popup.body}>{text}</div>
    </div>,
    document.body,
  )
}
