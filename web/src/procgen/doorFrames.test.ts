import { describe, expect, it } from 'vitest'
import { applyDecorativeDoorsOnDoorFrames } from './doorFrames'
import type { Tile } from '../game/types'
import { mulberry32 } from './seededRng'

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

/** Horizontal 1-wide corridor: nine straight throat cells at y=2, x=2..10. */
function gridWithNineEwDoorFrameThroats(): { tiles: Tile[]; w: number; h: number } {
  const w = 13
  const h = 5
  const tiles: Tile[] = Array.from({ length: w * h }, () => 'wall')
  for (let x = 1; x <= w - 2; x++) tiles[x + 2 * w] = 'floor'
  return { tiles, w, h }
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
      rng: { ...rng, int: () => 0 },
      occupied,
      chance: 1,
      decorativeDoorsMax: 99,
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
      rng: { ...rng, int: () => 0 },
      occupied: new Set<string>(),
      chance: 1,
      decorativeDoorsMax: 99,
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
      rng: { next: () => 0, int: () => 0 },
      occupied: new Set<string>(),
      chance: 0,
      decorativeDoorsMax: 99,
    })
    expect(decorApplied).toBe(0)
    expect(tiles[throat.x + throat.y * w]).toBe('floor')
  })

  it('respects decorativeDoorsMax when chance is 1 (seeded shuffle + cap)', () => {
    const { tiles, w, h } = gridWithNineEwDoorFrameThroats()
    const rng = mulberry32(2026_04_12)
    const { decorApplied } = applyDecorativeDoorsOnDoorFrames({
      tiles,
      w,
      h,
      rng,
      occupied: new Set<string>(),
      chance: 1,
      decorativeDoorsMax: 2,
    })
    expect(decorApplied).toBe(2)
    let doorish = 0
    for (let x = 2; x <= 10; x++) {
      const t = tiles[x + 2 * w]
      if (t === 'door' || t === 'doorOctopus') doorish++
    }
    expect(doorish).toBe(2)
  })
})
