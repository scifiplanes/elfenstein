import { describe, expect, it } from 'vitest'
import { generateDungeon } from './generateDungeon'
import { LEGACY_RUINS_TUNING } from './floorTopologyTuning'
import { runRuinsLayout } from './realizeRuins'
import { mulberry32, splitSeed } from './seededRng'

/** Same layout RNG as `generateDungeon` attempt 0 for the floorLayoutMetrics fixture input. */
function layoutRngForFloorLayoutMetricsFixture(): ReturnType<typeof mulberry32> {
  const inputSeed = 0xcafe_beef >>> 0
  const floorIndex = 11
  const mixedSeed = splitSeed(inputSeed, 31_337 + floorIndex)
  return mulberry32(splitSeed(mixedSeed, 1))
}

describe('runRuinsLayout', () => {
  it('keeps macro stamp bbox below full-map hall scale for the floorLayoutMetrics fixture stream', () => {
    const rng = layoutRngForFloorLayoutMetricsFixture()
    const { genRooms } = runRuinsLayout(31, 31, rng, LEGACY_RUINS_TUNING)
    expect(genRooms.length).toBeGreaterThanOrEqual(1)
    expect(genRooms.every((r) => r.id.startsWith('r_macro_'))).toBe(true)
    const mapArea = 31 * 31
    const maxAreaFrac = Math.max(0, ...genRooms.map((r) => (r.rect.w * r.rect.h) / mapArea))
    expect(maxAreaFrac).toBeLessThan(0.78)
  })

  it('with no carved doorways, still yields multiple macro rooms when touch merge does not connect the whole grid', () => {
    const noDoors = { ...LEGACY_RUINS_TUNING, doorwayChance: 0, spanningTreeDoorways: false }
    let foundMulti = false
    for (let seed = 0; seed < 400; seed++) {
      const { genRooms } = runRuinsLayout(31, 31, mulberry32(seed), noDoors)
      if (genRooms.length >= 3) {
        foundMulti = true
        break
      }
    }
    expect(foundMulti).toBe(true)
  })

  it(
    'full generateDungeon Ruins keeps enough wall mass (anti single-hall collapse) across seeds',
    () => {
      let sumWallFrac = 0
      const n = 24
      for (let seed = 0; seed < n; seed++) {
        const gen = generateDungeon({
          seed,
          w: 31,
          h: 31,
          floorIndex: 2,
          floorType: 'Ruins',
          difficulty: 1,
        })
        sumWallFrac += gen.tiles.filter((t) => t === 'wall').length / gen.tiles.length
      }
      expect(sumWallFrac / n).toBeGreaterThanOrEqual(0.46)
    },
    30_000,
  )
})
