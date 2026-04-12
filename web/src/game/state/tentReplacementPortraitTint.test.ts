import { describe, expect, it } from 'vitest'
import {
  TENT_REPLACEMENT_PORTRAIT_SATURATE_ALIVE_MAX,
  TENT_REPLACEMENT_PORTRAIT_SATURATE_ALIVE_MIN,
  tentReplacementPortraitDeadSaturateMult,
  tentReplacementPortraitSaturateMultFromHash,
} from './tentReplacementPortraitTint'

describe('tentReplacementPortraitSaturateMultFromHash', () => {
  it('maps hashes into the configured alive range', () => {
    for (let i = 0; i < 200; i++) {
      const s = tentReplacementPortraitSaturateMultFromHash(0xfeed0000 + i * 9973)
      expect(s).toBeGreaterThanOrEqual(TENT_REPLACEMENT_PORTRAIT_SATURATE_ALIVE_MIN)
      expect(s).toBeLessThanOrEqual(TENT_REPLACEMENT_PORTRAIT_SATURATE_ALIVE_MAX)
    }
  })
})

describe('tentReplacementPortraitDeadSaturateMult', () => {
  it('scales from alive mult with a floor', () => {
    expect(tentReplacementPortraitDeadSaturateMult(1.65)).toBeCloseTo(1.4, 5)
    expect(tentReplacementPortraitDeadSaturateMult(0.4)).toBeCloseTo(0.339, 3)
  })
})
