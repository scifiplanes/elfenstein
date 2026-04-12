import { describe, expect, it } from 'vitest'
import { DEFAULT_ITEMS } from './items'

function isDefaultEmojiPresentation(icon: {
  kind: string
  tintFilter?: string
  displayScale?: number
  rotateDeg?: number
  flipHorizontal?: boolean
  flipVertical?: boolean
}): boolean {
  if (icon.kind !== 'emoji') return true
  const noTint = !icon.tintFilter?.trim()
  const scale = icon.displayScale ?? 1
  const rot = icon.rotateDeg ?? 0
  const noRotate = ((rot % 360) + 360) % 360 === 0
  const noFlip = icon.flipHorizontal !== true && icon.flipVertical !== true
  return noTint && scale === 1 && noRotate && noFlip
}

describe('DEFAULT_ITEMS emoji disambiguation', () => {
  it('each duplicate glyph has at most one default presentation (no tint, scale 1)', () => {
    const byGlyph = new Map<string, typeof DEFAULT_ITEMS>()
    for (const item of DEFAULT_ITEMS) {
      const ic = item.icon
      if (ic.kind !== 'emoji') continue
      const list = byGlyph.get(ic.value) ?? []
      list.push(item)
      byGlyph.set(ic.value, list)
    }

    for (const [glyph, list] of byGlyph) {
      if (list.length < 2) continue
      const defaults = list.filter((row) => isDefaultEmojiPresentation(row.icon))
      expect(
        defaults.length,
        `glyph ${glyph}: at most one item may omit tintFilter and use displayScale 1`,
      ).toBeLessThanOrEqual(1)
    }
  })

  it('non-default duplicates use tint and/or scale', () => {
    const byGlyph = new Map<string, typeof DEFAULT_ITEMS>()
    for (const item of DEFAULT_ITEMS) {
      const ic = item.icon
      if (ic.kind !== 'emoji') continue
      const list = byGlyph.get(ic.value) ?? []
      list.push(item)
      byGlyph.set(ic.value, list)
    }

    for (const [glyph, list] of byGlyph) {
      if (list.length < 2) continue
      for (const row of list) {
        const ic = row.icon
        if (ic.kind !== 'emoji') continue
        if (isDefaultEmojiPresentation(ic)) continue
        const hasTint = Boolean(ic.tintFilter?.trim())
        const hasScale = (ic.displayScale ?? 1) !== 1
        const rot = ic.rotateDeg ?? 0
        const hasRotate = ((rot % 360) + 360) % 360 !== 0
        const hasFlip = ic.flipHorizontal === true || ic.flipVertical === true
        expect(hasTint || hasScale || hasRotate || hasFlip, `${row.id} (${glyph})`).toBe(true)
      }
    }
  })

  it('within each duplicate glyph group, (tintFilter, displayScale) pairs are unique', () => {
    const byGlyph = new Map<string, typeof DEFAULT_ITEMS>()
    for (const item of DEFAULT_ITEMS) {
      const ic = item.icon
      if (ic.kind !== 'emoji') continue
      const list = byGlyph.get(ic.value) ?? []
      list.push(item)
      byGlyph.set(ic.value, list)
    }

    for (const [glyph, list] of byGlyph) {
      if (list.length < 2) continue
      const keys = list.map((row) => {
        const ic = row.icon
        if (ic.kind !== 'emoji') return ''
        return `${ic.tintFilter ?? ''}\t${ic.displayScale ?? 1}\t${ic.rotateDeg ?? 0}\t${ic.flipHorizontal === true ? '1' : ''}\t${ic.flipVertical === true ? '1' : ''}`
      })
      expect(new Set(keys).size, `glyph ${glyph}: duplicate (tint, scale) keys`).toBe(keys.length)
    }
  })
})
