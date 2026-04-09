import { describe, expect, it } from 'vitest'
import { pickPlayerSpawnCell } from './playerFloorCell'
import type { FloorPoi, Tile } from '../types'

describe('pickPlayerSpawnCell', () => {
  it('nudges off a door entrance onto the nearest reachable plain floor (BFS N first)', () => {
    const w = 3
    const h = 3
    const tiles: Tile[] = Array.from({ length: w * h }, () => 'wall')
    tiles[1 + 0 * w] = 'floor'
    tiles[1 + 1 * w] = 'door'
    const entrance = { x: 1, y: 1 }
    const pos = pickPlayerSpawnCell(tiles, w, h, entrance, [])
    expect(pos).toEqual({ x: 1, y: 0 })
  })

  it('keeps entrance when it is already plain floor without a POI', () => {
    const w = 3
    const h = 3
    const tiles: Tile[] = Array.from({ length: w * h }, () => 'wall')
    tiles[1 + 1 * w] = 'floor'
    const entrance = { x: 1, y: 1 }
    expect(pickPlayerSpawnCell(tiles, w, h, entrance, [])).toEqual(entrance)
  })

  it('steps off entrance when a POI occupies the entrance cell', () => {
    const w = 3
    const h = 3
    const tiles: Tile[] = Array.from({ length: w * h }, () => 'wall')
    tiles[1 + 0 * w] = 'floor'
    tiles[1 + 1 * w] = 'floor'
    const entrance = { x: 1, y: 1 }
    const pois: FloorPoi[] = [{ id: 'well_1', kind: 'Well', pos: { ...entrance }, drained: false }]
    const pos = pickPlayerSpawnCell(tiles, w, h, entrance, pois)
    expect(pos).toEqual({ x: 1, y: 0 })
  })

  it('uses relaxed BFS when strict BFS is blocked by POI but plain floor exists beyond', () => {
    const w = 3
    const h = 3
    const tiles: Tile[] = Array.from({ length: w * h }, () => 'wall')
    tiles[1 + 0 * w] = 'floor'
    tiles[2 + 0 * w] = 'floor'
    tiles[1 + 1 * w] = 'door'
    const entrance = { x: 1, y: 1 }
    const pois: FloorPoi[] = [{ id: 'well_n', kind: 'Well', pos: { x: 1, y: 0 }, drained: false }]
    const pos = pickPlayerSpawnCell(tiles, w, h, entrance, pois)
    expect(pos).toEqual({ x: 2, y: 0 })
  })

  it('never returns a door tile when any plain floor exists on the map', () => {
    const w = 2
    const h = 2
    const tiles: Tile[] = ['door', 'wall', 'floor', 'wall']
    const entrance = { x: 0, y: 0 }
    expect(pickPlayerSpawnCell(tiles, w, h, entrance, [])).toEqual({ x: 0, y: 1 })
  })
})
