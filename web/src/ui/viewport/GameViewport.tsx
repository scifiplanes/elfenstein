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

  return (
    <div
      className={styles.root}
      ref={vpRef}
      data-drop-kind="floorDrop"
      onPointerMove={(e) => {
        cursor.onPointerMove(e)
        if (!world) return
        const rect = getRect()
        if (!rect) return
        const pick = world.pickObject(rect, e.clientX, e.clientY)
        if (!pick) {
          cursor.setVirtualHover(null, null)
          return
        }
        const at = world.projectWorldToClient(rect, pick.worldPos)
        const hoverRect = { left: at.x, right: at.x, top: at.y, bottom: at.y }
        if (pick.kind === 'poi') cursor.setVirtualHover({ kind: 'poi', poiId: pick.id }, hoverRect)
        if (pick.kind === 'npc') cursor.setVirtualHover({ kind: 'npc', npcId: pick.id }, hoverRect)
        if (pick.kind === 'floorItem') cursor.setVirtualHover({ kind: 'floorItem', itemId: pick.id }, hoverRect)
      }}
      onClick={(e) => {
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
        if (result) dispatch({ type: 'drag/drop', payload: result.payload, target: result.target })
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

