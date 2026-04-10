import { type Dispatch, type ReactNode, type RefObject, useRef } from 'react'
import type { ContentDB } from '../../game/content/contentDb'
import type { GameState } from '../../game/types'
import type { Action } from '../../game/reducer'
import styles from './HudLayout.module.css'
import { HubViewport } from '../hub/HubViewport'
import { GameViewport } from '../viewport/GameViewport'
import { InventoryPanel } from '../inventory/InventoryPanel'
import { CharacterEquipStrip } from '../portraits/CharacterEquipStrip'
import { PortraitPanel } from '../portraits/PortraitPanel'
import { MinimapPanel } from '../minimap/MinimapPanel'
import { NavigationPanel, type NavPadButtonId } from '../nav/NavigationPanel'
import { ActivityLog } from './ActivityLog'
import { CombatIndicator } from './CombatIndicator'
import { TradeModal } from '../trade/TradeModal'
import { InnkeeperTradeSpeechPortal } from '../trade/InnkeeperTradeSpeechPortal'
import { DeathModal } from '../death/DeathModal'
import { TitleScreen } from '../title/TitleScreen'
import { PaperdollModal } from '../paperdoll/PaperdollModal'
import { useCursor } from '../cursor/useCursor'
import { tradeWants } from '../../game/state/trade'
import type { WorldRenderer } from '../../world/WorldRenderer'
import { resolveGameViewportDragDropTarget } from '../viewport/resolveGameViewportDragDropTarget'

/**
 * `CharacterEquipStrip` horizontal nudge (px): **left** rails (**CHAR1/CHAR2**) shift **+n** toward the **right** / game;
 * **right** rails (**CHAR3/CHAR4**) use **−n** so placement **mirrors** (both toward the game column).
 */
const EQUIP_STRIP_NUDGE_TOWARD_GAME_PX = 55
/** `translateY` **up** (px); same value on **all** four strips (no horizontal mirror). */
const EQUIP_STRIP_NUDGE_UP_PX = 20
/**
 * Whole **`PortraitPanel`** (**portrait + vitals**) `translateX` toward the game column (px).
 * Left rails (**CHAR1/CHAR2**): **+n**; right rails (**CHAR3/CHAR4**): **−n** (mirror).
 */
const PORTRAIT_AND_VITALS_NUDGE_TOWARD_GAME_PX = 35

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
  const tsTrade = state.ui.tradeSession
  const tradeModalInteractiveOpen =
    interactive &&
    !captureForPostprocess &&
    tsTrade != null &&
    ((tsTrade.kind === 'hub_innkeeper' && state.ui.screen === 'hub') ||
      (tsTrade.kind === 'floor_npc' && state.ui.screen === 'game'))
  const tradeWantDefIds = state.ui.tradeSession ? tradeWants(state, state.ui.tradeSession) : undefined
  const innkeeperTradeSpeechLine =
    interactive &&
    !captureForPostprocess &&
    state.ui.screen === 'hub' &&
    state.ui.tradeSession?.kind === 'hub_innkeeper' &&
    state.ui.hubInnkeeperSpeech
      ? state.ui.hubInnkeeperSpeech
      : null
  const deathModalInteractiveOpen =
    interactive &&
    !captureForPostprocess &&
    (Boolean(state.ui.death) ||
      (state.ui.screen === 'game' && Boolean(state.ui.debugShowDeathPopup)))
  const fullHudModalInteractiveOpen =
    interactive &&
    !captureForPostprocess &&
    (state.ui.screen === 'title' || Boolean(state.ui.paperdollFor))
  /** Portrait-frame tap: handled at HUD root capture so it runs before child `pointerup`/`endPointerUp` and survives lost synthetic `click`. */
  const portraitTapRef = useRef<{ characterId: string; pointerId: number; x: number; y: number } | null>(null)
  const PORTRAIT_TAP_SLOP_PX = 28

  const isInsideRect = (x: number, y: number, r: DOMRectReadOnly) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom

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
      data-hud-root=""
      data-capture={captureForPostprocess ? 'true' : 'false'}
      data-title-screen={state.ui.screen === 'title' ? 'true' : undefined}
      ref={rootRef}
      onPointerMove={
        interactive
          ? (e) => {
              // Pointer position + DOM hover run on `window` (`CursorProvider`) so modals outside this
              // grid (e.g. settings) still update the hand. Here we only add 3D pick/floor virtual hover.
              if (state.ui.screen === 'game' && world && gameViewportRef?.current) {
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
              const { drop } = cursor.endPointerUp(e)
              if (!drop) return

              const nowMs = performance.now()
              const target =
                drop.target.kind === 'floorDrop'
                  ? resolveGameViewportDragDropTarget(
                      state,
                      world,
                      gameViewportRef?.current ?? null,
                      drop.target,
                      e.clientX,
                      e.clientY,
                    )
                  : drop.target
              dispatch({ type: 'drag/drop', payload: drop.payload, target, nowMs })
            }
          : undefined
      }
    >
      <section className={`${styles.panel} ${styles.char2}`}>
        <div className={styles.charRail}>
          <div className={styles.charRailPortraitGrow}>
            <PortraitPanel
              state={state}
              dispatch={dispatch}
              content={content}
              characterId={state.party.chars[1].id}
              captureForPostprocess={captureForPostprocess}
              portraitColumnTranslateXPx={PORTRAIT_AND_VITALS_NUDGE_TOWARD_GAME_PX}
            />
          </div>
          <CharacterEquipStrip
            state={state}
            dispatch={dispatch}
            content={content}
            characterId={state.party.chars[1].id}
            className={styles.charRailPushEnd}
            equipTranslateXPx={EQUIP_STRIP_NUDGE_TOWARD_GAME_PX}
            equipNudgeUpPx={EQUIP_STRIP_NUDGE_UP_PX}
            world={world}
            gameViewportRef={gameViewportRef}
          />
        </div>
      </section>

      <section className={`${styles.panel} ${styles.game} ${state.combat ? styles.gameCombat : ''}`}>
        {state.ui.screen === 'hub' ? (
          captureForPostprocess ? (
            <HubViewport state={state} dispatch={dispatch} viewportRef={gameViewportRef} variant="capture" />
          ) : (
            <HubViewport state={state} dispatch={dispatch} viewportRef={gameViewportRef} variant="interactive" />
          )
        ) : captureForPostprocess ? (
          // `GameViewport` is omitted in capture HUD (3D is not rasterized here). Keep a same-sized
          // shell so `gameViewportRef` (e.g. `captureGameViewportRef`) attaches and NPC dialog / layout
          // math match the interactive `GameViewport` box.
          <div ref={gameViewportRef} className={styles.gameViewportCaptureShell} aria-hidden />
        ) : (
          <GameViewport state={state} dispatch={dispatch} world={world} viewportRef={gameViewportRef} webglError={webglError} />
        )}
        {tradeModalInteractiveOpen ? (
          <TradeModal state={state} dispatch={dispatch} content={content} variant="interactive" />
        ) : null}
        <div
          className={`${styles.gameCornerStack}${
            tradeModalInteractiveOpen && state.ui.screen === 'hub' ? ` ${styles.gameCornerStackAboveTrade}` : ''
          }`}
        >
          <ActivityLog entries={state.ui.activityLog ?? []} />
          <CombatIndicator state={state} dispatch={dispatch} interactive={interactive} />
        </div>
        <InnkeeperTradeSpeechPortal
          text={innkeeperTradeSpeechLine ?? ''}
          autoHideMs={state.ui.hubInnkeeperSpeechTtlMs}
          gameViewportRef={gameViewportRef}
          active={Boolean(innkeeperTradeSpeechLine)}
          dispatch={dispatch}
        />
        {captureForPostprocess && captureNpcOverlay ? (
          <div className={styles.npcCaptureLayer}>{captureNpcOverlay}</div>
        ) : null}
        {deathModalInteractiveOpen ? (
          <div className={styles.gameCellModalHitLayer}>
            <DeathModal state={state} dispatch={dispatch} />
          </div>
        ) : null}
      </section>

      <section className={`${styles.panel} ${styles.char4}`}>
        <div className={styles.charRail}>
          <CharacterEquipStrip
            state={state}
            dispatch={dispatch}
            content={content}
            characterId={state.party.chars[3].id}
            equipTranslateXPx={-EQUIP_STRIP_NUDGE_TOWARD_GAME_PX}
            equipNudgeUpPx={EQUIP_STRIP_NUDGE_UP_PX}
            world={world}
            gameViewportRef={gameViewportRef}
          />
          <div className={`${styles.charRailPortraitGrow} ${styles.charRailPushEnd}`}>
            <PortraitPanel
              state={state}
              dispatch={dispatch}
              content={content}
              characterId={state.party.chars[3].id}
              captureForPostprocess={captureForPostprocess}
              portraitColumnTranslateXPx={-PORTRAIT_AND_VITALS_NUDGE_TOWARD_GAME_PX}
            />
          </div>
        </div>
      </section>

      <section className={`${styles.panel} ${styles.char1}`}>
        <div className={styles.charRail}>
          <div className={styles.charRailPortraitGrow}>
            <PortraitPanel
              state={state}
              dispatch={dispatch}
              content={content}
              characterId={state.party.chars[0].id}
              captureForPostprocess={captureForPostprocess}
              portraitColumnTranslateXPx={PORTRAIT_AND_VITALS_NUDGE_TOWARD_GAME_PX}
            />
          </div>
          <CharacterEquipStrip
            state={state}
            dispatch={dispatch}
            content={content}
            characterId={state.party.chars[0].id}
            className={styles.charRailPushEnd}
            equipTranslateXPx={EQUIP_STRIP_NUDGE_TOWARD_GAME_PX}
            equipNudgeUpPx={EQUIP_STRIP_NUDGE_UP_PX}
            world={world}
            gameViewportRef={gameViewportRef}
          />
        </div>
      </section>

      <section className={`${styles.panel} ${styles.char3}`}>
        <div className={styles.charRail}>
          <CharacterEquipStrip
            state={state}
            dispatch={dispatch}
            content={content}
            characterId={state.party.chars[2].id}
            equipTranslateXPx={-EQUIP_STRIP_NUDGE_TOWARD_GAME_PX}
            equipNudgeUpPx={EQUIP_STRIP_NUDGE_UP_PX}
            world={world}
            gameViewportRef={gameViewportRef}
          />
          <div className={`${styles.charRailPortraitGrow} ${styles.charRailPushEnd}`}>
            <PortraitPanel
              state={state}
              dispatch={dispatch}
              content={content}
              characterId={state.party.chars[2].id}
              captureForPostprocess={captureForPostprocess}
              portraitColumnTranslateXPx={-PORTRAIT_AND_VITALS_NUDGE_TOWARD_GAME_PX}
            />
          </div>
        </div>
      </section>

      <div className={styles.bottomRow}>
        <section className={`${styles.panel} ${styles.map}`}>
          <MinimapPanel state={state} />
        </section>

        <section className={`${styles.panel} ${styles.inventory}`}>
          <InventoryPanel
            state={state}
            dispatch={dispatch}
            content={content}
            tradeWantDefIds={tradeWantDefIds}
            world={world}
            gameViewportRef={gameViewportRef}
          />
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

      {fullHudModalInteractiveOpen ? (
        <div className={styles.fullHudInteractiveLayer}>
          <TitleScreen state={state} dispatch={dispatch} />
          <PaperdollModal state={state} dispatch={dispatch} content={content} />
        </div>
      ) : null}

      {captureForPostprocess && captureFullHudOverlay ? (
        <div className={styles.fullHudCaptureLayer}>{captureFullHudOverlay}</div>
      ) : null}
    </div>
  )
}

