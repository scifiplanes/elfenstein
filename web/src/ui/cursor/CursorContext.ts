import { createContext } from 'react'
import type { DragPayload, DragTarget } from '../../game/types'

export type CursorState = {
  pointer: { x: number; y: number }
  isPointerDown: boolean
  dragging: null | {
    payload: DragPayload
    started: boolean
  }
  hoverTarget: DragTarget | null
  hoverRect: { left: number; top: number; right: number; bottom: number } | null
  affordance: null | { icon: string; label: string }
}

export type CursorApi = {
  state: CursorState
  beginPointerDown(payload: DragPayload, e: React.PointerEvent): void
  onPointerMove(e: React.PointerEvent): void
  setVirtualHover(target: DragTarget | null, rect: CursorState['hoverRect']): void
  endPointerUp(e: React.PointerEvent): { payload: DragPayload; target: DragTarget } | null
  cancelDrag(): void
}

export const CursorContext = createContext<CursorApi | null>(null)

