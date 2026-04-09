import type { Dispatch, MouseEvent, PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import { useCursor } from '../cursor/useCursor'
import popup from '../shared/GamePopup.module.css'
import styles from './TavernTradeModal.module.css'

export type TavernTradeModalVariant = 'interactive' | 'capture'

export function TavernTradeModal(props: {
  state: GameState
  dispatch: Dispatch<Action>
  variant?: TavernTradeModalVariant
}) {
  const { state, dispatch, variant = 'interactive' } = props
  const cursor = useCursor()

  if (!state.ui.tavernTradeOpen || state.ui.screen !== 'hub') return null

  const close = () => dispatch({ type: 'hub/closeTavernTrade' })

  const stopPanelClick = variant === 'interactive' ? (e: MouseEvent<HTMLDivElement>) => e.stopPropagation() : undefined

  const backdropHandlers =
    variant === 'interactive'
      ? {
          onPointerMove: cursor.onPointerMove,
          onPointerCancel: cursor.cancelDrag,
          onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
            void cursor.endPointerUp(e)
          },
          onClick: (e: MouseEvent<HTMLDivElement>) => {
            if (e.target === e.currentTarget) close()
          },
        }
      : {}

  const tree = (
    <div className={`${styles.backdrop} ${popup.backdropDim}`} {...backdropHandlers}>
      <div
        className={`${popup.panel} ${popup.panelWidthMd} ${styles.modal}`}
        role="dialog"
        aria-modal="true"
        aria-label="Tavern trade"
        onClick={stopPanelClick}
      >
        <div className={styles.body}>Welcome, travellers…</div>
        <div className={popup.footer}>
          <button className={popup.actionBtn} type="button" onClick={() => close()}>
            Close
          </button>
        </div>
      </div>
    </div>
  )

  if (variant === 'capture') {
    return tree
  }

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(<div className={popup.modalPortalHitRoot}>{tree}</div>, document.body)
  }
  return tree
}
