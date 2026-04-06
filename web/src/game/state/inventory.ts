import type { GameState, ItemId } from '../types'

export function swapInventorySlots(state: GameState, src: number, dst: number): GameState {
  const inv = state.party.inventory
  if (src === dst) return state
  if (src < 0 || dst < 0 || src >= inv.slots.length || dst >= inv.slots.length) return state

  const nextSlots = inv.slots.slice()
  const a = nextSlots[src]
  nextSlots[src] = nextSlots[dst]
  nextSlots[dst] = a

  return { ...state, party: { ...state.party, inventory: { ...inv, slots: nextSlots } } }
}

export function moveItemToInventorySlot(state: GameState, itemId: ItemId, dst: number): GameState {
  const inv = state.party.inventory
  if (dst < 0 || dst >= inv.slots.length) return state

  const nextSlots = inv.slots.slice()

  // Remove from any current slot (inventory is a single shared pool).
  const src = nextSlots.findIndex((s) => s === itemId)
  if (src >= 0) nextSlots[src] = null

  // If destination occupied, swap.
  const occupying = nextSlots[dst]
  nextSlots[dst] = itemId
  if (occupying && src >= 0) nextSlots[src] = occupying

  return { ...state, party: { ...state.party, inventory: { ...inv, slots: nextSlots } } }
}

export function removeItemFromInventory(state: GameState, itemId: ItemId): GameState {
  const inv = state.party.inventory
  const idx = inv.slots.findIndex((s) => s === itemId)
  if (idx < 0) return state
  const nextSlots = inv.slots.slice()
  nextSlots[idx] = null
  return { ...state, party: { ...state.party, inventory: { ...inv, slots: nextSlots } } }
}

export function consumeItem(state: GameState, itemId: ItemId): GameState {
  const item = state.party.items[itemId]
  if (!item) return state

  if (item.qty > 1) {
    return {
      ...state,
      party: {
        ...state.party,
        items: { ...state.party.items, [itemId]: { ...item, qty: item.qty - 1 } },
      },
    }
  }

  const { [itemId]: _removed, ...rest } = state.party.items
  const cleared = removeItemFromInventory(state, itemId)
  return { ...cleared, party: { ...cleared.party, items: rest } }
}

export function dropItemToFloor(state: GameState, itemId: ItemId): GameState {
  const floor = state.floor
  const cleared = removeItemFromInventory(state, itemId)
  const dropPos = { ...floor.playerPos }
  const itemsOnFloor = floor.itemsOnFloor.concat([{ id: itemId, pos: dropPos }])
  return { ...cleared, floor: { ...floor, itemsOnFloor } }
}

