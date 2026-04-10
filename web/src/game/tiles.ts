import type { Tile } from './types'

export function isOpenDoorTile(t: Tile): boolean {
  return t === 'door' || t === 'doorOctopus'
}

export function isLockedDoorTile(t: Tile): boolean {
  return t === 'lockedDoor' || t === 'lockedDoorOctopus'
}

export function isAnyDoorTile(t: Tile): boolean {
  return isOpenDoorTile(t) || isLockedDoorTile(t)
}

/** Opened in play: walkable, static open sprite in the world mesh. */
export function isPassableOpenDoorTile(t: Tile): boolean {
  return t === 'doorOpen' || t === 'doorOpenOctopus'
}

export function isOctopusDoorTile(t: Tile): boolean {
  return t === 'doorOctopus' || t === 'lockedDoorOctopus' || t === 'doorOpenOctopus'
}

export type DoorFxVisual = 'wooden' | 'octopus'

export function doorFxVisualForTile(t: Tile): DoorFxVisual {
  return isOctopusDoorTile(t) ? 'octopus' : 'wooden'
}

/** Closed door tile (`isAnyDoorTile`) becomes this after open/unlock; passable with open billboard. */
export function tileAfterDoorOpens(tile: Tile): 'doorOpen' | 'doorOpenOctopus' {
  if (tile === 'doorOctopus' || tile === 'lockedDoorOctopus') return 'doorOpenOctopus'
  return 'doorOpen'
}
