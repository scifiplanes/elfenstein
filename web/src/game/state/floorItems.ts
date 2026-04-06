import type { GameState, ItemId } from '../types'
import { moveItemToInventorySlot } from './inventory'

export function pickupFloorItem(state: GameState, itemId: ItemId): GameState {
  const floorIdx = state.floor.itemsOnFloor.findIndex((x) => x.id === itemId)
  if (floorIdx < 0) return state

  const inv = state.party.inventory
  const free = inv.slots.findIndex((s) => s == null)
  if (free < 0) {
    return {
      ...state,
      ui: {
        ...state.ui,
        toast: { id: `t_${state.nowMs}`, text: 'Inventory is full.', untilMs: state.nowMs + 1200 },
        shake: { untilMs: state.nowMs + 110, magnitude: 0.16 },
      },
    }
  }

  const without = state.floor.itemsOnFloor.slice()
  without.splice(floorIdx, 1)
  const withRemoved = { ...state, floor: { ...state.floor, itemsOnFloor: without } }
  const withAdded = moveItemToInventorySlot(withRemoved, itemId, free)
  const q = withAdded.ui.sfxQueue ?? []
  return {
    ...withAdded,
    ui: {
      ...withAdded.ui,
      toast: { id: `t_${state.nowMs}`, text: 'Picked up.', untilMs: state.nowMs + 900 },
      shake: { untilMs: state.nowMs + 120, magnitude: 0.2 },
      sfxQueue: q.concat([{ id: `s_${state.nowMs}_${q.length}`, kind: 'pickup' }]),
    },
  }
}

