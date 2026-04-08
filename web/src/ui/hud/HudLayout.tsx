import { type Dispatch, type RefObject, useRef } from 'react'
import type { ContentDB } from '../../game/content/contentDb'
import type { GameState } from '../../game/types'
import type { Action } from '../../game/reducer'
import styles from './HudLayout.module.css'
import { GameViewport } from '../viewport/GameViewport'
import { InventoryPanel } from '../inventory/InventoryPanel'
import { PortraitPanel } from '../portraits/PortraitPanel'
import { MinimapPanel } from '../minimap/MinimapPanel'
import { NavigationPanel, type NavPadButtonId } from '../nav/NavigationPanel'
import { StatuePanel } from '../statue/StatuePanel'
import { ActivityLog } from './ActivityLog'
import { useCursor } from '../cursor/useCursor'
import type { WorldRenderer } from '../../world/WorldRenderer'

export function HudLayout(props: {
  state: GameState
  dispatch: Dispatch<Action>
  content: ContentDB
  interactive?: boolean
  captureForPostprocess?: boolean
  world?: WorldRenderer | null
  gameViewportRef?: RefObject<HTMLDivElement | null>
  rootRef?: RefObject<HTMLDivElement | null>
  webglError?: string | null
  navPadPressedId: NavPadButtonId | null
  onNavPadVisualPress: (id: NavPadButtonId) => void
}) {
  const {
    state,
    dispatch,
    content,
    interactive = true,
    captureForPostprocess = false,
    world = null,
    gameViewportRef,
    rootRef,
    webglError,
    navPadPressedId,
    onNavPadVisualPress,
  } = props
  const cursor = useCursor()
  /** Portrait-frame tap: handled at HUD root capture so it runs before child `pointerup`/`endPointerUp` and survives lost synthetic `click`. */
  const portraitTapRef = useRef<{ characterId: string; pointerId: number; x: number; y: number } | null>(null)

  return (
    <div
      className={styles.root}
      data-capture={captureForPostprocess ? 'true' : 'false'}
      ref={rootRef}
      onPointerMove={interactive ? cursor.onPointerMove : undefined}
      onPointerCancel={
        interactive
          ? (e) => {
              if (portraitTapRef.current?.pointerId === e.pointerId) portraitTapRef.current = null
              cursor.cancelDrag()
            }
          : undefined
      }
      onPointerDownCapture={
        interactive
          ? (e) => {
              if (e.button !== 0) return
              const el = (e.target as Element | null)?.closest?.('[data-portrait-character-id]')
              if (!el) return
              const characterId = el.getAttribute('data-portrait-character-id')
              if (!characterId) return
              portraitTapRef.current = {
                characterId,
                pointerId: e.pointerId,
                x: e.clientX,
                y: e.clientY,
              }
            }
          : undefined
      }
      onPointerUpCapture={
        interactive
          ? (e) => {
              if (e.button !== 0) return
              const g = portraitTapRef.current
              if (!g || g.pointerId !== e.pointerId) return
              portraitTapRef.current = null
              const el = (e.target as Element | null)?.closest?.('[data-portrait-character-id]')
              if (!el || el.getAttribute('data-portrait-character-id') !== g.characterId) return
              const slop = 28
              if ((e.clientX - g.x) ** 2 + (e.clientY - g.y) ** 2 > slop * slop) return
              if (cursor.state.dragging?.started) return
              dispatch({ type: 'ui/portraitFrameTap', characterId: g.characterId })
            }
          : undefined
      }
      onPointerUp={
        interactive
          ? (e) => {
              const result = cursor.endPointerUp(e)
              if (result) dispatch({ type: 'drag/drop', payload: result.payload, target: result.target, nowMs: performance.now() })
            }
          : undefined
      }
    >
      <section className={`${styles.panel} ${styles.char2}`}>
        <PortraitPanel
          state={state}
          dispatch={dispatch}
          content={content}
          characterId={state.party.chars[1].id}
          captureForPostprocess={captureForPostprocess}
        />
      </section>

      <section className={`${styles.panel} ${styles.statueL}`}>
        <StatuePanel side="left" />
      </section>

      <section className={`${styles.panel} ${styles.game}`}>
        {captureForPostprocess ? null : (
          <GameViewport state={state} dispatch={dispatch} world={world} viewportRef={gameViewportRef} webglError={webglError} />
        )}
        <ActivityLog entries={state.ui.activityLog ?? []} />
      </section>

      <section className={`${styles.panel} ${styles.statueR}`}>
        <StatuePanel side="right" />
      </section>

      <section className={`${styles.panel} ${styles.char4}`}>
        <PortraitPanel
          state={state}
          dispatch={dispatch}
          content={content}
          characterId={state.party.chars[3].id}
          captureForPostprocess={captureForPostprocess}
        />
      </section>

      <section className={`${styles.panel} ${styles.char1}`}>
        <PortraitPanel
          state={state}
          dispatch={dispatch}
          content={content}
          characterId={state.party.chars[0].id}
          captureForPostprocess={captureForPostprocess}
        />
      </section>

      <section className={`${styles.panel} ${styles.char3}`}>
        <PortraitPanel
          state={state}
          dispatch={dispatch}
          content={content}
          characterId={state.party.chars[2].id}
          captureForPostprocess={captureForPostprocess}
        />
      </section>

      <div className={styles.bottomRow}>
        <section className={`${styles.panel} ${styles.map}`}>
          <MinimapPanel state={state} />
        </section>

        <section className={`${styles.panel} ${styles.inventory}`}>
          <InventoryPanel state={state} dispatch={dispatch} content={content} />
        </section>

        <section className={`${styles.panel} ${styles.navigation}`}>
          <NavigationPanel
            state={state}
            dispatch={dispatch}
            pressedButtonId={navPadPressedId}
            onNavPadVisualPress={onNavPadVisualPress}
          />
        </section>
      </div>
    </div>
  )
}

