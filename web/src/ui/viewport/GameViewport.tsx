import type { Dispatch } from 'react'
import type { RefObject } from 'react'
import { useRef } from 'react'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import { useCursor } from '../cursor/useCursor'
import styles from './GameViewport.module.css'
import type { WorldRenderer } from '../../world/WorldRenderer'

export function GameViewport(props: {
  state: GameState
  dispatch: Dispatch<Action>
  world: WorldRenderer | null
  viewportRef?: RefObject<HTMLDivElement | null>
  webglError?: string | null
}) {
  const { state, dispatch, world, viewportRef, webglError } = props
  const cursor = useCursor()

  const localRef = useRef<HTMLDivElement | null>(null)
  const vpRef = viewportRef ?? localRef
  const getRect = () => vpRef.current?.getBoundingClientRect() ?? null
  const isOverViewport = (x: number, y: number, rect: DOMRectReadOnly) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom

  const worldPointToCell = (state: GameState, p: { x: number; z: number }) => {
    // Floor tiles are centered at (gridX - w/2, gridY - h/2) in world space.
    const gx = Math.floor(p.x + state.floor.w / 2 + 0.5)
    const gy = Math.floor(p.z + state.floor.h / 2 + 0.5)
    return { x: gx, y: gy }
  }

  const clampByManhattanRange = (player: { x: number; y: number }, target: { x: number; y: number }, range: number) => {
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

  const findNearestFloorCell = (state: GameState, start: { x: number; y: number }, maxRange: number) => {
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

  return (
    <div
      className={styles.root}
      ref={vpRef}
      data-drop-kind="floorDrop"
      onPointerDown={(e) => {
        if (!world) return
        const rect = getRect()
        if (!rect) return
        const pick = world.pickTarget(rect, e.clientX, e.clientY)
        if (!pick) return
        if (pick.kind === 'floorItem') {
          cursor.beginPointerDown({ itemId: pick.id, source: { kind: 'floorItem', itemId: pick.id } }, e)
        }
      }}
      onPointerMove={(e) => {
        cursor.onPointerMove(e)
        if (!world) return
        const rect = getRect()
        if (!rect) return
        const pick = world.pickObject(rect, e.clientX, e.clientY)
        if (!pick) {
          // Ensure dropping onto empty floor still resolves as a `floorDrop` even if the
          // compositor canvas is the topmost element under the pointer (elementFromPoint).
          const at = { left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }
          cursor.setVirtualHover({ kind: 'floorDrop' }, at)
          return
        }
        const at = world.projectWorldToClient(rect, pick.worldPos)
        const hoverRect = { left: at.x, right: at.x, top: at.y, bottom: at.y }
        if (pick.kind === 'poi') cursor.setVirtualHover({ kind: 'poi', poiId: pick.id }, hoverRect)
        if (pick.kind === 'npc') cursor.setVirtualHover({ kind: 'npc', npcId: pick.id }, hoverRect)
        if (pick.kind === 'floorItem') cursor.setVirtualHover({ kind: 'floorItem', itemId: pick.id }, hoverRect)
      }}
      onPointerCancel={cursor.cancelDrag}
      onClick={(e) => {
        // Avoid firing click actions after a press+hold drag gesture begins.
        if (cursor.state.dragging?.started || cursor.state.isPointerDown) return
        if (!world) return
        const rect = getRect()
        if (!rect) return
        const pick = world.pickTarget(rect, e.clientX, e.clientY)
        if (!pick) return
        if (pick.kind === 'floorItem') {
          // Click-pickup convenience; drag-drop also works.
          dispatch({ type: 'floor/pickup', itemId: pick.id })
          return
        }
        if (pick.kind === 'door') {
          const [xStr, yStr] = pick.id.split(',')
          const x = Number(xStr)
          const y = Number(yStr)
          if (Number.isFinite(x) && Number.isFinite(y)) {
            const idx = x + y * state.floor.w
            const tile = state.floor.tiles[idx]
            if (tile === 'door' || tile === 'lockedDoor') {
              // Attempt open by walking “into” it.
              dispatch({ type: 'player/step', forward: 1 })
            }
          }
          return
        }
        if (pick.kind === 'poi') {
          const poi = state.floor.pois.find((p) => p.id === pick.id)
          if (!poi) return
          dispatch({ type: 'poi/use', poiId: poi.id })
          dispatch({ type: 'ui/sfx', kind: 'ui' })
          return
        }
        if (pick.kind === 'npc') {
          const npc = state.floor.npcs.find((n) => n.id === pick.id)
          if (!npc) return
          dispatch({ type: 'ui/openNpcDialog', npcId: npc.id })
          dispatch({ type: 'ui/sfx', kind: 'ui' })
        }
      }}
      onPointerUp={(e) => {
        const result = cursor.endPointerUp(e)
        if (!result) return

        // If dropping into the world, try to place near the cursor world position (clamped by range).
        if (result.target.kind === 'floorDrop' && world) {
          const rect = getRect()
          if (rect && isOverViewport(e.clientX, e.clientY, rect)) {
            const pickFloorPoint = (world as any).pickFloorPoint as undefined | ((r: DOMRectReadOnly, x: number, y: number) => any)
            const p = pickFloorPoint ? pickFloorPoint(rect, e.clientX, e.clientY) : null
            if (p) {
              const rawCell = worldPointToCell(state, { x: p.x, z: p.z })
              const range = Math.max(0, Math.round(Number(state.render.dropRangeCells ?? 0)))
              const clamped = clampByManhattanRange(state.floor.playerPos, rawCell, range)
              const snapped = findNearestFloorCell(state, clamped, range)
              if (snapped) {
                dispatch({ type: 'drag/drop', payload: result.payload, target: { kind: 'floorDrop', dropPos: snapped }, nowMs: performance.now() })
                return
              }
            }
          }
        }

        dispatch({ type: 'drag/drop', payload: result.payload, target: result.target, nowMs: performance.now() })
      }}
    >
      <div className={styles.overlay}>
        <div className={styles.poiRow} style={{ pointerEvents: 'none' }}>
          <div className={styles.poiBtn} style={{ pointerEvents: 'none', opacity: 0.75 }}>
            In-world targets enabled (hover/click/drag in 3D view)
          </div>
        </div>
        {webglError ? <div className={styles.webglError}>{webglError}</div> : null}
      </div>
    </div>
  )
}

