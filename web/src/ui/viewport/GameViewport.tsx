import type { Dispatch } from 'react'
import type { RefObject } from 'react'
import { useRef } from 'react'
import type { Action } from '../../game/reducer'
import { isAnyDoorTile, isPassableOpenDoorTile } from '../../game/tiles'
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
      onPointerCancel={cursor.cancelDrag}
      onClick={(e) => {
        // Avoid firing click actions after a press+hold drag gesture begins.
        if (cursor.state.dragging?.started) return
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
            if (isAnyDoorTile(tile) || isPassableOpenDoorTile(tile)) {
              // Closed: open by walking into it; open: step through.
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
          const combat = state.combat
          if (combat && npc.hp > 0 && combat.participants.npcs.includes(npc.id)) {
            dispatch({ type: 'combat/clickAttack', npcId: npc.id })
            return
          }
          dispatch({ type: 'ui/openNpcDialog', npcId: npc.id })
          dispatch({ type: 'ui/sfx', kind: 'ui' })
        }
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

