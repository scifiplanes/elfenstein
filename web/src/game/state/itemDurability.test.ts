import { describe, expect, it } from 'vitest'
import { ContentDB } from '../content/contentDb'
import type { ItemId } from '../types'
import { makeInitialState } from './initialState'
import { applyItemDurabilityWear, destroyPartyItem, inventoryItemFromDef } from './itemDurability'

const content = ContentDB.createDefault()

describe('itemDurability', () => {
  it('inventoryItemFromDef sets durability for defs with durabilityMax', () => {
    const row = inventoryItemFromDef(content, 'Club', 'x' as ItemId, 1)
    expect(row.durability).toBe(content.item('Club').durabilityMax)
  })

  it('weapon hit reduces durability', () => {
    let s = makeInitialState(content)
    const id = 'i_club' as ItemId
    const before = s.party.items[id]!.durability!
    s = applyItemDurabilityWear(s, content, id, 'weaponHit', s.party.chars[0]!.id)
    expect(s.party.items[id]?.durability).toBe(before - 1)
  })

  it('removes item and pushes portrait toast when durability reaches 0', () => {
    let s = makeInitialState(content)
    const id = 'i_club' as ItemId
    s = {
      ...s,
      render: { ...s.render, itemDurabilityWeaponHitCost: 99 },
      party: {
        ...s.party,
        items: { ...s.party.items, [id]: { ...s.party.items[id]!, durability: 1 } },
      },
    }
    s = applyItemDurabilityWear(s, content, id, 'weaponHit', s.party.chars[0]!.id)
    expect(s.party.items[id]).toBeUndefined()
    expect(s.ui.portraitToasts?.some((t) => t.text.includes('broke'))).toBe(true)
  })

  it('no wear when itemDurabilityEnabled is off', () => {
    let s = makeInitialState(content)
    const id = 'i_club' as ItemId
    const before = s.party.items[id]!.durability!
    s = { ...s, render: { ...s.render, itemDurabilityEnabled: 0 } }
    s = applyItemDurabilityWear(s, content, id, 'weaponHit', s.party.chars[0]!.id)
    expect(s.party.items[id]?.durability).toBe(before)
  })

  it('skips items whose def has no durabilityMax', () => {
    let s = makeInitialState(content)
    const id = 'i_mush' as ItemId
    const before = s.party.items[id]
    s = applyItemDurabilityWear(s, content, id, 'weaponHit', s.party.chars[0]!.id)
    expect(s.party.items[id]).toEqual(before)
  })

  it('destroyPartyItem clears equipment and inventory', () => {
    let s = makeInitialState(content)
    const id = 'i_club' as ItemId
    const cid = s.party.chars[0]!.id
    s = {
      ...s,
      party: {
        ...s.party,
        chars: s.party.chars.map((c) => (c.id === cid ? { ...c, equipment: { ...c.equipment, handLeft: id } } : c)),
      },
    }
    const cleared = destroyPartyItem(s, id)
    expect(cleared.party.items[id]).toBeUndefined()
    expect(cleared.party.chars.find((c) => c.id === cid)?.equipment.handLeft).toBeUndefined()
    expect(cleared.party.inventory.slots.includes(id)).toBe(false)
  })
})
