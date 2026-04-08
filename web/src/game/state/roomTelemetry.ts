import type { GameState, Vec2 } from '../types'
import type { GenRoom } from '../../procgen/types'

function pointInRect(p: Vec2, r: { x: number; y: number; w: number; h: number }): boolean {
  return p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h
}

function nearestRoomIndexByCenter(rooms: GenRoom[], p: Vec2): number {
  let best = -1
  let bestD = 1e9
  for (let i = 0; i < rooms.length; i++) {
    const c = rooms[i].center
    const d = Math.abs(c.x - p.x) + Math.abs(c.y - p.y)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

function roomIndexForPoint(rooms: GenRoom[], p: Vec2): number {
  for (let i = 0; i < rooms.length; i++) {
    if (pointInRect(p, rooms[i].rect)) return i
  }
  return nearestRoomIndexByCenter(rooms, p)
}

export type ActiveRoomProperty = NonNullable<GenRoom['tags']>['roomProperties']

export function roomPropertyUnderPlayer(state: GameState): ActiveRoomProperty | null {
  const rooms = state.floor.gen?.rooms
  if (!rooms?.length) return null
  const idx = roomIndexForPoint(rooms, state.floor.playerPos)
  if (idx < 0 || idx >= rooms.length) return null
  return rooms[idx]?.tags?.roomProperties ?? null
}

