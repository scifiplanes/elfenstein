import type { DragTarget } from '../../game/types'
import type { GameState } from '../../game/types'
import type { WorldRenderer } from '../../world/WorldRenderer'

function isInsideRect(x: number, y: number, r: DOMRectReadOnly) {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
}

function worldPointToCell(state: GameState, p: { x: number; z: number }) {
  const gx = Math.floor(p.x + state.floor.w / 2 + 0.5)
  const gy = Math.floor(p.z + state.floor.h / 2 + 0.5)
  return { x: gx, y: gy }
}

function clampByManhattanRange(player: { x: number; y: number }, target: { x: number; y: number }, range: number) {
  const dx = target.x - player.x
  const dy = target.y - player.y
  const adx = Math.abs(dx)
  const ady = Math.abs(dy)
  const dist = adx + ady
  if (dist <= range) return target
  const sx = dx < 0 ? -1 : 1
  const sy = dy < 0 ? -1 : 1
  const useX = Math.min(adx, range)
  const rem = Math.max(0, range - useX)
  const useY = Math.min(ady, rem)
  return { x: player.x + sx * useX, y: player.y + sy * useY }
}

function findNearestFloorCell(state: GameState, start: { x: number; y: number }, maxRange: number) {
  const { w, h, tiles, playerPos } = state.floor
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h
  const isFloor = (x: number, y: number) => tiles[x + y * w] === 'floor'
  const withinPlayerRange = (x: number, y: number) => Math.abs(x - playerPos.x) + Math.abs(y - playerPos.y) <= maxRange

  if (inBounds(start.x, start.y) && isFloor(start.x, start.y) && withinPlayerRange(start.x, start.y)) return start

  for (let r = 1; r <= maxRange; r++) {
    for (let dx = -r; dx <= r; dx++) {
      const dy = r - Math.abs(dx)
      const candidates = [
        { x: start.x + dx, y: start.y + dy },
        { x: start.x + dx, y: start.y - dy },
      ]
      for (const c of candidates) {
        if (!inBounds(c.x, c.y)) continue
        if (!withinPlayerRange(c.x, c.y)) continue
        if (!isFloor(c.x, c.y)) continue
        return c
      }
    }
  }
  return null
}

/**
 * `GameViewport` is a single `data-drop-kind="floorDrop"` shell; DOM hit-tests cannot see POI/NPC/floor-item
 * meshes. Drag sources that use `setPointerCapture` (inventory slots, equip strip) dispatch `pointerup` on the
 * captured node, so `HudLayout` may never run its 3D branch—call this from every `endPointerUp` → `drag/drop` path
 * when the DOM target is `floorDrop`.
 */
export function resolveGameViewportDragDropTarget(
  state: GameState,
  world: WorldRenderer | null,
  viewportEl: HTMLElement | null,
  domTarget: DragTarget,
  clientX: number,
  clientY: number,
): DragTarget {
  if (domTarget.kind !== 'floorDrop') return domTarget
  if (state.ui.screen === 'hub' || !world || !viewportEl) return domTarget
  const rect = viewportEl.getBoundingClientRect()
  if (!isInsideRect(clientX, clientY, rect)) return domTarget

  const pick = world.pickTarget(rect, clientX, clientY)
  if (pick?.kind === 'poi') return { kind: 'poi', poiId: pick.id }
  if (pick?.kind === 'npc') return { kind: 'npc', npcId: pick.id }
  if (pick?.kind === 'floorItem') return { kind: 'floorItem', itemId: pick.id }

  const p = world.pickFloorPoint(rect, clientX, clientY)
  if (p) {
    const rawCell = worldPointToCell(state, { x: p.x, z: p.z })
    const range = Math.max(0, Math.round(Number(state.render.dropRangeCells ?? 0)))
    const clamped = clampByManhattanRange(state.floor.playerPos, rawCell, range)
    const snapped = findNearestFloorCell(state, clamped, range)
    if (snapped) return { kind: 'floorDrop', dropPos: snapped }
  }
  return domTarget
}
