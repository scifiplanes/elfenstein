/**
 * Theoretical VRAM / pixel budgets for the 3D scene RT, EffectComposer ping-pong (half-float),
 * and full-stage UI capture texture. Depth sizes are **assumptions** for budgeting (drivers vary).
 */

export const BYTES_RGBA8 = 4
/** `HalfFloatType` composer buffers (RGBA16F). */
export const BYTES_RGBA16F = 8
/** Rough allowance per pixel for a depth attachment (24/32‑bit class). */
export const BYTES_DEPTH_ASSUMED = 4

export function effectiveDevicePixelRatio(): number {
  if (typeof window === 'undefined') return 1
  const vvScale = window.visualViewport?.scale || 1
  return (window.devicePixelRatio || 1) / Math.max(1e-6, vvScale)
}

export function cappedPixelRatio(pixelRatioCap: number, deviceDpr: number): number {
  const cap = Math.max(1, Math.min(1.5, pixelRatioCap))
  return Math.min(deviceDpr, cap)
}

export function stageDrawingBufferPx(
  stageCssW: number,
  stageCssH: number,
  cappedDpr: number,
): { w: number; h: number } {
  return {
    w: Math.max(1, Math.floor(stageCssW * cappedDpr)),
    h: Math.max(1, Math.floor(stageCssH * cappedDpr)),
  }
}

export function gameDrawingBufferPx(gameCssW: number, gameCssH: number, cappedDpr: number): { w: number; h: number } {
  return {
    w: Math.max(1, Math.floor(gameCssW * cappedDpr)),
    h: Math.max(1, Math.floor(gameCssH * cappedDpr)),
  }
}

export type VramEstimateBreakdown = {
  sceneColorBytes: number
  sceneDepthBytes: number
  /** Two internal `EffectComposer` RTs, `HalfFloatType` color. */
  composerColorBytes: number
  /** Assumed depth on each composer RT. */
  composerDepthBytes: number
  /** One full-stage `CanvasTexture` / capture at RGBA8. */
  uiCanvasTextureBytes: number
  totalBytes: number
}

export function estimateSteadyVram(args: {
  stageCssW: number
  stageCssH: number
  gameCssW: number
  gameCssH: number
  cappedDpr: number
  includeUiTexture: boolean
}): VramEstimateBreakdown {
  const { w: sw, h: sh } = stageDrawingBufferPx(args.stageCssW, args.stageCssH, args.cappedDpr)
  const { w: gw, h: gh } = gameDrawingBufferPx(args.gameCssW, args.gameCssH, args.cappedDpr)
  const scenePixels = gw * gh
  const stagePixels = sw * sh
  const sceneColor = scenePixels * BYTES_RGBA8
  const sceneDepth = scenePixels * BYTES_DEPTH_ASSUMED
  const composerColor = 2 * stagePixels * BYTES_RGBA16F
  const composerDepth = 2 * stagePixels * BYTES_DEPTH_ASSUMED
  const ui = args.includeUiTexture ? stagePixels * BYTES_RGBA8 : 0
  const total = sceneColor + sceneDepth + composerColor + composerDepth + ui
  return {
    sceneColorBytes: sceneColor,
    sceneDepthBytes: sceneDepth,
    composerColorBytes: composerColor,
    composerDepthBytes: composerDepth,
    uiCanvasTextureBytes: ui,
    totalBytes: total,
  }
}

export function formatBytes(n: number): string {
  const mb = n / (1024 * 1024)
  return `${mb.toFixed(2)} MiB`
}
