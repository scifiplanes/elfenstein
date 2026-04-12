import type { ContentDB } from '../content/contentDb'
import type { CharacterId, EquipmentSlot, GameState, InventoryItem, ItemDefId, ItemId } from '../types'
import { removeItemFromInventory } from './inventory'
import { pushPortraitToast } from './portraitToasts'

const EQUIP_SLOTS: EquipmentSlot[] = ['head', 'handLeft', 'handRight', 'feet', 'clothing', 'accessory']

/** Strip `itemId` from every party member’s equipment, inventory slots, and `party.items`. */
export function destroyPartyItem(state: GameState, itemId: ItemId): GameState {
  const chars = state.party.chars.map((c) => {
    const eq = { ...c.equipment }
    let changed = false
    for (const slot of EQUIP_SLOTS) {
      if (eq[slot] === itemId) {
        delete eq[slot]
        changed = true
      }
    }
    return changed ? { ...c, equipment: eq } : c
  })
  let next: GameState = { ...state, party: { ...state.party, chars } }
  next = removeItemFromInventory(next, itemId)
  const { [itemId]: _removed, ...restItems } = next.party.items
  return { ...next, party: { ...next.party, items: restItems } }
}

export function resolveCharacterForItemDurabilityToast(
  state: GameState,
  itemId: ItemId,
  hint?: CharacterId,
): CharacterId {
  if (hint && state.party.chars.some((c) => c.id === hint)) return hint
  for (const c of state.party.chars) {
    for (const slot of EQUIP_SLOTS) {
      if (c.equipment[slot] === itemId) return c.id
    }
  }
  return state.party.chars[0]!.id
}

export type ItemDurabilityWearKind = 'weaponHit' | 'toolUse'

/**
 * Applies durability loss for defs with `durabilityMax`. No-op when disabled, wrong item shape, or `consumesOnUse` weapons.
 * On break: removes the item and pushes a portrait toast (`kind: 'status'`).
 */
export function applyItemDurabilityWear(
  state: GameState,
  content: ContentDB,
  itemId: ItemId,
  kind: ItemDurabilityWearKind,
  characterIdHint?: CharacterId,
): GameState {
  if (Number(state.render.itemDurabilityEnabled ?? 0) <= 0) return state

  const cost =
    kind === 'weaponHit'
      ? Math.max(0, Math.round(Number(state.render.itemDurabilityWeaponHitCost ?? 0)))
      : Math.max(0, Math.round(Number(state.render.itemDurabilityToolUseCost ?? 0)))
  if (cost <= 0) return state

  const item = state.party.items[itemId]
  if (!item || item.qty !== 1) return state

  const def = content.item(item.defId)
  const max = def.durabilityMax
  if (max == null || max <= 0) return state

  if (kind === 'weaponHit' && def.weapon?.consumesOnUse) return state

  const cur = item.durability ?? max
  const nextDur = cur - cost
  if (nextDur > 0) {
    return {
      ...state,
      party: {
        ...state.party,
        items: { ...state.party.items, [itemId]: { ...item, durability: nextDur } },
      },
    }
  }

  const cid = resolveCharacterForItemDurabilityToast(state, itemId, characterIdHint)
  let next = destroyPartyItem(state, itemId)
  next = pushPortraitToast(next, {
    characterId: cid,
    kind: 'status',
    text: `${def.name} broke!`,
  })
  return next
}

/** New stack row: sets `durability` when the def has `durabilityMax` and `qty === 1`. */
export function inventoryItemFromDef(content: ContentDB, defId: ItemDefId, id: ItemId, qty: number): InventoryItem {
  const def = content.item(defId)
  const row: InventoryItem = { id, defId, qty }
  if (qty === 1 && def.durabilityMax != null && def.durabilityMax > 0) {
    row.durability = def.durabilityMax
  }
  return row
}
