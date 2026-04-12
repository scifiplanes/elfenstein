import { describe, expect, it } from 'vitest'
import { ContentDB } from '../content/contentDb'
import { npcKindHpMax } from '../content/npcCombat'
import { reduce } from '../reducer'
import type { GameState, ItemId } from '../types'
import { makeInitialState } from './initialState'

const content = ContentDB.createDefault()

function withWurglepupAndItem(
  defId: 'SlimePhial' | 'CapturedSlime',
  itemId: ItemId,
): GameState {
  let s = makeInitialState(content)
  const px = s.floor.playerPos.x
  const py = s.floor.playerPos.y
  const hpMax = npcKindHpMax('Wurglepup')
  const wurm: GameState['floor']['npcs'][number] = {
    id: 'n_wurm_test',
    kind: 'Wurglepup',
    name: 'Wurglepup',
    pos: { x: px, y: py },
    status: 'hostile',
    hp: hpMax,
    hpMax,
    language: 'Mojibake',
    statuses: [],
  }
  const slots = s.party.inventory.slots.slice()
  slots[0] = itemId
  return {
    ...s,
    ui: { ...s.ui, screen: 'game' },
    floor: { ...s.floor, npcs: [wurm] },
    party: {
      ...s.party,
      items: { ...s.party.items, [itemId]: { id: itemId, defId, qty: 1 } },
      inventory: { ...s.party.inventory, slots },
    },
  }
}

describe('Slime phial / Captured slime NPC drag', () => {
  it('SlimePhial on Wurglepup captures into CapturedSlime', () => {
    const itemId = 'i_slime_phial_t' as ItemId
    let s = withWurglepupAndItem('SlimePhial', itemId)
    s = reduce(s, {
      type: 'drag/drop',
      payload: { itemId, source: { kind: 'inventorySlot', slotIndex: 0, itemId } },
      target: { kind: 'npc', npcId: 'n_wurm_test' },
    })
    expect(s.floor.npcs.some((n) => n.id === 'n_wurm_test')).toBe(false)
    expect(s.party.items[itemId]).toBeUndefined()
    const captured = Object.values(s.party.items).find((it) => it.defId === 'CapturedSlime')
    expect(captured?.qty).toBe(1)
    expect(s.ui.activityLog.some((e) => e.text.includes('Captured the slime'))).toBe(true)
  })

  it('CapturedSlime on Skeleton applies damage and consumes item', () => {
    const itemId = 'i_cap_slime_t' as ItemId
    let s = withWurglepupAndItem('CapturedSlime', itemId)
    const skHp = 40
    const sk: GameState['floor']['npcs'][number] = {
      id: 'n_sk_test',
      kind: 'Skeleton',
      name: 'Skeleton',
      pos: { x: s.floor.playerPos.x + 1, y: s.floor.playerPos.y },
      status: 'hostile',
      hp: skHp,
      hpMax: skHp,
      language: 'DeepGnome',
      statuses: [],
    }
    s = { ...s, floor: { ...s.floor, npcs: [sk] } }
    s = reduce(s, {
      type: 'drag/drop',
      payload: { itemId, source: { kind: 'inventorySlot', slotIndex: 0, itemId } },
      target: { kind: 'npc', npcId: 'n_sk_test' },
    })
    expect(s.party.items[itemId]).toBeUndefined()
    const skAfter = s.floor.npcs.find((n) => n.id === 'n_sk_test')
    expect(skAfter).toBeDefined()
    expect(skAfter!.hp).toBeGreaterThanOrEqual(skHp - 19)
    expect(skAfter!.hp).toBeLessThanOrEqual(skHp - 12)
    expect(s.ui.activityLog.some((e) => e.text.includes('dmg'))).toBe(true)
  })

  it('rejects capture and release during combat', () => {
    const phialId = 'i_slime_phial_c' as ItemId
    const capId = 'i_cap_slime_c' as ItemId
    let s = withWurglepupAndItem('SlimePhial', phialId)
    const sk: GameState['floor']['npcs'][number] = {
      id: 'n_sk_c',
      kind: 'Skeleton',
      name: 'Skeleton',
      pos: { x: s.floor.playerPos.x + 1, y: s.floor.playerPos.y },
      status: 'hostile',
      hp: 20,
      hpMax: 20,
      language: 'DeepGnome',
      statuses: [],
    }
    const combat = {
      encounterId: 'enc_test',
      startedAtMs: 0,
      participants: { party: ['c1'] as const, npcs: ['n_sk_c'] as const },
      turnQueue: [
        { kind: 'pc' as const, id: 'c1', initiative: 10 },
        { kind: 'npc' as const, id: 'n_sk_c', initiative: 8 },
      ],
      turnIndex: 0,
    }
    s = { ...s, floor: { ...s.floor, npcs: [s.floor.npcs[0]!, sk] }, combat }

    const afterCap = reduce(s, {
      type: 'drag/drop',
      payload: { itemId: phialId, source: { kind: 'inventorySlot', slotIndex: 0, itemId: phialId } },
      target: { kind: 'npc', npcId: 'n_wurm_test' },
    })
    expect(afterCap.floor.npcs.some((n) => n.kind === 'Wurglepup')).toBe(true)
    expect(afterCap.ui.activityLog.some((e) => e.text === 'Not while in combat.')).toBe(true)

    let s2 = withWurglepupAndItem('CapturedSlime', capId)
    s2 = { ...s2, floor: { ...s2.floor, npcs: [sk] }, combat }
    const afterRel = reduce(s2, {
      type: 'drag/drop',
      payload: { itemId: capId, source: { kind: 'inventorySlot', slotIndex: 0, itemId: capId } },
      target: { kind: 'npc', npcId: 'n_sk_c' },
    })
    expect(afterRel.party.items[capId]?.defId).toBe('CapturedSlime')
    expect(afterRel.ui.activityLog.some((e) => e.text === 'Not while in combat.')).toBe(true)
  })
})
