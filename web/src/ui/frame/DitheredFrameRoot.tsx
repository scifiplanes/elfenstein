import html2canvas from 'html2canvas'
import * as THREE from 'three'
import type { Dispatch } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ContentDB } from '../../game/content/contentDb'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import { HudLayout } from '../hud/HudLayout'
import styles from './DitheredFrameRoot.module.css'
import { FramePresenter } from '../../world/FramePresenter'
import { WorldRenderer } from '../../world/WorldRenderer'

export function DitheredFrameRoot(props: { state: GameState; dispatch: Dispatch<Action>; content: ContentDB }) {
  const { state, dispatch, content } = props

  const presentCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const interactiveHudRef = useRef<HTMLDivElement | null>(null)
  const captureWrapperRef = useRef<HTMLDivElement | null>(null)
  const captureHudRef = useRef<HTMLDivElement | null>(null)
  const gameViewportRef = useRef<HTMLDivElement | null>(null)
  const [layoutTick, setLayoutTick] = useState(0)
  const [sceneDebug, setSceneDebug] = useState<string>('')
  const sceneDebugRef = useRef<string>('')
  const [uiDebug, setUiDebug] = useState<string>('')
  const uiDebugRef = useRef<string>('')

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
    const gameRect = gameEl.getBoundingClientRect()
    if (gameRect.width < 1 || gameRect.height < 1) return false

    const qs = new URLSearchParams(window.location.search)
    const debugSceneMode = qs.get('debugScene') === '2' ? 2 : qs.get('debugScene') === '1' ? 1 : 0
    const debugSceneFlipY = qs.get('debugFlipY') === '0' ? false : true

    const presentEl = presentCanvasRef.current
    const pr = presentEl?.getBoundingClientRect()
    const w = Math.max(1, Math.floor(pr?.width ?? window.innerWidth))
    const h = Math.max(1, Math.floor(pr?.height ?? window.innerHeight))
    presenter.syncSize(w, h)
    presenter.syncDither(latestStateRef.current.render)
    presenter.setDebug({ sceneMode: debugSceneMode as 0 | 1 | 2, sceneFlipY: debugSceneFlipY })

    const now = performance.now()
    const inResizeBurst = now < renderBurstUntilMsRef.current

    if (world) {
      world.syncViewportRect(gameRect)
      world.renderFrame(latestStateRef.current)

      const sz = world.getRenderTargetSize()
      const center = sz ? world.readRenderTargetPixel(sz.w * 0.5, sz.h * 0.5) : null
      const sceneTexOk = !!world.getRenderTargetTexture()
      const s = `sceneTex=${sceneTexOk ? 'yes' : 'no'} rt=${sz ? `${sz.w}x${sz.h}` : 'null'} center=${center ? `${center[0]},${center[1]},${center[2]},${center[3]}` : 'null'}`
      if (s !== sceneDebugRef.current) {
        sceneDebugRef.current = s
        window.requestAnimationFrame(() => setSceneDebug(sceneDebugRef.current))
      }
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
    if (!inResizeBurst && captureEl && !captureInFlightRef.current && now - lastCaptureMsRef.current > 80) {
      captureInFlightRef.current = true
      void html2canvas(captureEl, {
        backgroundColor: null,
        logging: false,
        scale: Math.min(window.devicePixelRatio || 1, 1.5),
        width: w,
        height: h,
        windowWidth: w,
        windowHeight: h,
        useCORS: true,
      })
        .then((canvas) => {
          lastCaptureMsRef.current = performance.now()
          const capPortrait = captureEl.querySelector('[data-portrait-box="true"]') as HTMLElement | null
          const capPortraitRect = capPortrait?.getBoundingClientRect()
          const capP = capPortraitRect ? `${Math.round(capPortraitRect.width)}x${Math.round(capPortraitRect.height)}` : 'null'
          const dbg = `uiCanvas=${canvas.width}x${canvas.height} presentCss=${w}x${h} capPortraitCss=${capP}`
          if (dbg !== uiDebugRef.current) {
            uiDebugRef.current = dbg
            window.requestAnimationFrame(() => setUiDebug(uiDebugRef.current))
          }
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

    presenter.setInputs({
      sceneTex: world?.getRenderTargetTexture() ?? null,
      uiTex: uiTexRef.current,
      // Convert viewport rect into presenter-local CSS coords (canvas is the origin for gl_FragCoord mapping).
      gameRectPx: {
        left: gameRect.left - (pr?.left ?? 0),
        top: gameRect.top - (pr?.top ?? 0),
        width: gameRect.width,
        height: gameRect.height,
      },
    })
    presenter.render()
    return true
  }

  // Render on state changes (normal gameplay).
  useEffect(() => {
    renderOnce()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, layoutTick, state])

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
      {sceneDebug ? <div style={{ position: 'fixed', left: 12, top: webglError ? 52 : 12, padding: '8px 10px', borderRadius: 12, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.9)', fontFamily: 'var(--mono)', fontSize: 12, pointerEvents: 'none', zIndex: 10 }}>RT debug: {sceneDebug}</div> : null}
      {uiDebug ? <div style={{ position: 'fixed', left: 12, top: webglError ? 92 : 52, padding: '8px 10px', borderRadius: 12, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.9)', fontFamily: 'var(--mono)', fontSize: 12, pointerEvents: 'none', zIndex: 10 }}>UI debug: {uiDebug}</div> : null}

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
        />
      </div>

      <div className={styles.captureHud} ref={captureWrapperRef}>
        <HudLayout
          state={state}
          dispatch={noopDispatch}
          content={content}
          interactive={false}
          captureForPostprocess={true}
          world={null}
          rootRef={captureHudRef}
          webglError={null}
        />
      </div>
    </div>
  )
}

