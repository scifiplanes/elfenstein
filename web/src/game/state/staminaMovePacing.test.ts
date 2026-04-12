import { describe, expect, it } from 'vitest'
import { effectiveStaminaMoveEveryN, nextStaminaMovePace } from './staminaMovePacing'

describe('effectiveStaminaMoveEveryN', () => {
  it('matches base N at endurance pivot 5', () => {
    expect(effectiveStaminaMoveEveryN(3, 5)).toBe(3)
    expect(effectiveStaminaMoveEveryN(1, 5)).toBe(1)
  })

  it('increases N for endurance above pivot', () => {
    expect(effectiveStaminaMoveEveryN(1, 10)).toBe(2)
  })

  it('decreases toward 1 for low endurance', () => {
    expect(effectiveStaminaMoveEveryN(1, 3)).toBe(1)
  })

  it('clamps result to 1..30', () => {
    expect(effectiveStaminaMoveEveryN(30, 20)).toBe(30)
    expect(effectiveStaminaMoveEveryN(1, -50)).toBe(1)
  })
})

describe('nextStaminaMovePace', () => {
  it('charges every move when N is 1 and base cost positive', () => {
    expect(nextStaminaMovePace(undefined, 1, 2)).toEqual({ cost: 2, nextCounter: 0 })
    expect(nextStaminaMovePace(0, 1, 2)).toEqual({ cost: 2, nextCounter: 0 })
  })

  it('charges on every N-th move for N=3', () => {
    let c: number | undefined
    let out = nextStaminaMovePace(c, 3, 1)
    expect(out).toEqual({ cost: 0, nextCounter: 1 })
    c = out.nextCounter
    out = nextStaminaMovePace(c, 3, 1)
    expect(out).toEqual({ cost: 0, nextCounter: 2 })
    out = nextStaminaMovePace(out.nextCounter, 3, 1)
    expect(out).toEqual({ cost: 1, nextCounter: 0 })
    out = nextStaminaMovePace(out.nextCounter, 3, 1)
    expect(out).toEqual({ cost: 0, nextCounter: 1 })
  })

  it('never charges when base cost is 0', () => {
    expect(nextStaminaMovePace(undefined, 3, 0)).toEqual({ cost: 0, nextCounter: 1 })
    expect(nextStaminaMovePace(2, 3, 0)).toEqual({ cost: 0, nextCounter: 0 })
  })

  it('clamps invalid interval to at least 1', () => {
    expect(nextStaminaMovePace(undefined, 0, 1)).toEqual({ cost: 1, nextCounter: 0 })
  })
})
