import type { Dispatch, MouseEvent, PointerEvent } from 'react'
import { useRef } from 'react'
import type { ContentDB } from '../../game/content/contentDb'
import type { Action } from '../../game/reducer'
import type { GameState, ItemId } from '../../game/types'
import { tradeStockRows, tradeWants } from '../../game/state/trade'
import { useCursor } from '../cursor/useCursor'
import {
  MODAL_CHROME_HIT_ATTR,
  modalChromeClickActivate,
  modalChromePointerUpActivate,
} from '../cursor/modalChromeActivate'
import invStyles from '../inventory/InventoryPanel.module.css'
import popup from '../shared/GamePopup.module.css'
import styles from './TradeModal.module.css'

export type TradeModalVariant = 'interactive' | 'capture'

function tradeStockDragItemId(index: number): ItemId {
  return (`__tradeStock_${index}` as unknown) as ItemId
}

export function TradeModal(props: {
  state: GameState
  dispatch: Dispatch<Action>
  content: ContentDB
  variant?: TradeModalVariant
}) {
  const { state, dispatch, content, variant = 'interactive' } = props
  const cursor = useCursor()
  const suppressCloseClick = useRef(false)
  const suppressClearAskClick = useRef(false)
  const suppressTradeClick = useRef(false)
  const ts = state.ui.tradeSession
  const visible =
    ts &&
    ((ts.kind === 'hub_innkeeper' && state.ui.screen === 'hub') || (ts.kind === 'floor_npc' && state.ui.screen === 'game'))

  if (!visible || !ts) return null

  const stockRows = tradeStockRows(state, ts)
  const wants = tradeWants(state, ts)
  const offerItem = ts.offerItemId ? state.party.items[ts.offerItemId] : null
  const offerDef = offerItem ? content.item(offerItem.defId) : null
  const askRow = ts.askStockIndex != null ? stockRows[ts.askStockIndex] : null
  const askDef = askRow ? content.item(askRow.defId) : null

  const title =
    ts.kind === 'hub_innkeeper' ? 'Innkeeper' : state.floor.npcs.find((n) => n.id === ts.npcId)?.name ?? 'Trader'

  const wantsSummary =
    wants.length === 0
      ? 'They are not buying anything right now.'
      : `They want: ${wants.map((id) => content.item(id).name).join(', ')}`

  const invCols = state.party.inventory.cols

  const close = () => dispatch({ type: 'trade/close' })
  const canTrade = Boolean(ts.offerItemId != null && ts.askStockIndex != null && askRow && askRow.qty > 0)

  const stopPanelClick = variant === 'interactive' ? (e: MouseEvent<HTMLDivElement>) => e.stopPropagation() : undefined

  const backdropHandlers =
    variant === 'interactive'
      ? {
          onPointerMove: cursor.onPointerMove,
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
          onPointerMove: cursor.onPointerMove,
          onPointerCancel: cursor.cancelDrag,
          onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
            const { drop } = cursor.endPointerUp(e)
            e.stopPropagation()
            if (drop) dispatch({ type: 'drag/drop', payload: drop.payload, target: drop.target, nowMs: performance.now() })
          },
        }
      : {}

  const panelMain = (
    <div className={panelInnerClass} onClick={stopPanelClick} {...panelPointerChrome}>
      <div className={popup.header}>
        <div className={popup.titleRow}>
          <div className={popup.title}>Trade · {title}</div>
        </div>
        <button
          className={popup.close}
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

        <div className={styles.sectionLabel}>Their stock</div>
        <div
          className={`${invStyles.grid} ${styles.tradeStockGrid}`}
          style={{ ['--inv-cols' as any]: invCols }}
        >
          {stockRows.map((row, i) => {
            const def = content.item(row.defId)
            const icon = def.icon.kind === 'emoji' ? def.icon.value : '□'
            const dragPayload = {
              itemId: tradeStockDragItemId(i),
              source: { kind: 'tradeStockSlot' as const, stockIndex: i },
            }
            const picked = ts.askStockIndex === i
            return (
              <div
                key={`${row.defId}_${i}`}
                className={`${invStyles.slot}${picked ? ` ${styles.stockSlotSelected}` : ''}`}
              >
                <button
                  type="button"
                  className={invStyles.item}
                  aria-disabled={row.qty < 1 || variant === 'capture'}
                  tabIndex={row.qty < 1 || variant === 'capture' ? -1 : 0}
                  aria-label={`${def.name} ×${row.qty}`}
                  onPointerDown={
                    variant === 'interactive'
                      ? (e) => {
                          if (row.qty < 1) return
                          cursor.beginPointerDown(dragPayload, e)
                        }
                      : undefined
                  }
                  onPointerMove={
                    variant === 'interactive'
                      ? (e) => {
                          cursor.onPointerMove(e)
                          e.stopPropagation()
                        }
                      : undefined
                  }
                  onPointerCancel={variant === 'interactive' ? cursor.cancelDrag : undefined}
                  onPointerUp={
                    variant === 'interactive'
                      ? (e) => {
                          const btn = e.currentTarget as HTMLButtonElement
                          const { drop, promotedToDrag } = cursor.endPointerUp(e)
                          e.stopPropagation()
                          if (drop) {
                            dispatch({ type: 'drag/drop', payload: drop.payload, target: drop.target, nowMs: performance.now() })
                            return
                          }
                          if (row.qty < 1) return
                          const r = btn.getBoundingClientRect()
                          const inButton =
                            e.clientX >= r.left &&
                            e.clientX <= r.right &&
                            e.clientY >= r.top &&
                            e.clientY <= r.bottom
                          if (!promotedToDrag || inButton) {
                            e.preventDefault()
                            dispatch({ type: 'trade/selectStock', stockIndex: i })
                          }
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

        <div className={styles.exchangeRow}>
          <div className={styles.exchangeCol}>
            <div className={styles.sectionLabel}>Your offer</div>
            <div className={styles.exchangeInvSlot}>
              <div
                className={`${invStyles.slot} ${!offerItem ? styles.slotTradeDashed : ''}`}
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
                      onPointerMove={
                        variant === 'interactive'
                          ? (e) => {
                              cursor.onPointerMove(e)
                              e.stopPropagation()
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

          <div className={styles.exchangeCol}>
            <div className={styles.sectionLabel}>You request</div>
            <div className={styles.exchangeInvSlot}>
              <div
                className={`${invStyles.slot} ${!askRow ? styles.slotTradeDashed : ''}`}
                data-drop-kind="tradeAskSlot"
              >
                {askRow && askDef ? (
                  <>
                    <span className={styles.slotIcon} aria-hidden>
                      {askDef.icon.kind === 'emoji' ? askDef.icon.value : '□'}
                    </span>
                    <div className={invStyles.qty}>×1</div>
                  </>
                ) : (
                  <span className={styles.slotHint}>Drag from their stock</span>
                )}
              </div>
            </div>
            {ts.askStockIndex != null && variant === 'interactive' ? (
              <button
                type="button"
                className={styles.clearAsk}
                {...{ [MODAL_CHROME_HIT_ATTR]: '' }}
                onPointerUp={(e) =>
                  modalChromePointerUpActivate(
                    cursor,
                    e,
                    () => dispatch({ type: 'trade/clearAsk' }),
                    suppressClearAskClick,
                  )
                }
                onClick={(e) =>
                  modalChromeClickActivate(e, () => dispatch({ type: 'trade/clearAsk' }), suppressClearAskClick)
                }
              >
                Clear request
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className={popup.footer}>
        <button
          className={canTrade ? popup.actionBtn : popup.actionBtnDisabled}
          type="button"
          {...{ [MODAL_CHROME_HIT_ATTR]: '' }}
          aria-disabled={!canTrade || variant === 'capture'}
          tabIndex={!canTrade || variant === 'capture' ? -1 : 0}
          onPointerUp={(e) =>
            modalChromePointerUpActivate(
              cursor,
              e,
              () => {
                if (!canTrade || variant === 'capture') return
                dispatch({ type: 'trade/execute' })
              },
              suppressTradeClick,
            )
          }
          onClick={(e) =>
            modalChromeClickActivate(
              e,
              () => {
                if (!canTrade || variant === 'capture') return
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
        </div>
      </div>
    )
  }

  /* Interactive: same HUD subtree as `InventoryPanel` — `HudLayout` `.panel.game` (stage-local coords). */
  return (
    <div className={styles.tradeGameOverlay} {...backdropHandlers}>
      {panelMain}
    </div>
  )
}
