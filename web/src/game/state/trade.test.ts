import { describe, expect, it } from 'vitest'
import { ContentDB } from '../content/contentDb'
import { reduce } from '../reducer'
import { makeInitialState } from './initialState'
import type { ItemId } from '../types'
import { HUB_INNKEEPER_TRADE } from '../content/trading'

const content = ContentDB.createDefault()

function hubTavernWithTrade() {
  let state = makeInitialState(content)
  state = { ...state, ui: { ...state.ui, screen: 'hub', hubScene: 'tavern' as const } }
  return reduce(state, { type: 'hub/openTavernTrade' })
}

describe('trade', () => {
  it('opens hub session with innkeeper stock and wants', () => {
    const state = hubTavernWithTrade()
    expect(state.ui.tradeSession?.kind).toBe('hub_innkeeper')
    if (state.ui.tradeSession?.kind !== 'hub_innkeeper') throw new Error('expected hub session')
    expect(state.ui.tradeSession.stock).toEqual(HUB_INNKEEPER_TRADE.stock)
    expect(state.ui.tradeSession.wants).toEqual(HUB_INNKEEPER_TRADE.wants)
  })

  it('stages a wanted item via trade/stageOfferFromInventory', () => {
    let state = hubTavernWithTrade()
    const stoneIdx = state.party.inventory.slots.findIndex((id) => id && state.party.items[id]?.defId === 'Stone')
    expect(stoneIdx).toBeGreaterThanOrEqual(0)
    const stoneId = state.party.inventory.slots[stoneIdx]!
    state = reduce(state, { type: 'trade/stageOfferFromInventory', slotIndex: stoneIdx })
    expect(state.ui.tradeSession?.offerItemId).toBe(stoneId)
    expect(state.party.inventory.slots[stoneIdx]).toBeNull()
  })

  it('rejects staging a non-wanted item into the offer slot', () => {
    let state = hubTavernWithTrade()
    const clubIdx = state.party.inventory.slots.findIndex((id) => id && state.party.items[id]?.defId === 'Club')
    expect(clubIdx).toBeGreaterThanOrEqual(0)
    const clubId = state.party.inventory.slots[clubIdx]!
    state = reduce(state, {
      type: 'drag/drop',
      payload: { itemId: clubId, source: { kind: 'inventorySlot', slotIndex: clubIdx, itemId: clubId } },
      target: { kind: 'tradeOfferSlot' },
    })
    expect(state.ui.tradeSession?.offerItemId).toBeNull()
    expect(state.party.inventory.slots[clubIdx]).toBe(clubId)

    state = reduce(state, { type: 'trade/stageOfferFromInventory', slotIndex: clubIdx })
    expect(state.ui.tradeSession?.offerItemId).toBeNull()
    expect(state.party.inventory.slots[clubIdx]).toBe(clubId)
  })

  it('executes 1:1 trade and updates hub stock', () => {
    let state = hubTavernWithTrade()
    const stoneIdx = state.party.inventory.slots.findIndex((id) => id && state.party.items[id]?.defId === 'Stone')
    expect(stoneIdx).toBeGreaterThanOrEqual(0)
    const stoneId = state.party.inventory.slots[stoneIdx]!
    state = reduce(state, {
      type: 'drag/drop',
      payload: { itemId: stoneId, source: { kind: 'inventorySlot', slotIndex: stoneIdx, itemId: stoneId } },
      target: { kind: 'tradeOfferSlot' },
    })
    expect(state.ui.tradeSession?.kind).toBe('hub_innkeeper')
    if (state.ui.tradeSession?.kind !== 'hub_innkeeper') throw new Error('hub')
    expect(state.ui.tradeSession.offerItemId).toBe(stoneId)
    expect(state.party.inventory.slots[stoneIdx]).toBeNull()

    state = reduce(state, {
      type: 'drag/drop',
      payload: {
        itemId: '__tradeStock_0' as ItemId,
        source: { kind: 'tradeStockSlot', stockIndex: 0 },
      },
      target: { kind: 'tradeAskSlot' },
    })
    expect(state.ui.tradeSession?.askStockIndex).toBe(0)

    state = reduce(state, { type: 'trade/execute' })
    if (state.ui.tradeSession?.kind !== 'hub_innkeeper') throw new Error('hub')
    expect(state.party.items[stoneId]).toBeUndefined()
    expect(state.ui.tradeSession.offerItemId).toBeNull()
    expect(state.ui.tradeSession.askStockIndex).toBeNull()
    expect(state.ui.tradeSession.stock[0]!.qty).toBe(HUB_INNKEEPER_TRADE.stock[0]!.qty - 1)
    const gained = Object.values(state.party.items).filter((i) => i.defId === 'Flourball')
    expect(gained.length).toBeGreaterThanOrEqual(1)
    expect(state.run.hubInnkeeperTradeStock?.[0]?.qty).toBe(HUB_INNKEEPER_TRADE.stock[0]!.qty - 1)
  })

  it('restows offer when closing trade', () => {
    let state = hubTavernWithTrade()
    const stoneIdx = state.party.inventory.slots.findIndex((id) => id && state.party.items[id]?.defId === 'Stone')
    const stoneId = state.party.inventory.slots[stoneIdx]!
    state = reduce(state, {
      type: 'drag/drop',
      payload: { itemId: stoneId, source: { kind: 'inventorySlot', slotIndex: stoneIdx, itemId: stoneId } },
      target: { kind: 'tradeOfferSlot' },
    })
    state = reduce(state, { type: 'trade/close' })
    expect(state.ui.tradeSession).toBeUndefined()
    expect(state.party.inventory.slots.some((s) => s === stoneId)).toBe(true)
  })

  it('clears ask slot via action', () => {
    let state = hubTavernWithTrade()
    state = reduce(state, {
      type: 'drag/drop',
      payload: {
        itemId: '__tradeStock_1' as ItemId,
        source: { kind: 'tradeStockSlot', stockIndex: 1 },
      },
      target: { kind: 'tradeAskSlot' },
    })
    expect(state.ui.tradeSession?.kind).toBe('hub_innkeeper')
    const tsBeforeClear = state.ui.tradeSession
    if (tsBeforeClear?.kind !== 'hub_innkeeper') throw new Error('hub')
    expect(tsBeforeClear.askStockIndex).toBe(1)
    state = reduce(state, { type: 'trade/clearAsk' })
    const tsAfterClear = state.ui.tradeSession
    if (tsAfterClear?.kind !== 'hub_innkeeper') throw new Error('hub')
    expect(tsAfterClear.askStockIndex).toBeNull()
  })
})
