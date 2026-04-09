/** Room tags from procgen (`GenRoom.tags.roomProperties`) that imply floor hazard art. */
export type RoomHazardProperty = 'Burning' | 'Flooded' | 'Infected'

export const ROOM_HAZARD_SPRITE_SRC: Record<RoomHazardProperty, string> = {
  Burning: '/content/hazard_fire.png',
  Flooded: '/content/hazard_water.png',
  Infected: '/content/hazard_poison.png',
}

/** Fraction of eligible floor cells (after filters) that receive a decal, deterministic per cell. */
export const HAZARD_DECAL_SPARSE_PCT = 40

function hashStr(s: string) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Whether this floor cell should show a sparse hazard decal (deterministic). */
export function shouldPlaceHazardDecal(args: {
  floorSeed: number
  roomId: string
  prop: RoomHazardProperty
  x: number
  y: number
}): boolean {
  const key = `${args.floorSeed}:hazardDecal:${args.roomId}:${args.prop}:${args.x},${args.y}`
  const h = hashStr(key)
  return (h % 100) < HAZARD_DECAL_SPARSE_PCT
}
