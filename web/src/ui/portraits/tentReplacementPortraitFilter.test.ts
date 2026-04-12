import { describe, expect, it } from 'vitest'
import { PORTRAIT_SPRITE_DROP_SHADOW, tentReplacementPortraitFilterCss, tentReplacementPortraitStackFilter } from './tentReplacementPortraitFilter'

describe('tentReplacementPortraitFilterCss', () => {
  it('alive stack matches duplicate-species alive recipe with rotated hue', () => {
    expect(tentReplacementPortraitFilterCss({ hueDeg: 88, isDead: false })).toBe(
      'hue-rotate(88deg) saturate(1.65) contrast(1.14) brightness(1.06)',
    )
  })

  it('dead stack chains hue before grayscale like duplicate-species dead', () => {
    expect(tentReplacementPortraitFilterCss({ hueDeg: 72, isDead: true })).toBe(
      'hue-rotate(72deg) saturate(1.4) grayscale(0.85) brightness(0.55)',
    )
  })

  it('normalizes hue modulo 360', () => {
    expect(tentReplacementPortraitFilterCss({ hueDeg: 450, isDead: false })).toBe(
      'hue-rotate(90deg) saturate(1.65) contrast(1.14) brightness(1.06)',
    )
    expect(tentReplacementPortraitFilterCss({ hueDeg: -30, isDead: false })).toBe(
      'hue-rotate(330deg) saturate(1.65) contrast(1.14) brightness(1.06)',
    )
  })

  it('stack filter appends portrait drop-shadow', () => {
    expect(PORTRAIT_SPRITE_DROP_SHADOW).toBe('drop-shadow(0 8px 18px rgba(0, 0, 0, 0.35))')
    expect(tentReplacementPortraitStackFilter({ hueDeg: 12, isDead: false })).toBe(
      `hue-rotate(12deg) saturate(1.65) contrast(1.14) brightness(1.06) ${PORTRAIT_SPRITE_DROP_SHADOW}`,
    )
  })

  it('uses stored alive saturate multiplier and scales dead chain from it', () => {
    expect(tentReplacementPortraitFilterCss({ hueDeg: 0, isDead: false, saturateMultAlive: 0.4 })).toBe(
      'hue-rotate(0deg) saturate(0.4) contrast(1.14) brightness(1.06)',
    )
    expect(tentReplacementPortraitFilterCss({ hueDeg: 0, isDead: true, saturateMultAlive: 0.4 })).toBe(
      'hue-rotate(0deg) saturate(0.339) grayscale(0.85) brightness(0.55)',
    )
  })
})
