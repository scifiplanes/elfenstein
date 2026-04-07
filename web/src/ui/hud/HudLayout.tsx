import type { Dispatch, RefObject } from 'react'
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
import { PaperdollModal } from '../paperdoll/PaperdollModal'
import { NpcDialogModal } from '../npc/NpcDialogModal'
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

  return (
    <div
      className={styles.root}
      data-capture={captureForPostprocess ? 'true' : 'false'}
      ref={rootRef}
      onPointerMove={interactive ? cursor.onPointerMove : undefined}
      onPointerUp={
        interactive
          ? (e) => {
              const result = cursor.endPointerUp(e)
              if (result) dispatch({ type: 'drag/drop', payload: result.payload, target: result.target })
            }
          : undefined
      }
    >
      <section className={`${styles.panel} ${styles.char2}`}>
        <PortraitPanel state={state} dispatch={dispatch} content={content} characterId={state.party.chars[1].id} />
      </section>

      <section className={`${styles.panel} ${styles.statueL}`}>
        <h3 className={styles.title}>Area for statue</h3>
        <StatuePanel side="left" />
      </section>

      <section className={`${styles.panel} ${styles.game}`}>
        {captureForPostprocess ? null : (
          <GameViewport state={state} dispatch={dispatch} world={world} viewportRef={gameViewportRef} webglError={webglError} />
        )}
        {state.ui.toast ? <div className={styles.toast}>{state.ui.toast.text}</div> : null}
      </section>

      <section className={`${styles.panel} ${styles.statueR}`}>
        <h3 className={styles.title}>Area for statue</h3>
        <StatuePanel side="right" />
      </section>

      <section className={`${styles.panel} ${styles.char4}`}>
        <PortraitPanel state={state} dispatch={dispatch} content={content} characterId={state.party.chars[3].id} />
      </section>

      <section className={`${styles.panel} ${styles.char1}`}>
        <PortraitPanel state={state} dispatch={dispatch} content={content} characterId={state.party.chars[0].id} />
      </section>

      <section className={`${styles.panel} ${styles.map}`}>
        <h3 className={styles.title}>MAP</h3>
        <MinimapPanel state={state} />
      </section>

      <section className={`${styles.panel} ${styles.navigation}`}>
        <h3 className={styles.title}>NAVIGATION</h3>
        <NavigationPanel
          state={state}
          dispatch={dispatch}
          pressedButtonId={navPadPressedId}
          onNavPadVisualPress={onNavPadVisualPress}
        />
      </section>

      <section className={`${styles.panel} ${styles.char3}`}>
        <PortraitPanel state={state} dispatch={dispatch} content={content} characterId={state.party.chars[2].id} />
      </section>

      <section className={`${styles.panel} ${styles.inventory}`}>
        <h3 className={styles.title}>INVENTORY</h3>
        <InventoryPanel state={state} dispatch={dispatch} content={content} />
      </section>

      {interactive ? <PaperdollModal state={state} dispatch={dispatch} content={content} /> : null}
      {interactive ? <NpcDialogModal state={state} dispatch={dispatch} content={content} /> : null}
    </div>
  )
}

