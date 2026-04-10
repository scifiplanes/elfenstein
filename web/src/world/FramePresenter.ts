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

  syncSize(w: number, h: number, pixelRatioCap: number) {
    // Browser zoom changes `devicePixelRatio`; compensate using `visualViewport.scale` so
    // compositor pixel math stays stable across zoom levels.
    const vvScale = window.visualViewport?.scale || 1
    const effectiveDpr = (window.devicePixelRatio || 1) / Math.max(1e-6, vvScale)
    const cap = Math.max(1, Math.min(1.5, pixelRatioCap))
    const capped = Math.min(effectiveDpr, cap)
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

  setInputs(args: {
    sceneTex: THREE.Texture | null
    uiTex: THREE.Texture | null
    gameRectPx: { left: number; top: number; width: number; height: number }
    telegraphStrength?: number
    telegraphColor?: { r: number; g: number; b: number }
    /** 0 = multiply, 1 = luma-preserving tint override */
    telegraphTintMode?: 0 | 1
    /** Tint mode: scales graded rgb (same hue); default 1 */
    telegraphTintPulse?: number
    portraitRectsPx?: Array<{ left: number; top: number; width: number; height: number }>
    portraitMouthTex?: Array<THREE.Texture | null>
    portraitIdleTex?: Array<THREE.Texture | null>
    portraitMouthOn?: Array<number>
    portraitIdleOn?: Array<number>
    portraitEyesInspectTex?: Array<THREE.Texture | null>
    portraitEyesInspectOn?: Array<number>
    portraitMouthAr?: Array<number>
    portraitIdleAr?: Array<number>
    portraitEyesInspectAr?: Array<number>
    portraitArtNudgeYCssPx?: number
    portraitStatsRectsPx?: Array<{ left: number; top: number; width: number; height: number }>
    navButtonRectsPx?: Array<{ left: number; top: number; width: number; height: number }>
    navPushedOn?: Array<number>
    navPushedTex?: THREE.Texture | null
  }) {
    const u = this.compositePass.uniforms as unknown as {
      tScene: { value: THREE.Texture | null }
      tUi: { value: THREE.Texture | null }
      gameRectPx: { value: { x: number; y: number; z: number; w: number } }
      telegraphStrength?: { value: number }
      telegraphColor?: { value: { x: number; y: number; z: number } }
      telegraphTintMode?: { value: number }
      telegraphTintPulse?: { value: number }
      portraitRectPx0?: { value: { x: number; y: number; z: number; w: number } }
      portraitRectPx1?: { value: { x: number; y: number; z: number; w: number } }
      portraitRectPx2?: { value: { x: number; y: number; z: number; w: number } }
      portraitRectPx3?: { value: { x: number; y: number; z: number; w: number } }
      mouthOn?: { value: { x: number; y: number; z: number; w: number } }
      idleOn?: { value: { x: number; y: number; z: number; w: number } }
      eyesInspectOn?: { value: { x: number; y: number; z: number; w: number } }
      tPortraitMouth0?: { value: THREE.Texture | null }
      tPortraitMouth1?: { value: THREE.Texture | null }
      tPortraitMouth2?: { value: THREE.Texture | null }
      tPortraitMouth3?: { value: THREE.Texture | null }
      tPortraitEyesInspect0?: { value: THREE.Texture | null }
      tPortraitEyesInspect1?: { value: THREE.Texture | null }
      tPortraitEyesInspect2?: { value: THREE.Texture | null }
      tPortraitEyesInspect3?: { value: THREE.Texture | null }
      tPortraitIdle0?: { value: THREE.Texture | null }
      tPortraitIdle1?: { value: THREE.Texture | null }
      tPortraitIdle2?: { value: THREE.Texture | null }
      tPortraitIdle3?: { value: THREE.Texture | null }
      mouthAr?: { value: { x: number; y: number; z: number; w: number } }
      idleAr?: { value: { x: number; y: number; z: number; w: number } }
      eyesInspectAr?: { value: { x: number; y: number; z: number; w: number } }
      portraitArtNudgeYPx?: { value: number }
      portraitStatsRectPx0?: { value: { x: number; y: number; z: number; w: number } }
      portraitStatsRectPx1?: { value: { x: number; y: number; z: number; w: number } }
      portraitStatsRectPx2?: { value: { x: number; y: number; z: number; w: number } }
      portraitStatsRectPx3?: { value: { x: number; y: number; z: number; w: number } }
      navRectPx0?: { value: { x: number; y: number; z: number; w: number } }
      navRectPx1?: { value: { x: number; y: number; z: number; w: number } }
      navRectPx2?: { value: { x: number; y: number; z: number; w: number } }
      navRectPx3?: { value: { x: number; y: number; z: number; w: number } }
      navRectPx4?: { value: { x: number; y: number; z: number; w: number } }
      navRectPx5?: { value: { x: number; y: number; z: number; w: number } }
      navPushedOn01?: { value: { x: number; y: number; z: number; w: number } }
      navPushedOn45?: { value: { x: number; y: number } }
      tNavPushed?: { value: THREE.Texture | null }
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

    if (u.telegraphStrength) u.telegraphStrength.value = Number(args.telegraphStrength ?? 0)
    if (u.telegraphColor) {
      const c = args.telegraphColor
      u.telegraphColor.value.x = Number(c?.r ?? 1)
      u.telegraphColor.value.y = Number(c?.g ?? 1)
      u.telegraphColor.value.z = Number(c?.b ?? 1)
    }
    if (u.telegraphTintMode) u.telegraphTintMode.value = args.telegraphTintMode === 1 ? 1 : 0
    if (u.telegraphTintPulse) u.telegraphTintPulse.value = Number(args.telegraphTintPulse ?? 1)

    // Portrait reaction overlay uniforms (optional).
    const rects = args.portraitRectsPx ?? []
    const r0 = rects[0]
    const r1 = rects[1]
    const r2 = rects[2]
    const r3 = rects[3]
    if (u.portraitRectPx0) {
      u.portraitRectPx0.value.x = (r0?.left ?? 0) * sx
      u.portraitRectPx0.value.y = (r0?.top ?? 0) * sy
      u.portraitRectPx0.value.z = Math.max(0, (r0?.width ?? 0) * sx)
      u.portraitRectPx0.value.w = Math.max(0, (r0?.height ?? 0) * sy)
    }
    if (u.portraitRectPx1) {
      u.portraitRectPx1.value.x = (r1?.left ?? 0) * sx
      u.portraitRectPx1.value.y = (r1?.top ?? 0) * sy
      u.portraitRectPx1.value.z = Math.max(0, (r1?.width ?? 0) * sx)
      u.portraitRectPx1.value.w = Math.max(0, (r1?.height ?? 0) * sy)
    }
    if (u.portraitRectPx2) {
      u.portraitRectPx2.value.x = (r2?.left ?? 0) * sx
      u.portraitRectPx2.value.y = (r2?.top ?? 0) * sy
      u.portraitRectPx2.value.z = Math.max(0, (r2?.width ?? 0) * sx)
      u.portraitRectPx2.value.w = Math.max(0, (r2?.height ?? 0) * sy)
    }
    if (u.portraitRectPx3) {
      u.portraitRectPx3.value.x = (r3?.left ?? 0) * sx
      u.portraitRectPx3.value.y = (r3?.top ?? 0) * sy
      u.portraitRectPx3.value.z = Math.max(0, (r3?.width ?? 0) * sx)
      u.portraitRectPx3.value.w = Math.max(0, (r3?.height ?? 0) * sy)
    }

    const statsRects = args.portraitStatsRectsPx ?? []
    const s0 = statsRects[0]
    const s1 = statsRects[1]
    const s2 = statsRects[2]
    const s3 = statsRects[3]
    if (u.portraitStatsRectPx0) {
      u.portraitStatsRectPx0.value.x = (s0?.left ?? 0) * sx
      u.portraitStatsRectPx0.value.y = (s0?.top ?? 0) * sy
      u.portraitStatsRectPx0.value.z = Math.max(0, (s0?.width ?? 0) * sx)
      u.portraitStatsRectPx0.value.w = Math.max(0, (s0?.height ?? 0) * sy)
    }
    if (u.portraitStatsRectPx1) {
      u.portraitStatsRectPx1.value.x = (s1?.left ?? 0) * sx
      u.portraitStatsRectPx1.value.y = (s1?.top ?? 0) * sy
      u.portraitStatsRectPx1.value.z = Math.max(0, (s1?.width ?? 0) * sx)
      u.portraitStatsRectPx1.value.w = Math.max(0, (s1?.height ?? 0) * sy)
    }
    if (u.portraitStatsRectPx2) {
      u.portraitStatsRectPx2.value.x = (s2?.left ?? 0) * sx
      u.portraitStatsRectPx2.value.y = (s2?.top ?? 0) * sy
      u.portraitStatsRectPx2.value.z = Math.max(0, (s2?.width ?? 0) * sx)
      u.portraitStatsRectPx2.value.w = Math.max(0, (s2?.height ?? 0) * sy)
    }
    if (u.portraitStatsRectPx3) {
      u.portraitStatsRectPx3.value.x = (s3?.left ?? 0) * sx
      u.portraitStatsRectPx3.value.y = (s3?.top ?? 0) * sy
      u.portraitStatsRectPx3.value.z = Math.max(0, (s3?.width ?? 0) * sx)
      u.portraitStatsRectPx3.value.w = Math.max(0, (s3?.height ?? 0) * sy)
    }

    const mouthTex = args.portraitMouthTex ?? []
    const idleTex = args.portraitIdleTex ?? []
    const eyesTex = args.portraitEyesInspectTex ?? []
    if (u.tPortraitMouth0) u.tPortraitMouth0.value = mouthTex[0] ?? null
    if (u.tPortraitMouth1) u.tPortraitMouth1.value = mouthTex[1] ?? null
    if (u.tPortraitMouth2) u.tPortraitMouth2.value = mouthTex[2] ?? null
    if (u.tPortraitMouth3) u.tPortraitMouth3.value = mouthTex[3] ?? null
    if (u.tPortraitEyesInspect0) u.tPortraitEyesInspect0.value = eyesTex[0] ?? null
    if (u.tPortraitEyesInspect1) u.tPortraitEyesInspect1.value = eyesTex[1] ?? null
    if (u.tPortraitEyesInspect2) u.tPortraitEyesInspect2.value = eyesTex[2] ?? null
    if (u.tPortraitEyesInspect3) u.tPortraitEyesInspect3.value = eyesTex[3] ?? null
    if (u.tPortraitIdle0) u.tPortraitIdle0.value = idleTex[0] ?? null
    if (u.tPortraitIdle1) u.tPortraitIdle1.value = idleTex[1] ?? null
    if (u.tPortraitIdle2) u.tPortraitIdle2.value = idleTex[2] ?? null
    if (u.tPortraitIdle3) u.tPortraitIdle3.value = idleTex[3] ?? null

    const mouthOn = args.portraitMouthOn ?? []
    const idleOn = args.portraitIdleOn ?? []
    const eyesOn = args.portraitEyesInspectOn ?? []
    if (u.mouthOn) {
      u.mouthOn.value.x = mouthOn[0] ?? 0
      u.mouthOn.value.y = mouthOn[1] ?? 0
      u.mouthOn.value.z = mouthOn[2] ?? 0
      u.mouthOn.value.w = mouthOn[3] ?? 0
    }
    if (u.idleOn) {
      u.idleOn.value.x = idleOn[0] ?? 0
      u.idleOn.value.y = idleOn[1] ?? 0
      u.idleOn.value.z = idleOn[2] ?? 0
      u.idleOn.value.w = idleOn[3] ?? 0
    }
    if (u.eyesInspectOn) {
      u.eyesInspectOn.value.x = eyesOn[0] ?? 0
      u.eyesInspectOn.value.y = eyesOn[1] ?? 0
      u.eyesInspectOn.value.z = eyesOn[2] ?? 0
      u.eyesInspectOn.value.w = eyesOn[3] ?? 0
    }

    const mouthAr = args.portraitMouthAr ?? []
    const idleAr = args.portraitIdleAr ?? []
    const eyesAr = args.portraitEyesInspectAr ?? []
    if (u.mouthAr) {
      u.mouthAr.value.x = mouthAr[0] ?? 1
      u.mouthAr.value.y = mouthAr[1] ?? 1
      u.mouthAr.value.z = mouthAr[2] ?? 1
      u.mouthAr.value.w = mouthAr[3] ?? 1
    }
    if (u.idleAr) {
      u.idleAr.value.x = idleAr[0] ?? 1
      u.idleAr.value.y = idleAr[1] ?? 1
      u.idleAr.value.z = idleAr[2] ?? 1
      u.idleAr.value.w = idleAr[3] ?? 1
    }
    if (u.eyesInspectAr) {
      u.eyesInspectAr.value.x = eyesAr[0] ?? 1
      u.eyesInspectAr.value.y = eyesAr[1] ?? 1
      u.eyesInspectAr.value.z = eyesAr[2] ?? 1
      u.eyesInspectAr.value.w = eyesAr[3] ?? 1
    }
    if (u.portraitArtNudgeYPx) {
      u.portraitArtNudgeYPx.value = Number(args.portraitArtNudgeYCssPx ?? 0) * sy
    }

    // Navigation pushed overlay (optional).
    const navRects = args.navButtonRectsPx ?? []
    const n0 = navRects[0]
    const n1 = navRects[1]
    const n2 = navRects[2]
    const n3 = navRects[3]
    const n4 = navRects[4]
    const n5 = navRects[5]
    const setRect = (dst: { value: { x: number; y: number; z: number; w: number } } | undefined, r: any) => {
      if (!dst) return
      dst.value.x = (r?.left ?? 0) * sx
      dst.value.y = (r?.top ?? 0) * sy
      dst.value.z = Math.max(0, (r?.width ?? 0) * sx)
      dst.value.w = Math.max(0, (r?.height ?? 0) * sy)
    }
    setRect(u.navRectPx0, n0)
    setRect(u.navRectPx1, n1)
    setRect(u.navRectPx2, n2)
    setRect(u.navRectPx3, n3)
    setRect(u.navRectPx4, n4)
    setRect(u.navRectPx5, n5)
    const navOn = args.navPushedOn ?? []
    if (u.navPushedOn01) {
      u.navPushedOn01.value.x = navOn[0] ?? 0
      u.navPushedOn01.value.y = navOn[1] ?? 0
      u.navPushedOn01.value.z = navOn[2] ?? 0
      u.navPushedOn01.value.w = navOn[3] ?? 0
    }
    if (u.navPushedOn45) {
      u.navPushedOn45.value.x = navOn[4] ?? 0
      u.navPushedOn45.value.y = navOn[5] ?? 0
    }
    if (u.tNavPushed) u.tNavPushed.value = args.navPushedTex ?? null
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

