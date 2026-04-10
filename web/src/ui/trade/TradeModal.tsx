import type { Dispatch, MouseEvent, PointerEvent } from 'react'
import { useRef } from 'react'
import type { ContentDB } from '../../game/content/contentDb'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import { tradeStockRows, tradeWants } from '../../game/state/trade'
import { useCursor } from '../cursor/useCursor'
import {
  MODAL_CHROME_HIT_ATTR,
  modalChromeClickActivate,
  modalChromePointerUpActivate,
} from '../cursor/modalChromeActivate'
import invStyles from '../inventory/InventoryPanel.module.css'
import npcDlgStyles from '../npc/NpcDialogModal.module.css'
import popup from '../shared/GamePopup.module.css'
import styles from './TradeModal.module.css'

export type TradeModalVariant = 'interactive' | 'capture'

export function TradeModal(props: {
  state: GameState
  dispatch: Dispatch<Action>
  content: ContentDB
  variant?: TradeModalVariant
}) {
  const { state, dispatch, content, variant = 'interactive' } = props
  const cursor = useCursor()
  const suppressCloseClick = useRef(false)
  const suppressTradeClick = useRef(false)
  const ts = state.ui.tradeSession
  const visible =
    ts &&
    ((ts.kind === 'hub_innkeeper' && state.ui.screen === 'hub') || (ts.kind === 'floor_npc' && state.ui.screen === 'game'))

  const invCols = state.party.inventory.cols

  if (!visible || !ts) return null

  const stockRows = tradeStockRows(state, ts)
  const wants = tradeWants(state, ts)
  const offerItem = ts.offerItemId ? state.party.items[ts.offerItemId] : null
  const offerDef = offerItem ? content.item(offerItem.defId) : null

  const title =
    ts.kind === 'hub_innkeeper' ? 'Innkeeper' : state.floor.npcs.find((n) => n.id === ts.npcId)?.name ?? 'Trader'

  const wantsSummary =
    wants.length === 0
      ? 'They are not buying anything right now.'
      : `They want: ${wants.map((id) => content.item(id).name).join(', ')}`

  const close = () => dispatch({ type: 'trade/close' })
  /** Interactive hub speech renders in `HudLayout` above tavern layers; capture keeps it here for dither. */
  const hubSpeechForCapture =
    variant === 'capture' && ts.kind === 'hub_innkeeper' && state.ui.hubInnkeeperSpeech
      ? state.ui.hubInnkeeperSpeech
      : null

  const stopPanelClick = variant === 'interactive' ? (e: MouseEvent<HTMLDivElement>) => e.stopPropagation() : undefined

  const backdropHandlers =
    variant === 'interactive'
      ? {
          onPointerCancel: cursor.cancelDrag,
          onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
            const { drop } = cursor.endPointerUp(e)
            if (drop) dispatch({ type: 'drag/drop', payload: drop.payload, target: drop.target, nowMs: performance.now() })
          },
          onClick: (e: MouseEvent<HTMLDivElement>) => {
            if (e.target === e.currentTarget) close()
          },
        }
      : {}

  const panelChrome = `${popup.panel} ${styles.panelWide}`
  const panelInnerClass =
    variant === 'capture'
      ? `${panelChrome} ${styles.capturePanel}`
      : `${panelChrome} ${styles.tradePanelInGameCell}`

  const panelPointerChrome =
    variant === 'interactive'
      ? {
          onPointerCancel: cursor.cancelDrag,
          onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
            const { drop } = cursor.endPointerUp(e)
            e.stopPropagation()
            if (drop) dispatch({ type: 'drag/drop', payload: drop.payload, target: drop.target, nowMs: performance.now() })
          },
        }
      : {}

  const speechStripCapture =
    hubSpeechForCapture != null ? (
      <div className={`${npcDlgStyles.speechStrip} ${styles.tradeSpeechDockCapture}`}>
        <div className={popup.body}>{hubSpeechForCapture}</div>
      </div>
    ) : null

  const panelMain = (
    <div className={panelInnerClass} onClick={stopPanelClick} {...panelPointerChrome}>
      <div className={popup.header}>
        <div className={popup.titleRow}>
          <div className={popup.title}>Trade · {title}</div>
        </div>
        <button
          className={`${popup.close} ${styles.tradeChromeBtn}`}
          type="button"
          {...{ [MODAL_CHROME_HIT_ATTR]: '' }}
          onPointerUp={(e) => modalChromePointerUpActivate(cursor, e, close, suppressCloseClick)}
          onClick={(e) => modalChromeClickActivate(e, close, suppressCloseClick)}
        >
          Close
        </button>
      </div>

      <div className={popup.body}>
        <div className={styles.wantsLine}>{wantsSummary}</div>

        <div className={styles.tradeMainRow}>
          <div className={styles.tradeStockGrow}>
            <div className={styles.sectionLabel}>Their stock — Click to choose what you want to barter</div>
            <div className={styles.tradeStockGridInv} style={{ ['--inv-cols' as any]: invCols }}>
              {stockRows.map((row, i) => {
                const def = content.item(row.defId)
                const icon = def.icon.kind === 'emoji' ? def.icon.value : '□'
                const picked = ts.askStockIndex === i
                return (
                  <div
                    key={`${row.defId}_${i}`}
                    className={`${invStyles.slot}${picked ? ` ${styles.stockSlotSelected}` : ''}`}
                    data-drop-kind="tradeStockSlot"
                    data-trade-stock-index={i}
                  >
                    <button
                      type="button"
                      className={invStyles.item}
                      aria-disabled={row.qty < 1 || variant === 'capture'}
                      tabIndex={row.qty < 1 || variant === 'capture' ? -1 : 0}
                      aria-label={`${def.name} ×${row.qty}${picked ? ' (selected for trade)' : ''}`}
                      onClick={
                        variant === 'interactive' && row.qty >= 1
                          ? (e) => {
                              e.stopPropagation()
                              dispatch({ type: 'trade/selectStock', stockIndex: i })
                            }
                          : undefined
                      }
                    >
                      {icon}
                    </button>
                    {row.qty > 1 ? <div className={invStyles.qty}>×{row.qty}</div> : null}
                  </div>
                )
              })}
            </div>
          </div>

          <div className={styles.tradeExchangeCol}>
            <div className={styles.sectionLabel}>Your offer</div>
            <div
              className={`${invStyles.slot} ${styles.exchangeSlot} ${!offerItem ? styles.slotTradeDashed : ''}`}
              data-drop-kind="tradeOfferSlot"
            >
              {offerItem && offerDef ? (
                <>
                  <button
                    type="button"
                    className={invStyles.item}
                    disabled={variant === 'capture'}
                    aria-label={offerDef.name}
                    onPointerDown={
                      variant === 'interactive' && ts.offerItemId
                        ? (e) => {
                            cursor.beginPointerDown(
                              { itemId: ts.offerItemId!, source: { kind: 'tradeOffer', itemId: ts.offerItemId! } },
                              e,
                            )
                          }
                        : undefined
                    }
                    onPointerCancel={variant === 'interactive' ? cursor.cancelDrag : undefined}
                  >
                    {offerDef.icon.kind === 'emoji' ? offerDef.icon.value : '□'}
                  </button>
                  {offerItem.qty > 1 ? <div className={invStyles.qty}>×{offerItem.qty}</div> : null}
                </>
              ) : (
                <span className={styles.slotHint}>Drag wanted item here</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={popup.footer}>
        <button
          className={`${popup.close} ${styles.tradeChromeBtn} ${styles.tradeExecuteWide}`}
          type="button"
          {...{ [MODAL_CHROME_HIT_ATTR]: '' }}
          aria-disabled={variant === 'capture'}
          tabIndex={variant === 'capture' ? -1 : 0}
          onPointerUp={(e) =>
            modalChromePointerUpActivate(
              cursor,
              e,
              () => {
                if (variant === 'capture') return
                dispatch({ type: 'trade/execute' })
              },
              suppressTradeClick,
            )
          }
          onClick={(e) =>
            modalChromeClickActivate(
              e,
              () => {
                if (variant === 'capture') return
                dispatch({ type: 'trade/execute' })
              },
              suppressTradeClick,
            )
          }
        >
          Trade
        </button>
      </div>
    </div>
  )

  if (variant === 'capture') {
    return (
      <div className={styles.captureInGameCell} aria-hidden>
        <div className={styles.captureRoot}>
          {panelMain}
          {speechStripCapture}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.tradeGameOverlay} {...backdropHandlers}>
      {panelMain}
    </div>
  )
}
