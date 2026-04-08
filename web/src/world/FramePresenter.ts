import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import type { RenderTuning } from '../game/types'
import { CompositeShader } from './CompositeShader'
import { DitherShader } from './DitherShader'

type ShaderLike = {
  uniforms: Record<string, { value: unknown }>
  vertexShader: string
  fragmentShader: string
}

export class FramePresenter {
  private readonly renderer: THREE.WebGLRenderer
  private readonly composer: EffectComposer
  private readonly compositePass: ShaderPass
  private readonly ditherPass: ShaderPass
  private lastSize = { w: 0, h: 0 }
  private lastDpr = NaN
  private lastDrawingBuffer = { w: 0, h: 0 }
  private cssToBufferScale = { x: 1, y: 1 }

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setClearColor(new THREE.Color('#050508'), 1)

    this.compositePass = new ShaderPass(CompositeShader as unknown as ShaderLike)
    this.ditherPass = new ShaderPass(DitherShader as unknown as ShaderLike)
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(this.compositePass)
    this.composer.addPass(this.ditherPass)
  }

  dispose() {
    this.composer.dispose()
    this.renderer.dispose()
  }

  getRenderer(): THREE.WebGLRenderer {
    return this.renderer
  }

  syncSize(w: number, h: number) {
    // Browser zoom changes `devicePixelRatio`; compensate using `visualViewport.scale` so
    // compositor pixel math stays stable across zoom levels.
    const vvScale = window.visualViewport?.scale || 1
    const effectiveDpr = (window.devicePixelRatio || 1) / Math.max(1e-6, vvScale)
    const capped = Math.min(effectiveDpr, 1.5)
    if (w === this.lastSize.w && h === this.lastSize.h && capped === this.lastDpr) return
    this.lastSize = { w, h }
    this.lastDpr = capped
    this.renderer.setPixelRatio(capped)
    // Keep the canvas element's CSS size locked to the render size.
    // Otherwise the browser may stretch the drawing buffer to fit fractional CSS pixels during resize.
    this.renderer.setSize(w, h, true)
    // EffectComposer maintains its own internal render targets; it needs pixelRatio too.
    ;(this.composer as unknown as { setPixelRatio?: (dpr: number) => void }).setPixelRatio?.(capped)
    this.composer.setSize(w, h)

    // Use the renderer's actual drawing buffer size (rounding differs under zoom).
    const db = new THREE.Vector2()
    this.renderer.getDrawingBufferSize(db)
    this.lastDrawingBuffer = { w: Math.max(1, Math.floor(db.x)), h: Math.max(1, Math.floor(db.y)) }
    this.cssToBufferScale = {
      x: this.lastDrawingBuffer.w / Math.max(1, w),
      y: this.lastDrawingBuffer.h / Math.max(1, h),
    }

    const u = this.compositePass.uniforms as unknown as {
      resolution: { value: { x: number; y: number } }
    }
    // Store framebuffer pixel resolution (actual drawing buffer).
    u.resolution.value.x = this.lastDrawingBuffer.w
    u.resolution.value.y = this.lastDrawingBuffer.h
  }

  setInputs(args: { sceneTex: THREE.Texture | null; uiTex: THREE.Texture | null; gameRectPx: { left: number; top: number; width: number; height: number } }) {
    const u = this.compositePass.uniforms as unknown as {
      tScene: { value: THREE.Texture | null }
      tUi: { value: THREE.Texture | null }
      gameRectPx: { value: { x: number; y: number; z: number; w: number } }
      debugRect?: { value: number }
      debugSceneMode?: { value: number }
      debugSceneFlipY?: { value: number }
    }
    u.tScene.value = args.sceneTex
    u.tUi.value = args.uiTex
    // Convert CSS pixel rect into drawing-buffer pixels using actual X/Y scale.
    const sx = this.cssToBufferScale.x || 1
    const sy = this.cssToBufferScale.y || 1
    u.gameRectPx.value.x = args.gameRectPx.left * sx
    u.gameRectPx.value.y = args.gameRectPx.top * sy
    u.gameRectPx.value.z = Math.max(1, args.gameRectPx.width * sx)
    u.gameRectPx.value.w = Math.max(1, args.gameRectPx.height * sy)
  }

  setDebug(args: { sceneMode?: 0 | 1 | 2; sceneFlipY?: boolean }) {
    const u = this.compositePass.uniforms as unknown as {
      debugSceneMode?: { value: number }
      debugSceneFlipY?: { value: number }
    }
    if (u.debugSceneMode) u.debugSceneMode.value = args.sceneMode ?? 0
    if (u.debugSceneFlipY) u.debugSceneFlipY.value = args.sceneFlipY === false ? 0 : 1
  }

  setRectDebug(enabled: boolean) {
    const u = this.compositePass.uniforms as unknown as { debugRect?: { value: number } }
    if (u.debugRect) u.debugRect.value = enabled ? 1 : 0
  }

  syncDither(t: RenderTuning) {
    const u = this.ditherPass.uniforms as unknown as {
      strength: { value: number }
      colourPreserve: { value: number }
      pixelSize: { value: number }
      levels: { value: number }
      matrixSize: { value: number }
      palette: { value: number }
      palette0Mix: { value: number }
      postLevels: { value: number }
      postLift: { value: number }
      postGamma: { value: number }
    }
    u.strength.value = t.ditherStrength
    u.colourPreserve.value = t.ditherColourPreserve
    u.pixelSize.value = t.ditherPixelSize
    u.levels.value = t.ditherLevels
    u.matrixSize.value = t.ditherMatrixSize
    u.palette.value = t.ditherPalette
    u.palette0Mix.value = t.ditherPalette0Mix
    u.postLevels.value = t.postDitherLevels
    u.postLift.value = t.postDitherLift
    u.postGamma.value = t.postDitherGamma
  }

  render() {
    this.composer.render()
  }
}

