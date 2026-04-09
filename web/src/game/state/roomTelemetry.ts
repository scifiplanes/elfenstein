import type { GameState, Vec2 } from '../types'
import type { GenRoom } from '../../procgen/types'

function pointInRect(p: Vec2, r: { x: number; y: number; w: number; h: number }): boolean {
  return p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h
}

export type ActiveRoomProperty = NonNullable<GenRoom['tags']>['roomProperties']

/**
 * Same containment rule as `roomForCell` in `roomGeometry.ts`: first room whose rect contains the cell, else null.
 * (No “nearest room” fallback — corridors must not inherit a neighbor room’s `roomProperties` or telegraph flickers.)
 */
export function roomContainingPlayer(state: GameState): GenRoom | null {
  const rooms = state.floor.gen?.rooms
  if (!rooms?.length) return null
  const p = state.floor.playerPos
  for (const r of rooms) {
    if (pointInRect(p, r.rect)) return r
  }
  return null
}

export function roomPropertyUnderPlayer(state: GameState): ActiveRoomProperty | null {
  return roomContainingPlayer(state)?.tags?.roomProperties ?? null
}

