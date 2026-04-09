import type { ContentDB } from '../content/contentDb'
import type { CharacterId, EquipmentSlot, GameState, ItemId } from '../types'
import { moveItemToInventorySlot, removeItemFromInventory } from './inventory'

function stowEquippedItemToInventory(state: GameState, itemId: ItemId): GameState {
  const freeIdx = state.party.inventory.slots.findIndex((s) => s == null)
  if (freeIdx < 0) return state
  return moveItemToInventorySlot(state, itemId, freeIdx)
}

/** Two-handed items store the same `itemId` in both `handLeft` and `handRight`. */
export function equipTwoHandItem(state: GameState, characterId: CharacterId, itemId: ItemId): GameState {
  const cIdx = state.party.chars.findIndex((c) => c.id === characterId)
  if (cIdx < 0) return state

  const chars = state.party.chars.slice()
  const c = chars[cIdx]
  let nextState = removeItemFromInventory(state, itemId)
  let eq = { ...c.equipment }
  const left = eq.handLeft
  const right = eq.handRight

  if (left && right && left === right) {
    nextState = stowEquippedItemToInventory(nextState, left)
    eq = { ...eq, handLeft: undefined, handRight: undefined }
  } else {
    if (left) nextState = stowEquippedItemToInventory(nextState, left)
    if (right && right !== left) nextState = stowEquippedItemToInventory(nextState, right)
    eq = { ...eq, handLeft: undefined, handRight: undefined }
  }

  chars[cIdx] = { ...c, equipment: { ...eq, handLeft: itemId, handRight: itemId } }
  return { ...nextState, party: { ...nextState.party, chars } }
}

export function equipOneHandToSlot(
  state: GameState,
  characterId: CharacterId,
  slot: 'handLeft' | 'handRight',
  itemId: ItemId,
): GameState {
  const cIdx = state.party.chars.findIndex((c) => c.id === characterId)
  if (cIdx < 0) return state

  const chars = state.party.chars.slice()
  const c = chars[cIdx]
  let nextState = removeItemFromInventory(state, itemId)
  let eq = { ...c.equipment }
  const left = eq.handLeft
  const right = eq.handRight

  if (left && right && left === right) {
    nextState = stowEquippedItemToInventory(nextState, left)
    eq = { ...eq, handLeft: undefined, handRight: undefined }
  } else {
    const prev = eq[slot]
    if (prev) {
      nextState = stowEquippedItemToInventory(nextState, prev)
      const nextEq = { ...eq }
      delete nextEq[slot]
      eq = nextEq
    }
  }

  chars[cIdx] = { ...c, equipment: { ...eq, [slot]: itemId } }
  return { ...nextState, party: { ...nextState.party, chars } }
}

export function equipItem(
  state: GameState,
  characterId: CharacterId,
  slot: EquipmentSlot,
  itemId: ItemId,
  content: ContentDB,
): GameState {
  const cIdx = state.party.chars.findIndex((c) => c.id === characterId)
  if (cIdx < 0) return state

  const item = state.party.items[itemId]
  if (!item) return state

  const def = content.item(item.defId)

  if (slot === 'handLeft' || slot === 'handRight') {
    if (def.tags.includes('twoHand')) {
      return equipTwoHandItem(state, characterId, itemId)
    }
    if (!def.tags.includes('oneHand')) {
      return state
    }
    return equipOneHandToSlot(state, characterId, slot, itemId)
  }

  const chars = state.party.chars.slice()
  const c = chars[cIdx]
  const prev = c.equipment[slot]

  let nextState = state
  nextState = removeItemFromInventory(nextState, itemId)

  if (prev) {
    const inv = nextState.party.inventory
    const freeIdx = inv.slots.findIndex((s) => s == null)
    if (freeIdx >= 0) {
      nextState = moveItemToInventorySlot(nextState, prev, freeIdx)
    }
  }

  const nextChar = { ...c, equipment: { ...c.equipment, [slot]: itemId } }
  chars[cIdx] = nextChar
  return { ...nextState, party: { ...nextState.party, chars } }
}

export function equipHandsFromPortrait(state: GameState, content: ContentDB, characterId: CharacterId, itemId: ItemId): GameState {
  const item = state.party.items[itemId]
  if (!item) return state
  const def = content.item(item.defId)
  const one = def.tags.includes('oneHand')
  const two = def.tags.includes('twoHand')
  if (!one && !two) return state

  if (two) {
    return equipTwoHandItem(state, characterId, itemId)
  }

  const c = state.party.chars.find((x) => x.id === characterId)
  if (!c) return state
  const L = c.equipment.handLeft
  const R = c.equipment.handRight

  if (!L) return equipOneHandToSlot(state, characterId, 'handLeft', itemId)
  if (!R) return equipOneHandToSlot(state, characterId, 'handRight', itemId)
  return equipOneHandToSlot(state, characterId, 'handLeft', itemId)
}

export function equipHatFromPortrait(state: GameState, content: ContentDB, characterId: CharacterId, itemId: ItemId): GameState {
  const item = state.party.items[itemId]
  if (!item) return state
  const def = content.item(item.defId)
  if (!def.tags.includes('hat')) return state
  if (def.equipSlots && !def.equipSlots.includes('head')) return state
  return equipItem(state, characterId, 'head', itemId, content)
}

/** True if an item that is not in the grid can be placed into `dst` (possibly displacing an occupant). */
function canPlaceNonGridItemAtInventorySlot(state: GameState, itemId: ItemId, dst: number): boolean {
  const inv = state.party.inventory
  if (dst < 0 || dst >= inv.slots.length) return false
  const slots = inv.slots
  if (slots.includes(itemId)) return true
  const occupying = slots[dst]
  if (!occupying) return true
  return slots.some((s, i) => s == null && i !== dst)
}

/**
 * Clears equipment when `itemId` matches the slot (including two-hand held).
 * Returns `null` if the character/slot/item does not match.
 */
export function clearEquippedSlotIfMatched(
  state: GameState,
  characterId: CharacterId,
  slot: EquipmentSlot,
  itemId: ItemId,
): GameState | null {
  const cIdx = state.party.chars.findIndex((c) => c.id === characterId)
  if (cIdx < 0) return null
  const c = state.party.chars[cIdx]
  const left = c.equipment.handLeft
  const right = c.equipment.handRight
  const twoHandHeld =
    (slot === 'handLeft' || slot === 'handRight') && !!left && !!right && left === right && itemId === left

  if (twoHandHeld) {
    const chars = state.party.chars.slice()
    chars[cIdx] = { ...c, equipment: { ...c.equipment, handLeft: undefined, handRight: undefined } }
    return { ...state, party: { ...state.party, chars } }
  }

  if (c.equipment[slot] !== itemId) return null
  const chars = state.party.chars.slice()
  chars[cIdx] = { ...c, equipment: { ...c.equipment, [slot]: undefined } }
  return { ...state, party: { ...state.party, chars } }
}

/** Move an equipped item into a specific inventory slot (clears equipment first). */
export function moveEquippedItemToInventorySlot(
  state: GameState,
  characterId: CharacterId,
  slot: EquipmentSlot,
  itemId: ItemId,
  dst: number,
): GameState {
  if (!canPlaceNonGridItemAtInventorySlot(state, itemId, dst)) return state
  const cleared = clearEquippedSlotIfMatched(state, characterId, slot, itemId)
  if (!cleared) return state
  return moveItemToInventorySlot(cleared, itemId, dst)
}

export function unequipItem(state: GameState, characterId: CharacterId, slot: EquipmentSlot): GameState {
  const cIdx = state.party.chars.findIndex((c) => c.id === characterId)
  if (cIdx < 0) return state
  const c = state.party.chars[cIdx]
  const itemId = c.equipment[slot]
  if (!itemId) return state

  const inv = state.party.inventory
  const freeIdx = inv.slots.findIndex((s) => s == null)
  if (freeIdx < 0) return state

  const chars = state.party.chars.slice()
  const left = c.equipment.handLeft
  const right = c.equipment.handRight
  const twoHandHeld = (slot === 'handLeft' || slot === 'handRight') && left && right && left === right

  if (twoHandHeld) {
    chars[cIdx] = { ...c, equipment: { ...c.equipment, handLeft: undefined, handRight: undefined } }
    return moveItemToInventorySlot({ ...state, party: { ...state.party, chars } }, left, freeIdx)
  }

  chars[cIdx] = { ...c, equipment: { ...c.equipment, [slot]: undefined } }
  return moveItemToInventorySlot({ ...state, party: { ...state.party, chars } }, itemId, freeIdx)
}
