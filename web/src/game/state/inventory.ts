import type { GameState, ItemId, Vec2 } from '../types'
import { makeDropJitter } from './dropJitter'

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

export function dropItemToFloor(state: GameState, itemId: ItemId, desiredPos?: Vec2): GameState {
  const floor = state.floor
  const cleared = removeItemFromInventory(state, itemId)
  const dropPos = desiredPos && isValidFloorPos(cleared, desiredPos) ? { ...desiredPos } : computeDropPos(cleared)
  const jitter = makeDropJitter({
    floorSeed: cleared.floor.seed,
    itemId,
    nonce: Math.floor(cleared.nowMs),
    radius: cleared.render.dropJitterRadius ?? 0.28,
  })
  const itemsOnFloor = floor.itemsOnFloor.concat([{ id: itemId, pos: dropPos, jitter }])
  return {
    ...cleared,
    floor: { ...floor, itemsOnFloor, floorGeomRevision: cleared.floor.floorGeomRevision + 1 },
  }
}

function isValidFloorPos(state: GameState, pos: Vec2) {
  const { w, h, tiles } = state.floor
  if (pos.x < 0 || pos.y < 0 || pos.x >= w || pos.y >= h) return false
  return tiles[pos.x + pos.y * w] === 'floor'
}

function computeDropPos(state: GameState) {
  const { w, h, tiles, playerPos, playerDir } = state.floor
  const ahead = Math.max(0, Number(state.render.dropAheadCells ?? 0))
  const step = Math.max(0, Math.round(ahead))
  if (step === 0) return { ...playerPos }

  const v = dirVec(playerDir)
  const nx = playerPos.x + v.x * step
  const ny = playerPos.y + v.y * step
  if (nx < 0 || ny < 0 || nx >= w || ny >= h) return { ...playerPos }
  const tile = tiles[nx + ny * w]
  if (tile !== 'floor') return { ...playerPos }
  return { x: nx, y: ny }
}

function dirVec(dir: 0 | 1 | 2 | 3) {
  // 0=N, 1=E, 2=S, 3=W (grid y+ is south)
  if (dir === 0) return { x: 0, y: -1 }
  if (dir === 1) return { x: 1, y: 0 }
  if (dir === 2) return { x: 0, y: 1 }
  return { x: -1, y: 0 }
}

