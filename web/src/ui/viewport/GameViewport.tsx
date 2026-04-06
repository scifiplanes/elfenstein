import type { Dispatch } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import { useCursor } from '../cursor/useCursor'
import styles from './GameViewport.module.css'
import { WorldRenderer } from '../../world/WorldRenderer'

export function GameViewport(props: { state: GameState; dispatch: Dispatch<Action> }) {
  const { state, dispatch } = props
  const cursor = useCursor()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rendererRef = useRef<WorldRenderer | null>(null)
  const [webglError, setWebglError] = useState<string | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const onLost = (e: Event) => {
      e.preventDefault()
      setWebglError('WebGL context lost. Try reloading the page.')
    }
    const onRestored = () => setWebglError(null)
    canvas.addEventListener('webglcontextlost', onLost as any, { passive: false } as any)
    canvas.addEventListener('webglcontextrestored', onRestored as any)

    try {
      const wr = new WorldRenderer(canvas)
      rendererRef.current = wr
    } catch (err) {
      setWebglError('WebGL init failed. Your browser/GPU may be blocking WebGL.')
    }
    return () => {
      rendererRef.current?.dispose()
      rendererRef.current = null
      canvas.removeEventListener('webglcontextlost', onLost as any)
      canvas.removeEventListener('webglcontextrestored', onRestored as any)
    }
  }, [])

  useEffect(() => {
    rendererRef.current?.renderFrame(state)
  }, [state])

  return (
    <div
      className={styles.root}
      data-drop-kind="floorDrop"
      onPointerMove={(e) => {
        cursor.onPointerMove(e)
        const wr = rendererRef.current
        if (!wr) return
        const pick = wr.pickObject(e.clientX, e.clientY)
        if (!pick) {
          cursor.setVirtualHover(null, null)
          return
        }
        const at = wr.projectWorldToClient(pick.worldPos)
        const rect = { left: at.x, right: at.x, top: at.y, bottom: at.y }
        if (pick.kind === 'poi') cursor.setVirtualHover({ kind: 'poi', poiId: pick.id }, rect)
        if (pick.kind === 'npc') cursor.setVirtualHover({ kind: 'npc', npcId: pick.id }, rect)
        if (pick.kind === 'floorItem') cursor.setVirtualHover({ kind: 'floorItem', itemId: pick.id }, rect)
      }}
      onClick={(e) => {
        const wr = rendererRef.current
        if (!wr) return
        const pick = wr.pickTarget(e.clientX, e.clientY)
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
      <canvas className={styles.canvas} ref={canvasRef} />

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

