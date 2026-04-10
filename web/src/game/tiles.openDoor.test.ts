import { describe, expect, it } from 'vitest'
import { isWalkable } from '../procgen/validate'
import { isPassableOpenDoorTile, tileAfterDoorOpens } from './tiles'
import type { Tile } from './types'

describe('passable open door tiles', () => {
  it('maps closed door tiles to passable open variants', () => {
    expect(tileAfterDoorOpens('door')).toBe('doorOpen')
    expect(tileAfterDoorOpens('lockedDoor')).toBe('doorOpen')
    expect(tileAfterDoorOpens('doorOctopus')).toBe('doorOpenOctopus')
    expect(tileAfterDoorOpens('lockedDoorOctopus')).toBe('doorOpenOctopus')
  })

  it('isWalkable includes doorOpen*', () => {
    expect(isWalkable('doorOpen' as Tile)).toBe(true)
    expect(isWalkable('doorOpenOctopus' as Tile)).toBe(true)
  })

  it('isPassableOpenDoorTile identifies only open passable kinds', () => {
    expect(isPassableOpenDoorTile('doorOpen' as Tile)).toBe(true)
    expect(isPassableOpenDoorTile('doorOpenOctopus' as Tile)).toBe(true)
    expect(isPassableOpenDoorTile('door' as Tile)).toBe(false)
    expect(isPassableOpenDoorTile('floor' as Tile)).toBe(false)
  })
})
