import { type Dispatch, type ReactNode, type RefObject, useRef } from 'react'
import type { ContentDB } from '../../game/content/contentDb'
import type { GameState } from '../../game/types'
import type { Action } from '../../game/reducer'
import styles from './HudLayout.module.css'
import { GameViewport } from '../viewport/GameViewport'
import { InventoryPanel } from '../inventory/InventoryPanel'
import { PortraitPanel } from '../portraits/PortraitPanel'
import { MinimapPanel } from '../minimap/MinimapPanel'
import { NavigationPanel, type NavPadButtonId } from '../nav/NavigationPanel'
import { ActivityLog } from './ActivityLog'
import { CombatIndicator } from './CombatIndicator'
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
  /** Capture HUD only: centered in the game cell (e.g. dithered NPC dialog). */
  captureNpcOverlay?: ReactNode
  /** Capture HUD only: full-bleed over the whole HUD grid (e.g. title / death / paperdoll). */
  captureFullHudOverlay?: ReactNode
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
    captureNpcOverlay,
    captureFullHudOverlay,
  } = props
  const cursor = useCursor()
  /** Portrait-frame tap: handled at HUD root capture so it runs before child `pointerup`/`endPointerUp` and survives lost synthetic `click`. */
  const portraitTapRef = useRef<{ characterId: string; pointerId: number; x: number; y: number } | null>(null)
  const PORTRAIT_TAP_SLOP_PX = 28

  const isInsideRect = (x: number, y: number, r: DOMRectReadOnly) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom

  const worldPointToCell = (state: GameState, p: { x: number; z: number }) => {
    // Floor tiles are centered at (gridX - w/2, gridY - h/2) in world space.
    const gx = Math.floor(p.x + state.floor.w / 2 + 0.5)
    const gy = Math.floor(p.z + state.floor.h / 2 + 0.5)
    return { x: gx, y: gy }
  }

  const clampByManhattanRange = (player: { x: number; y: number }, target: { x: number; y: number }, range: number) => {
    const dx = target.x - player.x
    const dy = target.y - player.y
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)
    const dist = adx + ady
    if (dist <= range) return target
    const sx = dx < 0 ? -1 : 1
    const sy = dy < 0 ? -1 : 1
    const useX = Math.min(adx, range)
    const rem = Math.max(0, range - useX)
    const useY = Math.min(ady, rem)
    return { x: player.x + sx * useX, y: player.y + sy * useY }
  }

  const findNearestFloorCell = (state: GameState, start: { x: number; y: number }, maxRange: number) => {
    const { w, h, tiles, playerPos } = state.floor
    const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h
    const isFloor = (x: number, y: number) => tiles[x + y * w] === 'floor'
    const withinPlayerRange = (x: number, y: number) => Math.abs(x - playerPos.x) + Math.abs(y - playerPos.y) <= maxRange

    if (inBounds(start.x, start.y) && isFloor(start.x, start.y) && withinPlayerRange(start.x, start.y)) return start

    for (let r = 1; r <= maxRange; r++) {
      for (let dx = -r; dx <= r; dx++) {
        const dy = r - Math.abs(dx)
        const candidates = [
          { x: start.x + dx, y: start.y + dy },
          { x: start.x + dx, y: start.y - dy },
        ]
        for (const c of candidates) {
          if (!inBounds(c.x, c.y)) continue
          if (!withinPlayerRange(c.x, c.y)) continue
          if (!isFloor(c.x, c.y)) continue
          return c
        }
      }
    }
    return null
  }

  const cancelPortraitTap = (args: { pointerId?: number; reason: 'cancel' | 'slop' | 'drag' }) => {
    const g = portraitTapRef.current
    if (!g) return
    if (args.pointerId != null && g.pointerId !== args.pointerId) return
    portraitTapRef.current = null
    dispatch({ type: 'ui/portraitIdleCancel', characterId: g.characterId })
  }

  return (
    <div
      className={styles.root}
      data-capture={captureForPostprocess ? 'true' : 'false'}
      ref={rootRef}
      onPointerMove={
        interactive
          ? (e) => {
              cursor.onPointerMove(e)

              // 3D viewport hover: inject a virtual hover target so the cursor can become active
              // over pickable scene objects even when pointer events are captured by another element.
              if (world && gameViewportRef?.current) {
                const rect = gameViewportRef.current.getBoundingClientRect()
                if (rect && isInsideRect(e.clientX, e.clientY, rect)) {
                  const pick = world.pickObject(rect, e.clientX, e.clientY)
                  if (!pick) {
                    const at = { left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }
                    cursor.setVirtualHover({ kind: 'floorDrop' }, at)
                  } else {
                    const at = world.projectWorldToClient(rect, pick.worldPos)
                    const hoverRect = { left: at.x, right: at.x, top: at.y, bottom: at.y }
                    if (pick.kind === 'poi') cursor.setVirtualHover({ kind: 'poi', poiId: pick.id }, hoverRect)
                    if (pick.kind === 'npc') cursor.setVirtualHover({ kind: 'npc', npcId: pick.id }, hoverRect)
                    if (pick.kind === 'floorItem') cursor.setVirtualHover({ kind: 'floorItem', itemId: pick.id }, hoverRect)
                  }
                }
              }

              const g = portraitTapRef.current
              if (!g) return
              if (g.pointerId !== e.pointerId) return
              if (cursor.state.dragging?.started) return cancelPortraitTap({ pointerId: e.pointerId, reason: 'drag' })
              const dx = e.clientX - g.x
              const dy = e.clientY - g.y
              if (dx * dx + dy * dy > PORTRAIT_TAP_SLOP_PX * PORTRAIT_TAP_SLOP_PX) return cancelPortraitTap({ pointerId: e.pointerId, reason: 'slop' })
            }
          : undefined
      }
      onPointerCancel={
        interactive
          ? (e) => {
              cancelPortraitTap({ pointerId: e.pointerId, reason: 'cancel' })
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
              // Start the visual idle pulse immediately on press (not release).
              dispatch({ type: 'ui/portraitFrameTap', characterId })
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
              // No action on release: the idle pulse already started on pointerdown.
            }
          : undefined
      }
      onPointerUp={
        interactive
          ? (e) => {
              const result = cursor.endPointerUp(e)
              if (!result) return

              // Cursor-aimed 3D floor drop: if the drop resolves to `floorDrop` and the pointer is
              // over the 3D viewport, compute a snapped grid cell near the ray hit.
              if (result.target.kind === 'floorDrop' && world && gameViewportRef?.current) {
                const rect = gameViewportRef.current.getBoundingClientRect()
                if (rect && isInsideRect(e.clientX, e.clientY, rect)) {
                  const p = world.pickFloorPoint(rect, e.clientX, e.clientY)
                  if (p) {
                    const rawCell = worldPointToCell(state, { x: p.x, z: p.z })
                    const range = Math.max(0, Math.round(Number(state.render.dropRangeCells ?? 0)))
                    const clamped = clampByManhattanRange(state.floor.playerPos, rawCell, range)
                    const snapped = findNearestFloorCell(state, clamped, range)
                    if (snapped) {
                      dispatch({
                        type: 'drag/drop',
                        payload: result.payload,
                        target: { kind: 'floorDrop', dropPos: snapped },
                        nowMs: performance.now(),
                      })
                      return
                    }
                  }
                }
              }

              dispatch({ type: 'drag/drop', payload: result.payload, target: result.target, nowMs: performance.now() })
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

      <section className={`${styles.panel} ${styles.game} ${state.combat ? styles.gameCombat : ''}`}>
        {captureForPostprocess ? (
          // `GameViewport` is omitted in capture HUD (3D is not rasterized here). Keep a same-sized
          // shell so `gameViewportRef` (e.g. `captureGameViewportRef`) attaches and NPC dialog / layout
          // math match the interactive `GameViewport` box.
          <div ref={gameViewportRef} className={styles.gameViewportCaptureShell} aria-hidden />
        ) : (
          <GameViewport state={state} dispatch={dispatch} world={world} viewportRef={gameViewportRef} webglError={webglError} />
        )}
        <div className={styles.gameCornerStack}>
          <ActivityLog entries={state.ui.activityLog ?? []} />
          <CombatIndicator state={state} dispatch={dispatch} interactive={interactive} />
        </div>
        {captureForPostprocess && captureNpcOverlay ? (
          <div className={styles.npcCaptureLayer}>{captureNpcOverlay}</div>
        ) : null}
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

      {captureForPostprocess && captureFullHudOverlay ? (
        <div className={styles.fullHudCaptureLayer}>{captureFullHudOverlay}</div>
      ) : null}
    </div>
  )
}

