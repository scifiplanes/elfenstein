import { describe, expect, it } from 'vitest'
import { ContentDB } from '../content/contentDb'
import { reduce } from '../reducer'
import { makeInitialState } from './initialState'
import { HUB_INNKEEPER_TRADE } from '../content/trading'
import {
  innkeeperBarterActivityLogLine,
  INNKEEPER_BARTER_LOG_AFTER_TEN,
  INNKEEPER_OPEN_TRADE_ACTIVITY_LOG,
} from '../npc/innkeeperBarterLog'
import { HUB_INNKEEPER_SPEECH_WELCOME_MS } from '../npc/innkeeperSpeechTiming'

const content = ContentDB.createDefault()

function hubTavernWithTrade() {
  let state = makeInitialState(content)
  state = { ...state, ui: { ...state.ui, screen: 'hub', hubScene: 'village' as const } }
  state = reduce(state, { type: 'hub/goTavern' })
  return reduce(state, { type: 'hub/openTavernTrade' })
}

describe('trade', () => {
  it('activity log when entering village tavern (innkeeper visible, before trade modal)', () => {
    let state = makeInitialState(content)
    state = { ...state, ui: { ...state.ui, screen: 'hub', hubScene: 'village' } }
    state = reduce(state, { type: 'hub/goTavern' })
    expect(state.ui.hubScene).toBe('tavern')
    const lastLog = state.ui.activityLog?.[state.ui.activityLog.length - 1]
    expect(lastLog?.text).toBe(INNKEEPER_OPEN_TRADE_ACTIVITY_LOG)
  })

  it('clears activity log when leaving tavern for village', () => {
    let state = makeInitialState(content)
    state = { ...state, ui: { ...state.ui, screen: 'hub', hubScene: 'village' } }
    state = reduce(state, { type: 'hub/goTavern' })
    expect((state.ui.activityLog ?? []).length).toBeGreaterThan(0)
    state = reduce(state, { type: 'hub/goVillage' })
    expect(state.ui.hubScene).toBe('village')
    expect(state.ui.activityLog).toEqual([])
  })

  it('opens hub session with innkeeper stock and wants', () => {
    const state = hubTavernWithTrade()
    expect(state.ui.tradeSession?.kind).toBe('hub_innkeeper')
    if (state.ui.tradeSession?.kind !== 'hub_innkeeper') throw new Error('expected hub session')
    expect(state.ui.tradeSession.stock).toEqual(HUB_INNKEEPER_TRADE.stock)
    expect(state.ui.tradeSession.wants).toEqual(HUB_INNKEEPER_TRADE.wants)
    expect(state.ui.hubInnkeeperSpeech).toMatch(/^Welcome\. I take .+\.$/)
    expect(state.ui.hubInnkeeperSpeechTtlMs).toBe(HUB_INNKEEPER_SPEECH_WELCOME_MS)
    const lastLog = state.ui.activityLog?.[state.ui.activityLog.length - 1]
    expect(lastLog?.text).toBe(INNKEEPER_OPEN_TRADE_ACTIVITY_LOG)
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

    state = reduce(state, { type: 'trade/selectStock', stockIndex: 0 })
    expect(state.ui.tradeSession?.askStockIndex).toBe(0)

    state = reduce(state, { type: 'trade/execute' })
    if (state.ui.tradeSession?.kind !== 'hub_innkeeper') throw new Error('hub')
    expect(state.party.items[stoneId]).toBeUndefined()
    expect(state.ui.tradeSession.offerItemId).toBeNull()
    expect(state.ui.tradeSession.askStockIndex).toBeNull()
    expect(state.ui.tradeSession.stock[0]!.defId).toBe('Flourball')
    expect(state.ui.tradeSession.stock[0]!.qty).toBe(HUB_INNKEEPER_TRADE.stock[0]!.qty - 1)
    const gained = Object.values(state.party.items).filter((i) => i.defId === 'Flourball')
    expect(gained.length).toBeGreaterThanOrEqual(1)
    expect(state.run.hubInnkeeperTradeStock?.[0]?.qty).toBe(HUB_INNKEEPER_TRADE.stock[0]!.qty - 1)
    expect(state.run.hubInnkeeperTradesCompleted).toBe(1)
    const lastLog = state.ui.activityLog?.[state.ui.activityLog.length - 1]
    expect(lastLog?.text).toBe(innkeeperBarterActivityLogLine(1))
  })

  it('drops stock row when last unit is bartered away', () => {
    let state = hubTavernWithTrade()
    const waterIdx = HUB_INNKEEPER_TRADE.stock.findIndex((r) => r.defId === 'WaterbagFull')
    expect(waterIdx).toBe(2)
    expect(HUB_INNKEEPER_TRADE.stock[waterIdx]!.qty).toBe(1)
    const stoneIdx = state.party.inventory.slots.findIndex((id) => id && state.party.items[id]?.defId === 'Stone')
    expect(stoneIdx).toBeGreaterThanOrEqual(0)
    state = reduce(state, { type: 'trade/stageOfferFromInventory', slotIndex: stoneIdx })
    state = reduce(state, { type: 'trade/selectStock', stockIndex: waterIdx })
    state = reduce(state, { type: 'trade/execute' })
    if (state.ui.tradeSession?.kind !== 'hub_innkeeper') throw new Error('hub')
    expect(state.ui.tradeSession.stock.some((r) => r.defId === 'WaterbagFull')).toBe(false)
    expect(state.run.hubInnkeeperTradeStock?.some((r) => r.defId === 'WaterbagFull')).toBe(false)
    expect(state.ui.tradeSession.stock.length).toBe(HUB_INNKEEPER_TRADE.stock.length - 1)
  })

  it('executes barter via stageOfferFromInventory + selectStock + trade/execute', () => {
    let state = hubTavernWithTrade()
    const stoneIdx = state.party.inventory.slots.findIndex((id) => id && state.party.items[id]?.defId === 'Stone')
    expect(stoneIdx).toBeGreaterThanOrEqual(0)
    state = reduce(state, { type: 'trade/stageOfferFromInventory', slotIndex: stoneIdx })
    expect(state.ui.tradeSession?.offerItemId).toBeTruthy()
    state = reduce(state, { type: 'trade/selectStock', stockIndex: 0 })
    expect(state.ui.tradeSession?.askStockIndex).toBe(0)
    state = reduce(state, { type: 'trade/execute' })
    expect(state.run.hubInnkeeperTradesCompleted).toBe(1)
    expect(state.ui.tradeSession?.offerItemId).toBeNull()
  })

  it('innkeeper barter log uses line 11+ after ten trades', () => {
    expect(innkeeperBarterActivityLogLine(11)).toBe(INNKEEPER_BARTER_LOG_AFTER_TEN)
    expect(innkeeperBarterActivityLogLine(99)).toBe(INNKEEPER_BARTER_LOG_AFTER_TEN)
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

  it('trade/execute is a no-op when offer and request are both empty', () => {
    let state = hubTavernWithTrade()
    const beforeSession = state.ui.tradeSession
    const beforeParty = state.party
    state = reduce(state, { type: 'trade/execute' })
    expect(state.ui.tradeSession).toEqual(beforeSession)
    expect(state.party).toEqual(beforeParty)
  })

  it('trade/execute with request only sets hub innkeeper speech and does not trade', () => {
    let state = hubTavernWithTrade()
    state = reduce(state, { type: 'trade/selectStock', stockIndex: 0 })
    state = reduce(state, { type: 'trade/execute' })
    expect(state.ui.hubInnkeeperSpeech).toBeTruthy()
    expect(state.ui.tradeSession?.kind).toBe('hub_innkeeper')
    if (state.ui.tradeSession?.kind === 'hub_innkeeper') {
      expect(state.ui.tradeSession.askStockIndex).toBe(0)
      expect(state.ui.tradeSession.stock[0]!.qty).toBe(HUB_INNKEEPER_TRADE.stock[0]!.qty)
    }
  })

  it('trade/execute gift consumes staged offer without taking stock', () => {
    let state = hubTavernWithTrade()
    const stoneIdx = state.party.inventory.slots.findIndex((id) => id && state.party.items[id]?.defId === 'Stone')
    expect(stoneIdx).toBeGreaterThanOrEqual(0)
    const stoneId = state.party.inventory.slots[stoneIdx]!
    state = reduce(state, {
      type: 'drag/drop',
      payload: { itemId: stoneId, source: { kind: 'inventorySlot', slotIndex: stoneIdx, itemId: stoneId } },
      target: { kind: 'tradeOfferSlot' },
    })
    const stockBefore =
      state.ui.tradeSession?.kind === 'hub_innkeeper' ? state.ui.tradeSession.stock.map((r) => ({ ...r })) : []
    state = reduce(state, { type: 'trade/execute' })
    expect(state.party.items[stoneId]).toBeUndefined()
    expect(state.ui.tradeSession?.offerItemId).toBeNull()
    expect(state.ui.hubInnkeeperSpeech).toBeTruthy()
    if (state.ui.tradeSession?.kind === 'hub_innkeeper') {
      expect(state.ui.tradeSession.stock).toEqual(stockBefore)
    }
  })

  it('clears stock selection via trade/clearAsk or by toggling the same stock', () => {
    let state = hubTavernWithTrade()
    state = reduce(state, { type: 'trade/selectStock', stockIndex: 1 })
    expect(state.ui.tradeSession?.kind).toBe('hub_innkeeper')
    const tsBeforeClear = state.ui.tradeSession
    if (tsBeforeClear?.kind !== 'hub_innkeeper') throw new Error('hub')
    expect(tsBeforeClear.askStockIndex).toBe(1)
    state = reduce(state, { type: 'trade/clearAsk' })
    let tsAfter = state.ui.tradeSession
    if (tsAfter?.kind !== 'hub_innkeeper') throw new Error('hub')
    expect(tsAfter.askStockIndex).toBeNull()

    state = reduce(state, { type: 'trade/selectStock', stockIndex: 0 })
    expect(state.ui.tradeSession?.askStockIndex).toBe(0)
    state = reduce(state, { type: 'trade/selectStock', stockIndex: 0 })
    tsAfter = state.ui.tradeSession
    if (tsAfter?.kind !== 'hub_innkeeper') throw new Error('hub')
    expect(tsAfter.askStockIndex).toBeNull()
  })
})
