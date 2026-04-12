import { describe, expect, it } from 'vitest'
import {
  BYTES_DEPTH_ASSUMED,
  BYTES_RGBA16F,
  BYTES_RGBA8,
  cappedPixelRatio,
  estimateSteadyVram,
  gameDrawingBufferPx,
  stageDrawingBufferPx,
} from './pipelineEstimates'

describe('pipelineEstimates', () => {
  it('stageDrawingBufferPx matches floor(css * dpr)', () => {
    expect(stageDrawingBufferPx(1920, 1080, 1)).toEqual({ w: 1920, h: 1080 })
    expect(stageDrawingBufferPx(1920, 1080, 1.5)).toEqual({ w: 2880, h: 1620 })
  })

  it('cappedPixelRatio clamps cap to 1..1.5', () => {
    expect(cappedPixelRatio(2, 3)).toBe(1.5)
    expect(cappedPixelRatio(0.5, 2)).toBe(1)
    expect(cappedPixelRatio(1.25, 1)).toBe(1)
    expect(cappedPixelRatio(1.25, 2)).toBe(1.25)
  })

  it('estimateSteadyVram scales linearly with stage pixels for composer term', () => {
    const a = estimateSteadyVram({
      stageCssW: 100,
      stageCssH: 100,
      gameCssW: 10,
      gameCssH: 10,
      cappedDpr: 1,
      includeUiTexture: false,
    })
    const scenePixels = 10 * 10
    const stagePixels = 100 * 100
    expect(a.sceneColorBytes).toBe(scenePixels * BYTES_RGBA8)
    expect(a.sceneDepthBytes).toBe(scenePixels * BYTES_DEPTH_ASSUMED)
    expect(a.composerColorBytes).toBe(2 * stagePixels * BYTES_RGBA16F)
    expect(a.composerDepthBytes).toBe(2 * stagePixels * BYTES_DEPTH_ASSUMED)
    expect(a.uiCanvasTextureBytes).toBe(0)

    const b = estimateSteadyVram({
      stageCssW: 100,
      stageCssH: 100,
      gameCssW: 10,
      gameCssH: 10,
      cappedDpr: 1,
      includeUiTexture: true,
    })
    expect(b.uiCanvasTextureBytes).toBe(stagePixels * BYTES_RGBA8)
    expect(b.totalBytes - a.totalBytes).toBe(stagePixels * BYTES_RGBA8)
  })

  it('gameDrawingBufferPx matches production rounding', () => {
    expect(gameDrawingBufferPx(920, 518, 1.5)).toEqual({ w: 1380, h: 777 })
  })
})
