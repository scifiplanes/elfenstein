import { describe, expect, it } from 'vitest'
import { ContentDB } from './content/contentDb'
import { reduce } from './reducer'
import type { GameState } from './types'
import { DOOR_OCTOPUS_OPEN_FX_DURATION_MS } from './tiles'
import { makeInitialState } from './state/initialState'

const content = ContentDB.createDefault()

function withOctopusDoorEastOfPlayer(overrides?: Partial<GameState>): GameState {
  let s = makeInitialState(content)
  s = { ...s, ...overrides }
  const { w } = s.floor
  const px = 5
  const py = 5
  const doorX = px + 1
  const doorY = py
  const doorIdx = doorX + doorY * w
  const tiles = s.floor.tiles.slice()
  if (tiles[doorIdx] === 'wall') tiles[doorIdx] = 'floor'
  tiles[doorIdx] = 'doorOctopus'
  return {
    ...s,
    ui: { ...s.ui, screen: 'game' },
    floor: {
      ...s.floor,
      tiles,
      playerPos: { x: px, y: py },
      playerDir: 1,
    },
  }
}

describe('octopus door open FX', () => {
  it('appends ui.doorOpenFx when stepping into doorOctopus', () => {
    const t0 = 1_000_000
    let s = withOctopusDoorEastOfPlayer({ nowMs: t0 })
    s = reduce(s, { type: 'player/step', forward: 1 })
    const fx = s.ui.doorOpenFx
    expect(fx).toBeDefined()
    expect(fx).toHaveLength(1)
    const row = fx![0]!
    expect(row.visual).toBe('octopus')
    expect(row.pos).toEqual({ x: 6, y: 5 })
    expect(row.startedAtMs).toBe(t0)
    expect(row.untilMs - row.startedAtMs).toBe(DOOR_OCTOPUS_OPEN_FX_DURATION_MS)
    expect(s.floor.tiles[6 + 5 * s.floor.w]).toBe('doorOpenOctopus')
  })

  it('prunes expired doorOpenFx on time/tick', () => {
    const t0 = 2_000_000
    let s = withOctopusDoorEastOfPlayer({ nowMs: t0 })
    s = reduce(s, { type: 'player/step', forward: 1 })
    expect(s.ui.doorOpenFx).toHaveLength(1)
    const after = t0 + DOOR_OCTOPUS_OPEN_FX_DURATION_MS + 50
    s = reduce(s, { type: 'time/tick', nowMs: after })
    expect(s.ui.doorOpenFx).toBeUndefined()
  })
})
