import { describe, expect, it } from 'vitest'
import { spriteDrawRectForPortraitClip } from './paintTentReplacementPortraitCanvas'

describe('spriteDrawRectForPortraitClip', () => {
  it('matches portrait clip: height = ch, width aspect-capped by cw, centered with nudge', () => {
    const nw = 100
    const nh = 200
    const cw = 80
    const ch = 200
    const nudge = -30
    const r = spriteDrawRectForPortraitClip(nw, nh, cw, ch, nudge)
    expect(r.dh).toBe(200)
    expect(r.dw).toBe(80)
    expect(r.dx).toBe(0)
    // cy = ch/2 + nudge; top = cy - dh/2
    expect(r.dy).toBe(ch / 2 + nudge - r.dh / 2)
  })
})
