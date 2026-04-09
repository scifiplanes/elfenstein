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

export function isOctopusDoorTile(t: Tile): boolean {
  return t === 'doorOctopus' || t === 'lockedDoorOctopus'
}

export type DoorFxVisual = 'wooden' | 'octopus'

export function doorFxVisualForTile(t: Tile): DoorFxVisual {
  return isOctopusDoorTile(t) ? 'octopus' : 'wooden'
}
