import html2canvas from 'html2canvas'
import * as THREE from 'three'
import { STAGE_CSS_HEIGHT, STAGE_CSS_WIDTH } from '../app/stageDesign'
import { DEFAULT_RENDER } from '../game/tuningDefaults'
import { FramePresenter } from '../world/FramePresenter'
import {
  cappedPixelRatio,
  effectiveDevicePixelRatio,
  estimateSteadyVram,
  formatBytes,
  stageDrawingBufferPx,
} from './pipelineEstimates'

export type PipelineBenchOptions = {
  /** Same clamp as `GameState.render.pixelRatioCap` (1..1.5). */
  pixelRatioCap?: number
  /** Typical game viewport CSS size inside the 1920×1080 stage. */
  gameCssW?: number
  gameCssH?: number
  /** Frames to time for `FramePresenter.render()` (composite + dither). */
  presenterFrames?: number
  /** `html2canvas` repetitions (each is expensive). */
  html2canvasIterations?: number
}

export type PipelineBenchResult = {
  deviceDpr: number
  cappedDpr: number
  pixelRatioCap: number
  estimatesIncludingUi: ReturnType<typeof estimateSteadyVram>
  estimatesGpuOnly: ReturnType<typeof estimateSteadyVram>
  gpu: {
    presenterFrames: number
    totalMs: number
    msPerFrame: number
    drawingBuffer: { w: number; h: number }
    gameSceneRt: { w: number; h: number }
    error?: string
  }
  html2canvasBench: {
    iterations: number
    timesMs: number[]
    meanMs: number
    minMs: number
    maxMs: number
    usedJsHeapBefore?: number
    usedJsHeapAfter?: number
    error?: string
  }
}

function mean(nums: number[]): number {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function makeBlackCanvasTexture(w: number, h: number): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = Math.max(1, w)
  c.height = Math.max(1, h)
  const ctx = c.getContext('2d')
  if (ctx) ctx.fillStyle = '#000000'
  if (ctx) ctx.fillRect(0, 0, c.width, c.height)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  return tex
}

export async function runPipelineBench(options: PipelineBenchOptions = {}): Promise<PipelineBenchResult> {
  const pixelRatioCap = options.pixelRatioCap ?? DEFAULT_RENDER.pixelRatioCap
  const gameCssW = options.gameCssW ?? 920
  const gameCssH = options.gameCssH ?? 518
  const presenterFrames = options.presenterFrames ?? 48
  const html2canvasIterations = options.html2canvasIterations ?? 4

  const deviceDpr = effectiveDevicePixelRatio()
  const cappedDpr = cappedPixelRatio(pixelRatioCap, deviceDpr)

  const estimatesIncludingUi = estimateSteadyVram({
    stageCssW: STAGE_CSS_WIDTH,
    stageCssH: STAGE_CSS_HEIGHT,
    gameCssW,
    gameCssH,
    cappedDpr,
    includeUiTexture: true,
  })
  const estimatesGpuOnly = estimateSteadyVram({
    stageCssW: STAGE_CSS_WIDTH,
    stageCssH: STAGE_CSS_HEIGHT,
    gameCssW,
    gameCssH,
    cappedDpr,
    includeUiTexture: false,
  })

  const gpu: PipelineBenchResult['gpu'] = {
    presenterFrames,
    totalMs: 0,
    msPerFrame: 0,
    drawingBuffer: { w: 0, h: 0 },
    gameSceneRt: { w: 0, h: 0 },
  }

  const html2canvasBench: PipelineBenchResult['html2canvasBench'] = {
    iterations: html2canvasIterations,
    timesMs: [],
    meanMs: 0,
    minMs: 0,
    maxMs: 0,
  }

  const perfMem = performance as Performance & { memory?: { usedJSHeapSize: number } }

  // ── GPU path (real WebGL + same classes as production) ─────────────────
  let presenter: FramePresenter | null = null
  let sceneRt: THREE.WebGLRenderTarget | null = null
  let uiTex: THREE.CanvasTexture | null = null
  let benchCanvas: HTMLCanvasElement | null = null
  try {
    benchCanvas = document.createElement('canvas')
    benchCanvas.style.cssText = 'position:fixed;left:-20000px;top:0;width:1px;height:1px;'
    document.body.appendChild(benchCanvas)

    presenter = await FramePresenter.create(benchCanvas)
    const renderer = presenter.getRenderer()
    presenter.syncSize(STAGE_CSS_WIDTH, STAGE_CSS_HEIGHT, pixelRatioCap)
    presenter.syncDither(DEFAULT_RENDER)

    const db = new THREE.Vector2()
    renderer.getDrawingBufferSize(db)
    gpu.drawingBuffer = { w: Math.floor(db.x), h: Math.floor(db.y) }

    const gw = Math.max(1, Math.floor(gameCssW * cappedDpr))
    const gh = Math.max(1, Math.floor(gameCssH * cappedDpr))
    gpu.gameSceneRt = { w: gw, h: gh }

    sceneRt = new THREE.WebGLRenderTarget(gw, gh, {
      depthBuffer: true,
      stencilBuffer: false,
      samples: 0,
      type: THREE.UnsignedByteType,
    })
    sceneRt.texture.colorSpace = THREE.SRGBColorSpace

    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera(60, gw / gh, 0.05, 100)
    cam.position.set(0, 0, 1)
    cam.lookAt(0, 0, 0)
    renderer.setRenderTarget(sceneRt)
    renderer.render(scene, cam)
    renderer.setRenderTarget(null)

    const { w: uiw, h: uih } = stageDrawingBufferPx(STAGE_CSS_WIDTH, STAGE_CSS_HEIGHT, cappedDpr)
    uiTex = makeBlackCanvasTexture(uiw, uih)

    presenter.setInputs({
      sceneTex: sceneRt.texture,
      uiTex,
      gameRectPx: { left: 120, top: 80, width: gameCssW, height: gameCssH },
      telegraphStrength: 0,
      telegraphColor: { r: 1, g: 1, b: 1 },
      telegraphTintMode: 0,
      telegraphTintPulse: 1,
      portraitRectsPx: [],
      portraitMouthTex: [],
      portraitIdleTex: [],
      portraitMouthOn: [],
      portraitIdleOn: [],
      portraitEyesInspectTex: [],
      portraitEyesInspectOn: [],
      portraitMouthAr: [],
      portraitIdleAr: [],
      portraitEyesInspectAr: [],
      portraitArtNudgeYCssPx: 0,
      portraitStatsRectsPx: [],
      navButtonRectsPx: [],
      navPushedOn: [],
      navPushedTex: null,
    })

    const t0 = performance.now()
    for (let i = 0; i < presenterFrames; i++) {
      presenter.render()
    }
    const t1 = performance.now()
    gpu.totalMs = t1 - t0
    gpu.msPerFrame = gpu.totalMs / presenterFrames

    presenter.dispose()
    presenter = null
    sceneRt.dispose()
    sceneRt = null
    uiTex.dispose()
    uiTex = null
  } catch (e) {
    gpu.error = e instanceof Error ? e.message : String(e)
    try {
      presenter?.dispose()
    } catch {
      /* ignore */
    }
    sceneRt?.dispose()
    uiTex?.dispose()
  } finally {
    if (benchCanvas?.parentNode) benchCanvas.parentNode.removeChild(benchCanvas)
  }

  // ── html2canvas (transient CPU + upload-sized bitmap) ───────────────────
  const captureWrap = document.createElement('div')
  captureWrap.setAttribute('data-capture-wrap', 'true')
  captureWrap.style.cssText = `position:fixed;left:-20000px;top:0;width:${STAGE_CSS_WIDTH}px;height:${STAGE_CSS_HEIGHT}px;`
  const captureRoot = document.createElement('div')
  captureRoot.setAttribute('data-capture-root', 'true')
  captureRoot.style.cssText = `width:100%;height:100%;position:relative;background:#121218;`
  const inner = document.createElement('div')
  inner.style.cssText =
    'position:absolute;left:40px;top:40px;right:40px;bottom:40px;border:2px solid #444;font:18px/1.4 system-ui;padding:16px;color:#ddd;'
  inner.textContent =
    'Synthetic HUD for html2canvas benchmark. Portraits, borders, and text approximate capture weight vs empty div.'
  captureRoot.appendChild(inner)
  captureWrap.appendChild(captureRoot)
  document.body.appendChild(captureWrap)

  const w = STAGE_CSS_WIDTH
  const h = STAGE_CSS_HEIGHT

  try {
    html2canvasBench.usedJsHeapBefore = perfMem.memory?.usedJSHeapSize

    for (let i = 0; i < html2canvasIterations; i++) {
      const t0 = performance.now()
      await html2canvas(captureWrap, {
        backgroundColor: null,
        logging: false,
        scale: cappedDpr,
        width: w,
        height: h,
        windowWidth: w,
        windowHeight: h,
        useCORS: true,
        onclone: (doc) => {
          const wrap = doc.querySelector('[data-capture-wrap="true"]') as HTMLElement | null
          if (wrap) {
            wrap.style.position = 'fixed'
            wrap.style.left = '0px'
            wrap.style.top = '0px'
            wrap.style.width = `${w}px`
            wrap.style.height = `${h}px`
            wrap.style.transform = 'none'
          }
          const root = doc.querySelector('[data-capture-root="true"]') as HTMLElement | null
          if (root) {
            root.style.position = 'absolute'
            root.style.left = '0px'
            root.style.top = '0px'
            root.style.width = '100%'
            root.style.height = '100%'
            root.style.transform = 'none'
          }
          doc.documentElement.style.margin = '0'
          doc.body.style.margin = '0'
        },
      })
      const t1 = performance.now()
      html2canvasBench.timesMs.push(t1 - t0)
    }

    html2canvasBench.usedJsHeapAfter = perfMem.memory?.usedJSHeapSize
    html2canvasBench.meanMs = mean(html2canvasBench.timesMs)
    html2canvasBench.minMs = Math.min(...html2canvasBench.timesMs)
    html2canvasBench.maxMs = Math.max(...html2canvasBench.timesMs)
  } catch (e) {
    html2canvasBench.error = e instanceof Error ? e.message : String(e)
  } finally {
    document.body.removeChild(captureWrap)
  }

  return {
    deviceDpr,
    cappedDpr,
    pixelRatioCap,
    estimatesIncludingUi,
    estimatesGpuOnly,
    gpu,
    html2canvasBench,
  }
}

export function formatBenchReport(r: PipelineBenchResult): string {
  const lines: string[] = []
  lines.push('=== Elfenstein pipeline benchmark ===')
  lines.push(`devicePixelRatio (viewport-adjusted): ${r.deviceDpr.toFixed(4)}`)
  lines.push(`pixelRatioCap (setting): ${r.pixelRatioCap}`)
  lines.push(`effective capped DPR: ${r.cappedDpr.toFixed(4)}`)
  lines.push('')
  lines.push('--- 1) Theoretical steady VRAM (see pipelineEstimates.ts assumptions) ---')
  const e = r.estimatesIncludingUi
  lines.push(`Scene RT color (RGBA8):     ${formatBytes(e.sceneColorBytes)}`)
  lines.push(`Scene RT depth (assumed):   ${formatBytes(e.sceneDepthBytes)}`)
  lines.push(`Composer ×2 color (RGBA16F): ${formatBytes(e.composerColorBytes)}`)
  lines.push(`Composer ×2 depth (assumed): ${formatBytes(e.composerDepthBytes)}`)
  lines.push(`UI CanvasTexture (RGBA8):   ${formatBytes(e.uiCanvasTextureBytes)}`)
  lines.push(`Total (scene+composer+UI):  ${formatBytes(e.totalBytes)}`)
  lines.push(`Total (scene+composer only): ${formatBytes(r.estimatesGpuOnly.totalBytes)}`)
  lines.push('')
  lines.push('--- 2) GPU timing: FramePresenter.render() (composite + dither) ---')
  if (r.gpu.error) {
    lines.push(`ERROR: ${r.gpu.error}`)
  } else {
    lines.push(`Drawing buffer: ${r.gpu.drawingBuffer.w}×${r.gpu.drawingBuffer.h} px`)
    lines.push(`Scene RT:       ${r.gpu.gameSceneRt.w}×${r.gpu.gameSceneRt.h} px`)
    lines.push(`Frames:         ${r.gpu.presenterFrames}`)
    lines.push(`Total:          ${r.gpu.totalMs.toFixed(2)} ms`)
    lines.push(`Per frame:      ${r.gpu.msPerFrame.toFixed(3)} ms`)
  }
  lines.push('')
  lines.push('--- 3) html2canvas (full stage, scale = capped DPR) ---')
  if (r.html2canvasBench.error) {
    lines.push(`ERROR: ${r.html2canvasBench.error}`)
  } else {
    lines.push(`Iterations: ${r.html2canvasBench.iterations}`)
    lines.push(`Times (ms): ${r.html2canvasBench.timesMs.map((x) => x.toFixed(1)).join(', ')}`)
    lines.push(`Mean: ${r.html2canvasBench.meanMs.toFixed(1)} ms  Min: ${r.html2canvasBench.minMs.toFixed(1)}  Max: ${r.html2canvasBench.maxMs.toFixed(1)}`)
    if (r.html2canvasBench.usedJsHeapBefore != null && r.html2canvasBench.usedJsHeapAfter != null) {
      const d = r.html2canvasBench.usedJsHeapAfter - r.html2canvasBench.usedJsHeapBefore
      lines.push(
        `performance.memory usedJSHeap (Chrome): before ${(r.html2canvasBench.usedJsHeapBefore / (1024 * 1024)).toFixed(1)} MiB → after ${(r.html2canvasBench.usedJsHeapAfter / (1024 * 1024)).toFixed(1)} MiB (Δ ${(d / (1024 * 1024)).toFixed(1)} MiB; GC noise)`,
      )
    }
  }
  lines.push('')
  lines.push('URL: /bench-pipeline.html  Query: ?cap=1.25&frames=96&h2c=3')
  return lines.join('\n')
}
