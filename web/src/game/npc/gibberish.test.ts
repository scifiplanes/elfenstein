import { describe, expect, it } from 'vitest'
import { GNOME_FORMS, toGibberish } from './gibberish'

const gnomeSet = new Set(GNOME_FORMS)

function hasCombiningMark(s: string): boolean {
  for (const ch of s) {
    const cp = ch.codePointAt(0)!
    if (cp >= 0x0300 && cp <= 0x036f) return true
  }
  return false
}

function stripCombining(s: string): string {
  return [...s]
    .filter((ch) => {
      const cp = ch.codePointAt(0)!
      return cp < 0x0300 || cp > 0x036f
    })
    .join('')
}

describe('toGibberish', () => {
  it('is deterministic for same lang, seed, salt', () => {
    const a = toGibberish('DeepGnome', 'x', 12345, 'npc_a')
    const b = toGibberish('DeepGnome', 'y', 12345, 'npc_a')
    expect(a).toBe(b)
  })

  it('differs when salt differs', () => {
    const seed = 999_001
    const a = toGibberish('Zalgo', '', seed, 'npc_a')
    const b = toGibberish('Zalgo', '', seed, 'npc_b')
    expect(a).not.toBe(b)
  })

  it('DeepGnome uses only gnome-family tokens', () => {
    const line = toGibberish('DeepGnome', '', 42, 'g_test')
    for (const token of line.split(/\s+/)) {
      expect(gnomeSet.has(token)).toBe(true)
    }
  })

  it('Zalgo output includes combining marks', () => {
    const line = toGibberish('Zalgo', '', 777, 'z_test')
    expect(hasCombiningMark(line)).toBe(true)
  })

  it('Mojibake segments are long; Zalgo base words are short letters-only', () => {
    const seed = 555_666
    const salt = 'same_npc'
    const m = toGibberish('Mojibake', '', seed, salt)
    for (const w of m.split(/\s+/)) {
      expect(w.length).toBeGreaterThanOrEqual(12)
    }
    const z = toGibberish('Zalgo', '', seed, salt)
    for (const w of z.split(/\s+/)) {
      const core = stripCombining(w)
      expect(core.length).toBeGreaterThanOrEqual(3)
      expect(core.length).toBeLessThanOrEqual(7)
      expect(core).toMatch(/^[a-z]+$/)
    }
  })
})
