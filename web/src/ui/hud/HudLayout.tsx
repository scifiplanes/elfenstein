import type { Dispatch } from 'react'
import type { ContentDB } from '../../game/content/contentDb'
import type { GameState } from '../../game/types'
import type { Action } from '../../game/reducer'
import styles from './HudLayout.module.css'
import { GameViewport } from '../viewport/GameViewport'
import { InventoryPanel } from '../inventory/InventoryPanel'
import { PortraitPanel } from '../portraits/PortraitPanel'
import { MinimapPanel } from '../minimap/MinimapPanel'
import { NavigationPanel } from '../nav/NavigationPanel'
import { StatuePanel } from '../statue/StatuePanel'
import { PaperdollModal } from '../paperdoll/PaperdollModal'
import { NpcDialogModal } from '../npc/NpcDialogModal'
import { useCursor } from '../cursor/useCursor'

export function HudLayout(props: { state: GameState; dispatch: Dispatch<Action>; content: ContentDB }) {
  const { state, dispatch, content } = props
  const cursor = useCursor()

  return (
    <div
      className={styles.root}
      onPointerMove={cursor.onPointerMove}
      onPointerUp={(e) => {
        const result = cursor.endPointerUp(e)
        if (result) dispatch({ type: 'drag/drop', payload: result.payload, target: result.target })
      }}
    >
      <section className={`${styles.panel} ${styles.char2}`}>
        <h3 className={styles.title}>CHAR2</h3>
        <PortraitPanel state={state} dispatch={dispatch} content={content} characterId={state.party.chars[1].id} />
      </section>

      <section className={`${styles.panel} ${styles.statueL}`}>
        <h3 className={styles.title}>Area for statue</h3>
        <StatuePanel side="left" />
      </section>

      <section className={`${styles.panel} ${styles.game}`}>
        <GameViewport state={state} dispatch={dispatch} />
        {state.ui.toast ? <div className={styles.toast}>{state.ui.toast.text}</div> : null}
      </section>

      <section className={`${styles.panel} ${styles.statueR}`}>
        <h3 className={styles.title}>Area for statue</h3>
        <StatuePanel side="right" />
      </section>

      <section className={`${styles.panel} ${styles.char4}`}>
        <h3 className={styles.title}>CHAR4</h3>
        <PortraitPanel state={state} dispatch={dispatch} content={content} characterId={state.party.chars[3].id} />
      </section>

      <section className={`${styles.panel} ${styles.char1}`}>
        <h3 className={styles.title}>CHAR1</h3>
        <PortraitPanel state={state} dispatch={dispatch} content={content} characterId={state.party.chars[0].id} />
      </section>

      <section className={`${styles.panel} ${styles.map}`}>
        <h3 className={styles.title}>MAP</h3>
        <MinimapPanel state={state} />
      </section>

      <section className={`${styles.panel} ${styles.nav}`}>
        <h3 className={styles.title}>NAVIGA</h3>
        <NavigationPanel state={state} />
      </section>

      <section className={`${styles.panel} ${styles.char3}`}>
        <h3 className={styles.title}>CHAR3</h3>
        <PortraitPanel state={state} dispatch={dispatch} content={content} characterId={state.party.chars[2].id} />
      </section>

      <section className={`${styles.panel} ${styles.inventory}`}>
        <h3 className={styles.title}>INVENTORY</h3>
        <InventoryPanel state={state} dispatch={dispatch} content={content} />
      </section>

      <PaperdollModal state={state} dispatch={dispatch} content={content} />
      <NpcDialogModal state={state} dispatch={dispatch} content={content} />
    </div>
  )
}

