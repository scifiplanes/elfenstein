import {
  resolveTentReplacementPortraitAliveSaturateMult,
  tentReplacementPortraitDeadSaturateMult,
} from '../../game/state/tentReplacementPortraitTint'

/**
 * Same drop-shadow as `.sprite` in `PortraitPanel.module.css`, merged into stack-level `filter`
 * so `hue-rotate` is not isolated by per-sprite filters.
 */
export const PORTRAIT_SPRITE_DROP_SHADOW = 'drop-shadow(0 8px 18px rgba(0, 0, 0, 0.35))'

/**
 * CSS `filter` for hub tent replacements; matches the duplicate-species stacks in
 * `PortraitPanel.module.css` (ADR-0439) but with a per-recruit hue and `saturate()` spread (**ADR-0468**).
 */
export function tentReplacementPortraitFilterCss(args: {
  hueDeg: number
  isDead: boolean
  /** Stored alive `saturate()` mult; omit/undefined → legacy 1.65. */
  saturateMultAlive?: number
}): string {
  const deg = ((Math.round(args.hueDeg) % 360) + 360) % 360
  const aliveSat = resolveTentReplacementPortraitAliveSaturateMult(args.saturateMultAlive)
  const sat = args.isDead ? tentReplacementPortraitDeadSaturateMult(aliveSat) : aliveSat
  const satStr = Number(sat.toFixed(3))
  if (args.isDead) {
    return `hue-rotate(${deg}deg) saturate(${satStr}) grayscale(0.85) brightness(0.55)`
  }
  return `hue-rotate(${deg}deg) saturate(${satStr}) contrast(1.14) brightness(1.06)`
}

/** Full stack filter: color chain + shared portrait drop-shadow (apply on `.spriteStack`, clear `.sprite` filter). */
export function tentReplacementPortraitStackFilter(args: {
  hueDeg: number
  isDead: boolean
  saturateMultAlive?: number
}): string {
  return `${tentReplacementPortraitFilterCss(args)} ${PORTRAIT_SPRITE_DROP_SHADOW}`
}
