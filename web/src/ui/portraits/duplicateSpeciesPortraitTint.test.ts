import { describe, expect, it } from 'vitest'
import type { CharacterId, Species } from '../../game/types'
import { portraitNeedsDuplicateSpeciesTint } from './duplicateSpeciesPortraitTint'

function rows(...pairs: Array<[string, Species]>) {
  return pairs.map(([id, species]) => ({ id: id as CharacterId, species }))
}

describe('portraitNeedsDuplicateSpeciesTint', () => {
  it('is false when species is unique', () => {
    const party = rows(['a', 'Igor'], ['b', 'Mycyclops'])
    expect(portraitNeedsDuplicateSpeciesTint(party, 'a')).toBe(false)
    expect(portraitNeedsDuplicateSpeciesTint(party, 'b')).toBe(false)
  })

  it('tints every duplicate after the first in party order', () => {
    const party = rows(['a', 'Igor'], ['b', 'Igor'])
    expect(portraitNeedsDuplicateSpeciesTint(party, 'a')).toBe(false)
    expect(portraitNeedsDuplicateSpeciesTint(party, 'b')).toBe(true)
  })

  it('tints second and third when three share a species', () => {
    const party = rows(['x', 'Frosch'], ['y', 'Frosch'], ['z', 'Frosch'])
    expect(portraitNeedsDuplicateSpeciesTint(party, 'x')).toBe(false)
    expect(portraitNeedsDuplicateSpeciesTint(party, 'y')).toBe(true)
    expect(portraitNeedsDuplicateSpeciesTint(party, 'z')).toBe(true)
  })

  it('uses first occurrence index when same species is non-contiguous', () => {
    const party = rows(['a', 'Afonso'], ['b', 'Igor'], ['c', 'Afonso'])
    expect(portraitNeedsDuplicateSpeciesTint(party, 'a')).toBe(false)
    expect(portraitNeedsDuplicateSpeciesTint(party, 'c')).toBe(true)
  })

  it('returns false for unknown character id', () => {
    const party = rows(['a', 'Igor'])
    expect(portraitNeedsDuplicateSpeciesTint(party, 'missing' as CharacterId)).toBe(false)
  })
})
