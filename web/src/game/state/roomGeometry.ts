import type { GameState } from '../types'

export function rectContains(r: { x: number; y: number; w: number; h: number }, p: { x: number; y: number }) {
  return p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h
}

/** First procgen room whose rect contains the cell, else null. */
export function roomForCell(state: GameState, x: number, y: number) {
  const rooms = state.floor.gen?.rooms
  if (!rooms?.length) return null
  for (const r of rooms) {
    if (rectContains(r.rect, { x, y })) return r
  }
  return null
}
