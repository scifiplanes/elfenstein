import type { GameState, ItemDefId, ItemId, Vec2 } from '../types'
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

  const occupying = nextSlots[dst]

  // Item not in grid (e.g. was equipped): place into dst; displace occupant to first free slot.
  if (src < 0) {
    nextSlots[dst] = itemId
    if (occupying) {
      const freeIdx = nextSlots.findIndex((s, i) => s == null && i !== dst)
      if (freeIdx < 0) return state
      nextSlots[freeIdx] = occupying
    }
    return { ...state, party: { ...state.party, inventory: { ...inv, slots: nextSlots } } }
  }

  // If destination occupied, swap.
  nextSlots[dst] = itemId
  if (occupying) nextSlots[src] = occupying

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

/** Remove one fed unit from `itemId`, then add one `emptyDefId` (merge with an existing inventory stack, new slot, or floor if full). */
export function consumeFeedLeavingEmpty(state: GameState, itemId: ItemId, emptyDefId: ItemDefId): GameState {
  const item = state.party.items[itemId]
  if (!item) return state

  const afterUnit =
    item.qty > 1
      ? {
          ...state,
          party: {
            ...state.party,
            items: { ...state.party.items, [itemId]: { ...item, qty: item.qty - 1 } },
          },
        }
      : (() => {
          const { [itemId]: _removed, ...rest } = state.party.items
          const cleared = removeItemFromInventory(state, itemId)
          return { ...cleared, party: { ...cleared.party, items: rest } }
        })()

  for (const sid of afterUnit.party.inventory.slots) {
    if (!sid) continue
    const it = afterUnit.party.items[sid]
    if (it?.defId === emptyDefId) {
      return {
        ...afterUnit,
        party: {
          ...afterUnit.party,
          items: { ...afterUnit.party.items, [sid]: { ...it, qty: it.qty + 1 } },
        },
      }
    }
  }

  const newId = (`i_${emptyDefId}_${afterUnit.floor.seed}_${String(itemId)}_${Math.floor(afterUnit.nowMs)}` as unknown) as ItemId
  const items = { ...afterUnit.party.items, [newId]: { id: newId, defId: emptyDefId, qty: 1 } }
  const inv = afterUnit.party.inventory
  const free = inv.slots.findIndex((s) => s == null)
  if (free >= 0) {
    const nextSlots = inv.slots.slice()
    nextSlots[free] = newId
    return { ...afterUnit, party: { ...afterUnit.party, items, inventory: { ...inv, slots: nextSlots } } }
  }

  const dropPos = { ...afterUnit.floor.playerPos }
  const jitter = makeDropJitter({
    floorSeed: afterUnit.floor.seed,
    itemId: newId,
    nonce: Math.floor(afterUnit.nowMs),
    radius: afterUnit.render.dropJitterRadius ?? 0.28,
  })
  return {
    ...afterUnit,
    party: { ...afterUnit.party, items },
    floor: {
      ...afterUnit.floor,
      itemsOnFloor: afterUnit.floor.itemsOnFloor.concat([{ id: newId, pos: dropPos, jitter }]),
      floorGeomRevision: afterUnit.floor.floorGeomRevision + 1,
    },
  }
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

