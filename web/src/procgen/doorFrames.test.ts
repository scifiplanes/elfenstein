import { describe, expect, it } from 'vitest'
import { applyDecorativeDoorsOnDoorFrames } from './doorFrames'
import type { Tile } from '../game/types'

/** Minimal 7×5 grid: one EW door-frame throat at (3,2). */
function gridWithSingleDoorFrameThroat(): { tiles: Tile[]; w: number; h: number; throat: { x: number; y: number } } {
  const w = 7
  const h = 5
  const tiles: Tile[] = Array.from({ length: w * h }, () => 'wall')
  const carve = (x: number, y: number) => {
    tiles[x + y * w] = 'floor'
  }
  for (let y = 1; y <= 3; y++) {
    for (let x = 1; x <= 5; x++) carve(x, y)
  }
  tiles[3 + 1 * w] = 'wall'
  tiles[3 + 3 * w] = 'wall'
  return { tiles, w, h, throat: { x: 3, y: 2 } }
}

describe('applyDecorativeDoorsOnDoorFrames', () => {
  it('skips occupied cells', () => {
    const { tiles, w, h, throat } = gridWithSingleDoorFrameThroat()
    const occupied = new Set<string>([`${throat.x},${throat.y}`])
    const rng = { next: () => 0 }
    const { decorApplied } = applyDecorativeDoorsOnDoorFrames({
      tiles,
      w,
      h,
      rng,
      occupied,
      chance: 1,
    })
    expect(decorApplied).toBe(0)
    expect(tiles[throat.x + throat.y * w]).toBe('floor')
  })

  it('with chance 1 places a closed door tile on an unused throat (deterministic rng)', () => {
    const { tiles, w, h, throat } = gridWithSingleDoorFrameThroat()
    let n = 0
    const rng = {
      next: () => {
        n++
        return n === 1 ? 0 : 0.99
      },
    }
    const { decorApplied } = applyDecorativeDoorsOnDoorFrames({
      tiles,
      w,
      h,
      rng,
      occupied: new Set<string>(),
      chance: 1,
    })
    expect(decorApplied).toBe(1)
    const t = tiles[throat.x + throat.y * w]
    expect(t === 'door' || t === 'doorOctopus').toBe(true)
    expect(t === 'doorOpen' || t === 'doorOpenOctopus').toBe(false)
  })

  it('respects chance 0', () => {
    const { tiles, w, h, throat } = gridWithSingleDoorFrameThroat()
    const { decorApplied } = applyDecorativeDoorsOnDoorFrames({
      tiles,
      w,
      h,
      rng: { next: () => 0 },
      occupied: new Set<string>(),
      chance: 0,
    })
    expect(decorApplied).toBe(0)
    expect(tiles[throat.x + throat.y * w]).toBe('floor')
  })
})
