import type { GameState, ItemDefId, ItemId, TradeSession, TradeStockRow } from '../types'
import { CAMP_INNKEEPER_TRADE, HUB_INNKEEPER_TRADE } from '../content/trading'
import { consumeItem, moveItemToInventorySlot } from './inventory'
import { makeDropJitter } from './dropJitter'

export function cloneTradeStock(rows: readonly TradeStockRow[]): TradeStockRow[] {
  return rows.map((r) => ({ defId: r.defId, qty: r.qty }))
}

export function tradeWants(state: GameState, ts: TradeSession): readonly ItemDefId[] {
  if (ts.kind === 'hub_innkeeper') return ts.wants
  const npc = state.floor.npcs.find((n) => n.id === ts.npcId)
  return npc?.trade?.wants ?? []
}

export function tradeStockRows(state: GameState, ts: TradeSession): readonly TradeStockRow[] {
  if (ts.kind === 'hub_innkeeper') return ts.stock
  const npc = state.floor.npcs.find((n) => n.id === ts.npcId)
  return npc?.trade?.stock ?? []
}

/** First free inventory index, or -1. */
export function firstFreeInventorySlot(state: GameState): number {
  return state.party.inventory.slots.findIndex((s) => s == null)
}

export function restowTradeOffer(state: GameState, offerItemId: ItemId | null): GameState {
  if (!offerItemId || !state.party.items[offerItemId]) return state
  const free = firstFreeInventorySlot(state)
  if (free < 0) return state
  return moveItemToInventorySlot(state, offerItemId, free)
}

export function closeTradeSession(state: GameState): GameState {
  const ts = state.ui.tradeSession
  if (!ts) return state
  const next = restowTradeOffer(state, ts.offerItemId)
  return { ...next, ui: { ...next.ui, tradeSession: undefined } }
}

export function openHubInnkeeperTrade(state: GameState): GameState {
  if (state.ui.screen !== 'hub' || state.ui.hubScene !== 'tavern') return state
  if (state.combat) return state
  const catalog = state.ui.hubKind === 'camp' ? CAMP_INNKEEPER_TRADE : HUB_INNKEEPER_TRADE
  const stock = cloneTradeStock(state.run.hubInnkeeperTradeStock ?? catalog.stock)
  const wants = [...catalog.wants]
  const session: TradeSession = {
    kind: 'hub_innkeeper',
    offerItemId: null,
    askStockIndex: null,
    stock,
    wants,
  }
  return { ...state, ui: { ...state.ui, tradeSession: session } }
}

export function openFloorNpcTrade(state: GameState, npcId: string): GameState {
  if (state.ui.screen !== 'game') return state
  if (state.combat) return state
  const npc = state.floor.npcs.find((n) => n.id === npcId)
  if (!npc || npc.status !== 'friendly' || !npc.trade) return state
  const session: TradeSession = {
    kind: 'floor_npc',
    npcId,
    offerItemId: null,
    askStockIndex: null,
  }
  return { ...state, ui: { ...state.ui, tradeSession: session, npcDialogFor: undefined } }
}

function mintItemToInventoryOrFloor(state: GameState, defId: ItemDefId, stableId: string, pos: { x: number; y: number }): GameState {
  const newId = (`i_${defId}_${state.floor.seed}_${stableId}` as unknown) as ItemId
  const items = { ...state.party.items, [newId]: { id: newId, defId, qty: 1 } }
  const inv = state.party.inventory
  const free = inv.slots.findIndex((s) => s == null)
  if (free >= 0) {
    const nextSlots = inv.slots.slice()
    nextSlots[free] = newId
    return { ...state, party: { ...state.party, items, inventory: { ...inv, slots: nextSlots } } }
  }
  const jitter = makeDropJitter({
    floorSeed: state.floor.seed,
    itemId: newId,
    nonce: Math.floor(state.nowMs),
    radius: state.render.dropJitterRadius ?? 0.28,
  })
  return {
    ...state,
    party: { ...state.party, items },
    floor: {
      ...state.floor,
      itemsOnFloor: state.floor.itemsOnFloor.concat([{ id: newId, pos: { ...pos }, jitter }]),
      floorGeomRevision: state.floor.floorGeomRevision + 1,
    },
  }
}

/** Apply inventory → offer slot when `defId` is wanted; returns null if invalid. */
export function tryStageTradeOffer(
  state: GameState,
  ts: TradeSession,
  itemId: ItemId,
  fromSlotIndex: number,
): GameState | null {
  const item = state.party.items[itemId]
  if (!item) return null
  const wants = tradeWants(state, ts)
  if (!wants.includes(item.defId)) return null
  if (state.party.inventory.slots[fromSlotIndex] !== itemId) return null

  let next = state
  const prevOffer = ts.offerItemId
  if (prevOffer && prevOffer !== itemId) {
    next = restowTradeOffer(next, prevOffer)
  }

  const inv = next.party.inventory
  if (inv.slots[fromSlotIndex] !== itemId) return null

  const slots = inv.slots.slice()
  slots[fromSlotIndex] = null
  next = { ...next, party: { ...next.party, inventory: { ...inv, slots } } }

  const nextSession: TradeSession =
    ts.kind === 'hub_innkeeper'
      ? { ...ts, offerItemId: itemId }
      : { ...ts, offerItemId: itemId }

  return { ...next, ui: { ...next.ui, tradeSession: nextSession } }
}

/** Move staged offer back into `dst` inventory slot. */
export function tryReturnTradeOfferToInventory(
  state: GameState,
  ts: TradeSession,
  offerItemId: ItemId,
  dstSlotIndex: number,
): GameState | null {
  if (ts.offerItemId !== offerItemId) return null
  const item = state.party.items[offerItemId]
  if (!item) return null
  const moved = moveItemToInventorySlot(state, offerItemId, dstSlotIndex)
  const nextSession: TradeSession =
    ts.kind === 'hub_innkeeper' ? { ...ts, offerItemId: null } : { ...ts, offerItemId: null }
  return { ...moved, ui: { ...moved.ui, tradeSession: nextSession } }
}

export function trySetTradeAsk(state: GameState, ts: TradeSession, stockIndex: number): GameState | null {
  const rows = tradeStockRows(state, ts)
  if (stockIndex < 0 || stockIndex >= rows.length) return null
  if (rows[stockIndex]!.qty < 1) return null
  const nextSession: TradeSession =
    ts.kind === 'hub_innkeeper' ? { ...ts, askStockIndex: stockIndex } : { ...ts, askStockIndex: stockIndex }
  return { ...state, ui: { ...state.ui, tradeSession: nextSession } }
}

export function tryClearTradeAsk(state: GameState, ts: TradeSession): GameState {
  const nextSession: TradeSession =
    ts.kind === 'hub_innkeeper' ? { ...ts, askStockIndex: null } : { ...ts, askStockIndex: null }
  return { ...state, ui: { ...state.ui, tradeSession: nextSession } }
}

export function tryExecuteTrade(state: GameState, ts: TradeSession, nowMs: number): GameState | null {
  const offerId = ts.offerItemId
  if (offerId == null || ts.askStockIndex == null) return null
  const offer = state.party.items[offerId]
  if (!offer) return null

  const wants = tradeWants(state, ts)
  if (!wants.includes(offer.defId)) return null

  const rows = tradeStockRows(state, ts)
  const idx = ts.askStockIndex
  if (idx < 0 || idx >= rows.length) return null
  const row = rows[idx]!
  if (row.qty < 1) return null

  let next = consumeItem(state, offerId)
  const gainDefId = row.defId
  const newRows = rows.map((r, i) => (i === idx ? { ...r, qty: Math.max(0, r.qty - 1) } : r))
  next = mintItemToInventoryOrFloor(next, gainDefId, `trade_${nowMs}_${idx}`, next.floor.playerPos)

  let run = next.run
  let floor = next.floor
  let nextSession: TradeSession

  if (ts.kind === 'hub_innkeeper') {
    run = { ...next.run, hubInnkeeperTradeStock: newRows }
    nextSession = {
      kind: 'hub_innkeeper',
      offerItemId: null,
      askStockIndex: null,
      stock: newRows,
      wants: ts.wants,
    }
  } else {
    const npcs = floor.npcs.map((n) => {
      if (n.id !== ts.npcId || !n.trade) return n
      return { ...n, trade: { ...n.trade, stock: newRows } }
    })
    floor = { ...floor, npcs, floorGeomRevision: floor.floorGeomRevision + 1 }
    nextSession = {
      kind: 'floor_npc',
      npcId: ts.npcId,
      offerItemId: null,
      askStockIndex: null,
    }
  }

  next = { ...next, run, floor, ui: { ...next.ui, tradeSession: nextSession } }
  return next
}
