import type { EquipmentSlot, GameState, ItemId } from '../types'
import { moveItemToInventorySlot, removeItemFromInventory } from './inventory'

export function equipItem(state: GameState, characterId: string, slot: EquipmentSlot, itemId: ItemId): GameState {
  const cIdx = state.party.chars.findIndex((c) => c.id === characterId)
  if (cIdx < 0) return state

  const chars = state.party.chars.slice()
  const c = chars[cIdx]
  const prev = c.equipment[slot]

  let nextState = state
  nextState = removeItemFromInventory(nextState, itemId)

  // If something was equipped, stow it into the first free slot.
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

export function unequipItem(state: GameState, characterId: string, slot: EquipmentSlot): GameState {
  const cIdx = state.party.chars.findIndex((c) => c.id === characterId)
  if (cIdx < 0) return state
  const c = state.party.chars[cIdx]
  const itemId = c.equipment[slot]
  if (!itemId) return state

  const inv = state.party.inventory
  const freeIdx = inv.slots.findIndex((s) => s == null)
  if (freeIdx < 0) return state

  const chars = state.party.chars.slice()
  chars[cIdx] = { ...c, equipment: { ...c.equipment, [slot]: undefined } }
  const nextState = moveItemToInventorySlot({ ...state, party: { ...state.party, chars } }, itemId, freeIdx)
  return nextState
}

