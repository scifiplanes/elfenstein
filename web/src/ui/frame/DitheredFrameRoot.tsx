import html2canvas from 'html2canvas'
import * as THREE from 'three'
import type { Dispatch } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ContentDB } from '../../game/content/contentDb'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import { HudLayout } from '../hud/HudLayout'
import type { NavPadButtonId } from '../nav/NavigationPanel'
import styles from './DitheredFrameRoot.module.css'
import { useFixedStageOuterScale } from '../../app/FixedStageContext'
import { STAGE_CSS_HEIGHT, STAGE_CSS_WIDTH } from '../../app/stageDesign'
import { FramePresenter } from '../../world/FramePresenter'
import { WorldRenderer } from '../../world/WorldRenderer'

export function DitheredFrameRoot(props: { state: GameState; dispatch: Dispatch<Action>; content: ContentDB }) {
  const { state, dispatch, content } = props

  const fixedStageOuterScale = useFixedStageOuterScale()
  const fixedStageOuterScaleRef = useRef(1)
  fixedStageOuterScaleRef.current = fixedStageOuterScale

  const presentCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const interactiveHudRef = useRef<HTMLDivElement | null>(null)
  const captureWrapperRef = useRef<HTMLDivElement | null>(null)
  const captureHudRef = useRef<HTMLDivElement | null>(null)
  const gameViewportRef = useRef<HTMLDivElement | null>(null)
  const [layoutTick, setLayoutTick] = useState(0)

  const [captureMountEl, setCaptureMountEl] = useState<HTMLElement | null>(null)

  const [world, setWorld] = useState<WorldRenderer | null>(null)
  const [webglError, setWebglError] = useState<string | null>(null)

  const presenterRef = useRef<FramePresenter | null>(null)
  const uiTexRef = useRef<THREE.CanvasTexture | null>(null)
  const lastCaptureMsRef = useRef(0)
  const captureInFlightRef = useRef(false)
  const lastUiCaptureSizeRef = useRef<{ w: number; h: number } | null>(null)
  const observedElRef = useRef<Element | null>(null)
  const latestStateRef = useRef<GameState>(state)
  const latestContentRef = useRef(content)
  const renderBurstUntilMsRef = useRef(0)
  const prevHighFpsUiRef = useRef(false)
  const lastUiCaptureScaleRef = useRef<number | null>(null)

  const [navPadPressedId, setNavPadPressedId] = useState<NavPadButtonId | null>(null)
  const navPadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onNavPadVisualPress = useCallback((id: NavPadButtonId) => {
    setNavPadPressedId(id)
    if (navPadTimerRef.current) clearTimeout(navPadTimerRef.current)
    navPadTimerRef.current = setTimeout(() => {
      setNavPadPressedId(null)
      navPadTimerRef.current = null
    }, 500)
  }, [])

  useEffect(() => {
    return () => {
      if (navPadTimerRef.current) clearTimeout(navPadTimerRef.current)
    }
  }, [])

  useEffect(() => {
    latestStateRef.current = state
    latestContentRef.current = content
  }, [state, content])

  useEffect(() => {
    let raf = 0
    let ro: ResizeObserver | null = null

    const tryObserve = () => {
      if (!ro) return
      const el = gameViewportRef.current
      if (!el) return
      if (observedElRef.current === el) return
      if (observedElRef.current) ro.unobserve(observedElRef.current)
      ro.observe(el)
      observedElRef.current = el
    }

    const bump = () => {
      tryObserve()
      renderBurstUntilMsRef.current = performance.now() + 250
      if (raf) return
      raf = window.requestAnimationFrame(() => {
        raf = 0
        setLayoutTick((x) => x + 1)
      })
    }

    window.addEventListener('resize', bump)
    window.visualViewport?.addEventListener('resize', bump)
    window.visualViewport?.addEventListener('scroll', bump)

    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => bump())
      tryObserve()
    }

    return () => {
      window.removeEventListener('resize', bump)
      window.visualViewport?.removeEventListener('resize', bump)
      window.visualViewport?.removeEventListener('scroll', bump)
      ro?.disconnect()
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    // Capture HUD must not live under a transformed ancestor; portal it to <body>
    // so html2canvas rasterizes stable stage coordinates regardless of stage scaling.
    setCaptureMountEl(document.body)
  }, [])

  useEffect(() => {
    if (!presentCanvasRef.current) return
    let w: WorldRenderer | null = null
    try {
      const p = new FramePresenter(presentCanvasRef.current)
      presenterRef.current = p
      w = new WorldRenderer(p.getRenderer())
      setWorld(w)
      setWebglError(null)
    } catch {
      setWorld(null)
      setWebglError('WebGL init failed. Your browser/GPU may be blocking WebGL.')
    }
    return () => {
      w?.dispose()
      presenterRef.current?.dispose()
      presenterRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      uiTexRef.current?.dispose()
      uiTexRef.current = null
    }
  }, [])

  const renderOnce = () => {
    const presenter = presenterRef.current
    if (!presenter) return false

    const gameEl = gameViewportRef.current
    if (!gameEl) return false
    const gameCssW = gameEl.clientWidth
    const gameCssH = gameEl.clientHeight
    if (gameCssW < 1 || gameCssH < 1) return false

    const outerS = Math.max(1e-6, fixedStageOuterScaleRef.current)

    const qs = new URLSearchParams(window.location.search)
    const debugSceneMode = qs.get('debugScene') === '2' ? 2 : qs.get('debugScene') === '1' ? 1 : 0
    const debugSceneFlipY = qs.get('debugFlipY') === '0' ? false : true
    const debugRect = qs.get('debugRect') === '1'

    const presentEl = presentCanvasRef.current
    const pr = presentEl?.getBoundingClientRect()
    // Match `FixedStageViewport` / HUD layout (CSS px). Do not use the browser viewport here:
    // `syncSize` sets canvas CSS pixels; window-sized values overflow the 1920×1080 stage and look "zoomed".
    const w = STAGE_CSS_WIDTH
    const h = STAGE_CSS_HEIGHT
    presenter.syncSize(w, h)
    presenter.syncDither(latestStateRef.current.render)
    presenter.setDebug({ sceneMode: debugSceneMode as 0 | 1 | 2, sceneFlipY: debugSceneFlipY })
    presenter.setRectDebug(debugRect)

    const now = performance.now()
    const inResizeBurst = now < renderBurstUntilMsRef.current

    if (world) {
      world.syncViewportRect(gameCssW, gameCssH)
      world.renderFrame(latestStateRef.current)
    }

    // If the presenter size changed, the last UI capture is the wrong resolution and will smear.
    // Drop the UI texture so we don't “ghost” stale captures during resize.
    const prevCap = lastUiCaptureSizeRef.current
    if (!prevCap || prevCap.w !== w || prevCap.h !== h) {
      lastUiCaptureSizeRef.current = { w, h }
      if (uiTexRef.current) {
        uiTexRef.current.dispose()
        uiTexRef.current = null
      }
      lastUiCaptureScaleRef.current = null
      // Force a fresh capture once the resize burst settles.
      lastCaptureMsRef.current = 0
    }

    const captureEl = captureHudRef.current
    const wrap = captureWrapperRef.current
    if (wrap) {
      // Force capture layout to match presenter CSS size exactly.
      wrap.style.width = `${w}px`
      wrap.style.height = `${h}px`
    }
    const ui = latestStateRef.current.ui
    const anyShakeActive =
      (!!ui.shake && ui.shake.untilMs > latestStateRef.current.nowMs) || (!!ui.portraitShake && ui.portraitShake.untilMs > latestStateRef.current.nowMs)
    const anyMouthActive = !!ui.portraitMouth && ui.portraitMouth.untilMs > latestStateRef.current.nowMs
    const highFpsUi = anyShakeActive || anyMouthActive

    // When a high-FPS UI moment begins (e.g. portrait mouth flicker), force the next capture ASAP
    // so the burst doesn't "start late" waiting for a stale interval gate.
    if (highFpsUi && !prevHighFpsUiRef.current) {
      lastCaptureMsRef.current = 0
    }
    prevHighFpsUiRef.current = highFpsUi

    // For “animated UI” moments, capture again immediately when the previous capture finishes.
    // (html2canvas is async and we already gate with `captureInFlightRef`.)
    const captureIntervalMs = highFpsUi ? 0 : 80

    if (!inResizeBurst && captureEl && !captureInFlightRef.current && now - lastCaptureMsRef.current > captureIntervalMs) {
      captureInFlightRef.current = true
      // Keep capture scale stable to prevent transient full-screen resampling artifacts
      // when the UI texture resolution changes mid-frame.
      const vvScale = window.visualViewport?.scale || 1
      const effectiveDpr = (window.devicePixelRatio || 1) / Math.max(1e-6, vvScale)
      const captureScale = Math.min(effectiveDpr, 1.5)
      const prevScale = lastUiCaptureScaleRef.current
      if (prevScale == null || Math.abs(prevScale - captureScale) > 1e-6) {
        lastUiCaptureScaleRef.current = captureScale
        if (uiTexRef.current) {
          uiTexRef.current.dispose()
          uiTexRef.current = null
        }
      }
      void html2canvas(captureEl, {
        backgroundColor: null,
        logging: false,
        scale: captureScale,
        width: w,
        height: h,
        windowWidth: w,
        windowHeight: h,
        onclone: (doc) => {
          // The capture HUD is rendered offscreen in the real document.
          // In the cloned document used by html2canvas, snap it to (0,0) so the
          // rasterized UI texture matches the 1920×1080 stage coordinate system.
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
          // Ensure no default margins shift the cloned layout.
          doc.documentElement.style.margin = '0'
          doc.body.style.margin = '0'
        },
        useCORS: true,
      })
        .then((canvas) => {
          lastCaptureMsRef.current = performance.now()
          if (!uiTexRef.current) {
            const tex = new THREE.CanvasTexture(canvas)
            tex.colorSpace = THREE.SRGBColorSpace
            tex.minFilter = THREE.LinearFilter
            tex.magFilter = THREE.LinearFilter
            tex.generateMipmaps = false
            uiTexRef.current = tex
          } else {
            uiTexRef.current.image = canvas
            uiTexRef.current.needsUpdate = true
          }
        })
        .catch(() => {
          // Ignore capture failures; keep the last good UI frame.
        })
        .finally(() => {
          captureInFlightRef.current = false
        })
    }

    const gr = gameEl.getBoundingClientRect()
    // Use the interactive HUD root as the coordinate origin for the game viewport rect.
    // This keeps the scene placement stable even if the presenter canvas and HUD end up
    // with slightly different screen-space bounding rects under stage scaling/letterboxing.
    const hr = interactiveHudRef.current?.getBoundingClientRect() ?? pr
    presenter.setInputs({
      sceneTex: world?.getRenderTargetTexture() ?? null,
      uiTex: uiTexRef.current,
      // `getBoundingClientRect` includes `FixedStageViewport` scale; compositor uniforms expect **layout** CSS px (1920×1080 stage).
      gameRectPx: {
        left: (gr.left - (hr?.left ?? 0)) / outerS,
        top: (gr.top - (hr?.top ?? 0)) / outerS,
        width: gr.width / outerS,
        height: gr.height / outerS,
      },
    })
    presenter.render()
    return true
  }

  // Render on state changes (normal gameplay).
  useEffect(() => {
    renderOnce()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, layoutTick, state, navPadPressedId])

  // During resize, the browser can stretch stale frames; keep redrawing for a short burst.
  useEffect(() => {
    let raf = 0
    let stopped = false
    const loop = () => {
      if (stopped) return
      const now = performance.now()
      const active = now < renderBurstUntilMsRef.current
      if (active) renderOnce()
      raf = window.requestAnimationFrame(loop)
    }
    raf = window.requestAnimationFrame(loop)
    return () => {
      stopped = true
      if (raf) window.cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world])

  const noopDispatch = useMemo(() => (() => {}) as Dispatch<Action>, [])

  return (
    <div className={styles.root}>
      <canvas className={styles.presentCanvas} ref={presentCanvasRef} />

      {webglError ? <div style={{ position: 'fixed', left: 12, top: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(120,20,20,0.75)', border: '1px solid rgba(255,255,255,0.16)', color: 'rgba(255,255,255,0.92)', fontFamily: 'var(--mono)', fontSize: 12, pointerEvents: 'none', zIndex: 10 }}>3D renderer error: {webglError}</div> : null}

      <div className={styles.interactiveHud}>
        <HudLayout
          state={state}
          dispatch={dispatch}
          content={content}
          interactive={true}
          captureForPostprocess={false}
          world={world}
          rootRef={interactiveHudRef}
          gameViewportRef={gameViewportRef}
          webglError={webglError}
          navPadPressedId={navPadPressedId}
          onNavPadVisualPress={onNavPadVisualPress}
        />
      </div>

      {captureMountEl
        ? createPortal(
            <div
              className={styles.captureHud}
              ref={captureWrapperRef}
              data-capture-wrap="true"
              style={{ width: STAGE_CSS_WIDTH, height: STAGE_CSS_HEIGHT }}
            >
              <div data-capture-root="true" style={{ width: '100%', height: '100%' }}>
                <HudLayout
                  state={state}
                  dispatch={noopDispatch}
                  content={content}
                  interactive={false}
                  captureForPostprocess={true}
                  world={null}
                  rootRef={captureHudRef}
                  webglError={null}
                  navPadPressedId={navPadPressedId}
                  onNavPadVisualPress={onNavPadVisualPress}
                />
              </div>
            </div>,
            captureMountEl,
          )
        : null}
    </div>
  )
}

