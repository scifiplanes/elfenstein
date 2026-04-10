import { describe, expect, it } from 'vitest'
import { generateDungeon } from './generateDungeon'
import type { FloorType } from './types'

/** Stable procgen input for regression snapshots of `meta.layoutMetrics`. */
const FIXED_INPUT = {
  seed: 0xcafe_beef,
  w: 31,
  h: 31,
  floorIndex: 11,
  difficulty: 1 as const,
}

const ALL_FLOOR_TYPES: FloorType[] = [
  'Dungeon',
  'Cave',
  'Ruins',
  'Jungle',
  'LivingBio',
  'Bunker',
  'Golem',
  'Catacombs',
  'Palace',
]

describe('floor layoutMetrics snapshots (topology regression)', () => {
  for (const floorType of ALL_FLOOR_TYPES) {
    it(`layoutMetrics ${floorType}`, () => {
      const gen = generateDungeon({ ...FIXED_INPUT, floorType })
      expect(gen.meta.layoutMetrics).toMatchSnapshot()
    })
  }
})

describe('reskin vs base tile digest inequality (same seed)', () => {
  it('Jungle differs from Cave', () => {
    const cave = generateDungeon({ ...FIXED_INPUT, floorType: 'Cave' })
    const jungle = generateDungeon({ ...FIXED_INPUT, floorType: 'Jungle' })
    expect(cave.tiles.join('')).not.toBe(jungle.tiles.join(''))
  })

  it('Bunker differs from Dungeon', () => {
    const dungeon = generateDungeon({ ...FIXED_INPUT, floorType: 'Dungeon' })
    const bunker = generateDungeon({ ...FIXED_INPUT, floorType: 'Bunker' })
    expect(dungeon.tiles.join('')).not.toBe(bunker.tiles.join(''))
  })

  it('Catacombs differs from Ruins', () => {
    const ruins = generateDungeon({ ...FIXED_INPUT, floorType: 'Ruins' })
    const cat = generateDungeon({ ...FIXED_INPUT, floorType: 'Catacombs' })
    expect(ruins.tiles.join('')).not.toBe(cat.tiles.join(''))
  })
})
