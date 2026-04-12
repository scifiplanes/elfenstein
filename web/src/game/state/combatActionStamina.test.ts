import { describe, expect, it } from 'vitest'
import type { Character, CharacterStats } from '../types'
import {
  COMBAT_DEFEND_STAMINA_COST,
  COMBAT_FLEE_STAMINA_COST,
  effectiveCombatAttackStaminaCost,
  effectiveDefendStaminaCost,
  effectiveFleeStaminaCost,
} from './combat'

type MkCharOverrides = Partial<Omit<Character, 'id' | 'stats'>> &
  Pick<Character, 'id'> & { stats?: Partial<CharacterStats> }

function mkChar(overrides: MkCharOverrides): Character {
  const base: Character = {
    id: overrides.id,
    name: overrides.id,
    species: 'Igor',
    endurance: 5,
    stats: {
      strength: 5,
      agility: 5,
      speed: 5,
      perception: 5,
      endurance: 5,
      intelligence: 5,
      wisdom: 5,
      luck: 5,
    },
    armor: 0,
    resistances: {},
    skills: {},
    hunger: 50,
    thirst: 50,
    hp: 50,
    stamina: 50,
    statuses: [],
    equipment: {},
  }
  return {
    ...base,
    ...overrides,
    stats: { ...base.stats, ...overrides.stats } as CharacterStats,
  }
}

describe('effectiveDefendStaminaCost', () => {
  it('matches base at pivot endurance (5)', () => {
    const c = mkChar({ id: 'c1', stats: { endurance: 5 } })
    expect(effectiveDefendStaminaCost(c)).toBe(COMBAT_DEFEND_STAMINA_COST)
  })

  it('reduces cost for high endurance', () => {
    const c = mkChar({ id: 'c1', stats: { endurance: 9 } })
    expect(effectiveDefendStaminaCost(c)).toBe(2)
  })

  it('increases cost for low endurance within max clamp', () => {
    const c = mkChar({ id: 'c1', stats: { endurance: 1 } })
    expect(effectiveDefendStaminaCost(c)).toBe(6)
  })

  it('clamps to minimum 1', () => {
    const c = mkChar({ id: 'c1', stats: { endurance: 99 } })
    expect(effectiveDefendStaminaCost(c)).toBe(1)
  })
})

describe('effectiveFleeStaminaCost', () => {
  it('matches base at pivot speed (5)', () => {
    const c = mkChar({ id: 'c1', stats: { speed: 5 } })
    expect(effectiveFleeStaminaCost(c)).toBe(COMBAT_FLEE_STAMINA_COST)
  })

  it('reduces cost for high speed', () => {
    const c = mkChar({ id: 'c1', stats: { speed: 9 } })
    expect(effectiveFleeStaminaCost(c)).toBe(6)
  })

  it('increases cost for low speed', () => {
    const c = mkChar({ id: 'c1', stats: { speed: 1 } })
    expect(effectiveFleeStaminaCost(c)).toBe(10)
  })

  it('clamps to minimum 2', () => {
    const c = mkChar({ id: 'c1', stats: { speed: 99 } })
    expect(effectiveFleeStaminaCost(c)).toBe(2)
  })
})

describe('effectiveCombatAttackStaminaCost', () => {
  it('matches weapon base at pivot damageStat (5)', () => {
    const c = mkChar({ id: 'c1', stats: { strength: 5 } })
    const w = { baseDamage: 5, damageType: 'Blunt' as const, damageStat: 'strength' as const, staminaCost: 6 }
    expect(effectiveCombatAttackStaminaCost(c, w)).toBe(6)
  })

  it('reduces cost when damageStat is high', () => {
    const c = mkChar({ id: 'c1', stats: { strength: 10 } })
    const w = { baseDamage: 5, damageType: 'Blunt' as const, damageStat: 'strength' as const, staminaCost: 6 }
    expect(effectiveCombatAttackStaminaCost(c, w)).toBe(5)
  })

  it('ignores stats when damageStat is omitted (base only)', () => {
    const c = mkChar({ id: 'c1', stats: { strength: 1 } })
    const w = { baseDamage: 5, damageType: 'Fire' as const, staminaCost: 6 }
    expect(effectiveCombatAttackStaminaCost(c, w)).toBe(6)
  })

  it('allows 0 when weapon base stamina is 0', () => {
    const c = mkChar({ id: 'c1', stats: { strength: 10 } })
    const w = { baseDamage: 1, damageType: 'Blunt' as const, damageStat: 'strength' as const, staminaCost: 0 }
    expect(effectiveCombatAttackStaminaCost(c, w)).toBe(0)
  })

  it('clamps positive base to at least 1', () => {
    const c = mkChar({ id: 'c1', stats: { strength: 99 } })
    const w = { baseDamage: 5, damageType: 'Blunt' as const, damageStat: 'strength' as const, staminaCost: 4 }
    expect(effectiveCombatAttackStaminaCost(c, w)).toBe(1)
  })
})
