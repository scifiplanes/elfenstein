import type { GameState, ItemId } from '../types'
import { moveItemToInventorySlot } from './inventory'
import { pushActivityLog } from './activityLog'

export function pickupFloorItem(state: GameState, itemId: ItemId): GameState {
  const floorIdx = state.floor.itemsOnFloor.findIndex((x) => x.id === itemId)
  if (floorIdx < 0) return state

  const inv = state.party.inventory
  const free = inv.slots.findIndex((s) => s == null)
  if (free < 0) {
    return pushActivityLog(
      {
        ...state,
        ui: {
          ...state.ui,
          shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 110, magnitude: 0.16 },
        },
      },
      'Inventory is full.',
    )
  }

  const without = state.floor.itemsOnFloor.slice()
  without.splice(floorIdx, 1)
  const withRemoved = {
    ...state,
    floor: { ...state.floor, itemsOnFloor: without, floorGeomRevision: state.floor.floorGeomRevision + 1 },
  }
  const withAdded = moveItemToInventorySlot(withRemoved, itemId, free)
  const q = withAdded.ui.sfxQueue ?? []
  return pushActivityLog(
    {
      ...withAdded,
      ui: {
        ...withAdded.ui,
        shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 120, magnitude: 0.2 },
        sfxQueue: q.concat([{ id: `s_${state.nowMs}_${q.length}`, kind: 'pickup' }]),
      },
    },
    'Picked up.',
  )
}

