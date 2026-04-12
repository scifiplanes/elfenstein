import { describe, expect, it } from 'vitest'
import { generateDungeon } from './generateDungeon'
import type { FloorProperty } from './types'

const BASE = {
  w: 31,
  h: 31,
  floorType: 'Dungeon' as const,
  floorProperties: [] as FloorProperty[],
  difficulty: 1 as const,
}

describe('placePois — well drained spawn', () => {
  it(
    'never marks the well drained on floor 0',
    () => {
      for (let seed = 0; seed < 16; seed++) {
        const gen = generateDungeon({ ...BASE, seed, floorIndex: 0 })
        const well = gen.pois.find((p) => p.kind === 'Well')
        expect(well, `seed ${seed}`).toBeTruthy()
        expect(well!.drained, `seed ${seed}`).toBeFalsy()
      }
    },
    12_000,
  )

  it(
    'sometimes marks the well drained on deeper floors (deterministic)',
    () => {
      let anyDrained = false
      let anyFilled = false
      for (let seed = 0; seed < 48; seed++) {
        const gen = generateDungeon({ ...BASE, seed, floorIndex: 1 })
        const well = gen.pois.find((p) => p.kind === 'Well')
        expect(well).toBeTruthy()
        if (well?.drained) anyDrained = true
        else anyFilled = true
      }
      expect(anyDrained).toBe(true)
      expect(anyFilled).toBe(true)
    },
    20_000,
  )
})
