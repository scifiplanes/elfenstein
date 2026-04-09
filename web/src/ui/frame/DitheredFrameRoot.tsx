import html2canvas from 'html2canvas'
import * as THREE from 'three'
import type { Dispatch } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ContentDB } from '../../game/content/contentDb'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import { HudLayout } from '../hud/HudLayout'
import { PaperdollModal } from '../paperdoll/PaperdollModal'
import { NpcDialogModal } from '../npc/NpcDialogModal'
import { DeathModal } from '../death/DeathModal'
import { TavernTradeModal } from '../hub/TavernTradeModal'
import { TitleScreen } from '../title/TitleScreen'
import type { NavPadButtonId } from '../nav/NavigationPanel'
import styles from './DitheredFrameRoot.module.css'
import { useFixedStageOuterScale } from '../../app/FixedStageContext'
import { STAGE_CSS_HEIGHT, STAGE_CSS_WIDTH } from '../../app/stageDesign'
import { FramePresenter } from '../../world/FramePresenter'
import { WorldRenderer } from '../../world/WorldRenderer'
import { useCursor } from '../cursor/useCursor'
import { getPressedPortraitCharacterId } from '../cursor/getPressedPortraitCharacterId'
import { roomPropertyUnderPlayer } from '../../game/state/roomTelemetry'

type SpeciesId = GameState['party']['chars'][number]['species']
const NAV_PUSHED_SRC = '/content/ui/navigation/ui_navigationbutton_pushed.png'

function portraitOverlayUrlsForSpecies(
  species: SpeciesId,
): { mouthSrc: string; mouthClosedSrc?: string; idleSrc: string; eyesInspectSrc: string } | null {
  // Keep in sync with `ui/portraits/PortraitPanel.tsx` until portrait assets are centralized.
  if (species === 'Igor')
    return {
      mouthSrc: '/content/boblin_mouth_open.png',
      idleSrc: '/content/boblin_idle.png',
      eyesInspectSrc: '/content/boblin_eyes_inspect.png',
    }
  if (species === 'Mycyclops')
    return {
      mouthSrc: '/content/myclops_mouth_open.png',
      idleSrc: '/content/myclops_idle.png',
      eyesInspectSrc: '/content/myclops_eyes_inspect.png',
    }
  if (species === 'Frosch')
    return {
      mouthSrc: '/content/frosh_mouth_open.png',
      idleSrc: '/content/frosh_idle.png',
      eyesInspectSrc: '/content/frosh_eye_inspect.png',
    }
  if (species === 'Afonso')
    return {
      mouthSrc: '/content/Afonso_mouth_open.png',
      mouthClosedSrc: '/content/Afonso_mouth_closed.png',
      idleSrc: '/content/Afonso_base_idle.png',
      eyesInspectSrc: '/content/Afonso_eyes_inspect.png',
    }
  return null
}

function computePortraitMouthOn(args: {
  nowMs: number
  cue: GameState['ui']['portraitMouth'] | undefined
  characterId: string
  hz: number
  amount: number
}): number {
  const { nowMs, cue, characterId } = args
  if (!cue || cue.characterId !== characterId || cue.untilMs <= nowMs) return 0

  const hz = Math.max(0, Number(args.hz ?? 0))
  const amount = Math.max(0, Math.round(Number(args.amount ?? 0)))
  const steps = amount * 2
  const flickerEnabled = hz > 0 && steps > 0
  if (!flickerEnabled) return 1

  const startedAtMs = cue.startedAtMs ?? nowMs
  const totalMs = Math.max(1, cue.untilMs - startedAtMs)
  const elapsedMs = Math.max(0, nowMs - startedAtMs)
  const t = Math.max(0, Math.min(0.999999, elapsedMs / totalMs))
  const tick = Math.floor(t * steps)
  return tick % 2 === 0 ? 1 : 0
}

export function DitheredFrameRoot(props: { state: GameState; dispatch: Dispatch<Action>; content: ContentDB }) {
  const { state, dispatch, content } = props

  const fixedStageOuterScale = useFixedStageOuterScale()
  const fixedStageOuterScaleRef = useRef(1)
  fixedStageOuterScaleRef.current = fixedStageOuterScale

  const presentCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const interactiveHudRef = useRef<HTMLDivElement | null>(null)
  const captureWrapperRef = useRef<HTMLDivElement | null>(null)
  const captureRootRef = useRef<HTMLDivElement | null>(null)
  const captureHudRef = useRef<HTMLDivElement | null>(null)
  const captureGameViewportRef = useRef<HTMLDivElement | null>(null)
  const gameViewportRef = useRef<HTMLDivElement | null>(null)
  const [layoutTick, setLayoutTick] = useState(0)

  const [captureMountEl, setCaptureMountEl] = useState<HTMLElement | null>(null)

  const [world, setWorld] = useState<WorldRenderer | null>(null)
  const [webglError, setWebglError] = useState<string | null>(null)

  const presenterRef = useRef<FramePresenter | null>(null)
  const uiTexRef = useRef<THREE.CanvasTexture | null>(null)
  const portraitTexCacheRef = useRef<Map<string, THREE.Texture>>(new Map())
  const portraitArCacheRef = useRef<Map<string, number>>(new Map())
  const textureLoaderRef = useRef<THREE.TextureLoader | null>(null)
  const navPushedTexRef = useRef<THREE.Texture | null>(null)
  const lastCaptureMsRef = useRef(0)
  const captureInFlightRef = useRef(false)
  const lastUiCaptureSizeRef = useRef<{ w: number; h: number } | null>(null)
  const observedElRef = useRef<Element | null>(null)
  const latestStateRef = useRef<GameState>(state)
  const latestContentRef = useRef(content)
  const renderBurstUntilMsRef = useRef(0)
  const prevHighFpsUiRef = useRef(false)
  const prevPoseKeyRef = useRef<string>('')
  const lastUiCaptureScaleRef = useRef<number | null>(null)
  const lastUiCaptureDurMsRef = useRef<number | null>(null)
  const perfEmaRef = useRef<{ frameMs: number; worldMs: number; presentMs: number }>({ frameMs: 0, worldMs: 0, presentMs: 0 })
  const captureIdleHandleRef = useRef<number | null>(null)
  const captureScheduledRef = useRef(false)
  const lastHudKeyRef = useRef<string>('')
  const pendingHudKeyRef = useRef<string>('')

  const [navPadPressedId, setNavPadPressedId] = useState<NavPadButtonId | null>(null)
  const navPadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cursor = useCursor()
  const pointerDownStartedAtMsRef = useRef<number | null>(null)
  const prevPointerDownRef = useRef(false)

  const onNavPadVisualPress = useCallback((id: NavPadButtonId) => {
    setNavPadPressedId(id)
    if (navPadTimerRef.current) clearTimeout(navPadTimerRef.current)
    navPadTimerRef.current = setTimeout(() => {
      setNavPadPressedId(null)
      navPadTimerRef.current = null
    }, 140)
  }, [])

  useEffect(() => {
    // No-op. (F2 cell readout uses click-to-inspect, not hover tracking.)
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
    void state.ui.npcDialogFor
    lastCaptureMsRef.current = 0
  }, [state.ui.npcDialogFor])

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
      textureLoaderRef.current = new THREE.TextureLoader()
      // Preload portrait overlay textures (idle/inspect/mouth) so the first press
      // doesn't wait for async decode/load before compositor-time overlays can render.
      {
        const loader = textureLoaderRef.current
        const cache = portraitTexCacheRef.current
        const arCache = portraitArCacheRef.current
        const preload = (src: string) => {
          if (!src) return
          if (cache.get(src)) return
          const tex = loader.load(src, () => {
            const img = tex.image as unknown as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number } | undefined
            const w = Number(img?.naturalWidth ?? img?.width ?? 0)
            const h = Number(img?.naturalHeight ?? img?.height ?? 0)
            if (w > 0 && h > 0) arCache.set(src, w / h)
          })
          tex.colorSpace = THREE.SRGBColorSpace
          tex.minFilter = THREE.LinearFilter
          tex.magFilter = THREE.LinearFilter
          tex.generateMipmaps = false
          cache.set(src, tex)
        }
        const species: SpeciesId[] = ['Igor', 'Mycyclops', 'Frosch', 'Afonso']
        for (const s of species) {
          const urls = portraitOverlayUrlsForSpecies(s)
          if (!urls) continue
          preload(urls.idleSrc)
          preload(urls.eyesInspectSrc)
          preload(urls.mouthSrc)
          if (urls.mouthClosedSrc) preload(urls.mouthClosedSrc)
        }
      }
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
      navPushedTexRef.current?.dispose()
      navPushedTexRef.current = null
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
    const t0 = performance.now()

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
      const tWorld0 = performance.now()
      world.syncViewportRect(gameCssW, gameCssH)
      world.renderFrame(latestStateRef.current, latestContentRef.current)
      const tWorld1 = performance.now()
      ;(window as any).__elfensteinPerf = {
        ...(window as any).__elfensteinPerf,
        worldMs: tWorld1 - tWorld0,
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
      lastUiCaptureScaleRef.current = null
      // Force a fresh capture once the resize burst settles.
      lastCaptureMsRef.current = 0
    }

    const captureEl = captureRootRef.current
    const wrap = captureWrapperRef.current
    if (wrap) {
      // Force capture layout to match presenter CSS size exactly.
      wrap.style.width = `${w}px`
      wrap.style.height = `${h}px`
    }
    const ui = latestStateRef.current.ui
    const anyShakeActive =
      (!!ui.shake && ui.shake.untilMs > latestStateRef.current.nowMs) ||
      (!!ui.portraitShake && ui.portraitShake.untilMs > latestStateRef.current.nowMs)
    const mouthActive = !!ui.portraitMouth && ui.portraitMouth.untilMs > latestStateRef.current.nowMs
    const idlePulseActive = !!ui.portraitIdlePulse && ui.portraitIdlePulse.untilMs > now
    const pressedPortraitCharacterId = getPressedPortraitCharacterId(cursor.state)
    const portraitPressActive = pressedPortraitCharacterId != null
    // Portrait mouth is a compositor overlay, but it still benefits from a higher cadence so flicker reads.
    const highFpsUi = anyShakeActive || mouthActive || idlePulseActive || portraitPressActive

    // When a high-FPS UI moment begins (e.g. portrait mouth flicker), force the next capture ASAP
    // so the burst doesn't "start late" waiting for a stale interval gate.
    if (highFpsUi && !prevHighFpsUiRef.current) {
      lastCaptureMsRef.current = 0
    }
    prevHighFpsUiRef.current = highFpsUi

    // Default cadence: keep captures reasonably frequent for normal HUD reactivity.
    // During mouth flicker / shake, capture as soon as the previous capture finishes
    // (html2canvas is async and we already gate with `captureInFlightRef`).
    // Scale is pinned during the burst (below) to avoid full-screen shimmer from resampling.
    // Capture is extremely expensive; avoid doing it on a timer when nothing in the HUD changed.
    // We'll still allow burst captures when explicitly needed (shake, portrait interactions, etc.).
    const captureIntervalMs = highFpsUi ? 0 : 120
    // Even when nothing "logically" changed, some HUD elements animate locally (e.g. portrait idle flashes)
    // and should not freeze forever. Keep a low-rate refresh to preserve life without constant spikes.
    const maxStaleMs = 650

    const sForKey = latestStateRef.current
    const poseKey = `${sForKey.floor.playerPos.x},${sForKey.floor.playerPos.y},${sForKey.floor.playerDir}`
    const poseDirty = poseKey !== prevPoseKeyRef.current
    if (poseDirty) {
      prevPoseKeyRef.current = poseKey
      // Pose changes (move/turn) should feel instantaneous in the captured HUD; don't wait
      // for the default interval/backoff gate.
      lastCaptureMsRef.current = 0
    }
    const hudKey = (() => {
      // Keep this intentionally small: only include state that affects the captured HUD rendering.
      const invSlots = sForKey.party.inventory.slots.join(',')
      const chars = sForKey.party.chars
        .map((c) => `${c.id}:${Math.round(c.hp)}:${Math.round(c.stamina)}:${Math.round(c.hunger)}:${Math.round(c.thirst)}`)
        .join('|')
      const itemsOnFloorN = sForKey.floor.itemsOnFloor.length
      const crafting = sForKey.ui.crafting ? `${sForKey.ui.crafting.srcItemId}->${sForKey.ui.crafting.dstItemId}:${sForKey.ui.crafting.endsAtMs}` : ''
      const log = sForKey.ui.activityLog
      const logKey = log && log.length ? `${log.length}:${log[log.length - 1]!.id}` : '0'
      const npcDialogFor = sForKey.ui.npcDialogFor ?? ''
      const death = sForKey.ui.death ? `${sForKey.ui.death.runId}:${sForKey.ui.death.atMs}` : ''
      const pulse = sForKey.ui.portraitIdlePulse
      const pulseKey = pulse ? `${pulse.characterId}:${Math.round(pulse.untilMs)}` : ''
      const pressKey = pressedPortraitCharacterId ?? ''
      // Portrait hover affordances (eyes inspect / mouth preview) are rendered inside the captured HUD
      // and depend on cursor hover state during drags.
      const ht = cursor.state.hoverTarget
      const hoverPortraitKey =
        cursor.state.dragging?.started && ht?.kind === 'portrait' ? `${ht.characterId}:${ht.target}` : ''
      const screenKey = sForKey.ui.screen
      const paperdollKey = sForKey.ui.paperdollFor ?? ''
      const dbgDeathKey = sForKey.ui.debugShowDeathPopup ? '1' : '0'
      const dbgNpcDlgKey = sForKey.ui.debugShowNpcDialogPopup ? '1' : '0'
      const checkpointKey = sForKey.run.checkpoint ? '1' : '0'
      return `inv=${invSlots}|chars=${chars}|pose=${poseKey}|floorItems=${itemsOnFloorN}|craft=${crafting}|log=${logKey}|npcDlg=${npcDialogFor}|death=${death}|pulse=${pulseKey}|press=${pressKey}|pHover=${hoverPortraitKey}|screen=${screenKey}|paperdoll=${paperdollKey}|dbgDeath=${dbgDeathKey}|dbgNpcDlg=${dbgNpcDlgKey}|cp=${checkpointKey}`
    })()
    const hudDirty = hudKey !== lastHudKeyRef.current
    // Don't commit `lastHudKeyRef` until a capture succeeds; otherwise the very first capture
    // can be skipped due to interval gating and the HUD texture never appears.
    if (hudDirty) pendingHudKeyRef.current = hudKey

    // UI capture (html2canvas) can be very expensive and cause frame spikes.
    // Schedule it in idle time and back off when captures are slow.
    const lastCapDur = lastUiCaptureDurMsRef.current ?? 0
    // Backoff is great for smooth frame pacing, but during interaction bursts we prefer immediacy.
    const immediateCapture = highFpsUi || poseDirty
    const backoffMs = immediateCapture ? 0 : lastCapDur > 120 ? 600 : lastCapDur > 60 ? 350 : lastCapDur > 30 ? 180 : 0
    const effectiveIntervalMs = immediateCapture ? 0 : captureIntervalMs + backoffMs
    const stale = now - lastCaptureMsRef.current > maxStaleMs
    const shouldAttemptCapture =
      !inResizeBurst &&
      !!captureEl &&
      (immediateCapture || hudDirty || !uiTexRef.current || stale) &&
      !captureInFlightRef.current &&
      !captureScheduledRef.current &&
      now - lastCaptureMsRef.current > effectiveIntervalMs

    if (shouldAttemptCapture) {
      captureScheduledRef.current = true
      const schedule = (cb: () => void) => {
        // For interaction bursts, run capture ASAP (idle callbacks can be delayed under load).
        if (immediateCapture) {
          window.setTimeout(cb, 0)
          return
        }
        const ric = (window as any).requestIdleCallback as
          | undefined
          | ((fn: () => void, opts?: { timeout?: number }) => number)
        if (typeof ric === 'function') {
          captureIdleHandleRef.current = ric(cb, { timeout: 120 })
          return
        }
        window.setTimeout(cb, 0)
      }

      schedule(() => {
        captureScheduledRef.current = false
        if (!captureEl) return
        // Re-check gates (time passed since scheduling).
        const now2 = performance.now()
        if (captureInFlightRef.current) return
        if (now2 - lastCaptureMsRef.current <= effectiveIntervalMs) return

        captureInFlightRef.current = true
        const captureStart = performance.now()

        // Keep capture scale stable to prevent transient full-screen resampling artifacts
        // when the UI texture resolution changes mid-frame.
        const vvScale = window.visualViewport?.scale || 1
        const effectiveDpr = (window.devicePixelRatio || 1) / Math.max(1e-6, vvScale)
        const desiredScale = Math.min(effectiveDpr, 1.5)
        // If a high-FPS moment is active, pin to the previous scale (if any) so we don't
        // swap UI texture resolution repeatedly during the burst.
        const captureScale = highFpsUi && lastUiCaptureScaleRef.current != null ? lastUiCaptureScaleRef.current : desiredScale
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
            lastUiCaptureDurMsRef.current = performance.now() - captureStart
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
            // Capture succeeded; mark HUD as clean for this key.
            const pending = pendingHudKeyRef.current
            if (pending) {
              lastHudKeyRef.current = pending
              pendingHudKeyRef.current = ''
            }
          })
          .catch(() => {
            // Ignore capture failures; keep the last good UI frame.
          })
          .finally(() => {
            captureInFlightRef.current = false
          })
      })
    }

    const gr = gameEl.getBoundingClientRect()
    // Use the interactive HUD root as the coordinate origin for the game viewport rect.
    // This keeps the scene placement stable even if the presenter canvas and HUD end up
    // with slightly different screen-space bounding rects under stage scaling/letterboxing.
    const hr = interactiveHudRef.current?.getBoundingClientRect() ?? pr

    const party = latestStateRef.current.party.chars.slice(0, 4)
    const portraitRectsPx = party.map((c) => {
      const root = interactiveHudRef.current
      if (!root || !hr) return { left: 0, top: 0, width: 0, height: 0 }
      const el = root.querySelector(`[data-portrait-character-id="${c.id}"]`) as HTMLElement | null
      if (!el) return { left: 0, top: 0, width: 0, height: 0 }
      const r = el.getBoundingClientRect()
      return {
        left: (r.left - (hr.left ?? 0)) / outerS,
        top: (r.top - (hr.top ?? 0)) / outerS,
        width: r.width / outerS,
        height: r.height / outerS,
      }
    })

    const portraitStatsRectsPx = party.map((c) => {
      const root = interactiveHudRef.current
      if (!root || !hr) return { left: 0, top: 0, width: 0, height: 0 }
      const el = root.querySelector(`[data-portrait-character-id="${c.id}"] [data-portrait-stats="true"]`) as HTMLElement | null
      if (!el) return { left: 0, top: 0, width: 0, height: 0 }
      const r = el.getBoundingClientRect()
      return {
        left: (r.left - (hr.left ?? 0)) / outerS,
        top: (r.top - (hr.top ?? 0)) / outerS,
        width: r.width / outerS,
        height: r.height / outerS,
      }
    })

    const navRectsPx = (() => {
      const root = interactiveHudRef.current
      if (!root || !hr) return []
      const ids = ['turnLeft', 'forward', 'turnRight', 'strafeLeft', 'back', 'strafeRight'] as const
      return ids.map((id) => {
        const el = root.querySelector(`[data-navpad-button-id="${id}"]`) as HTMLElement | null
        if (!el) return { left: 0, top: 0, width: 0, height: 0 }
        const r = el.getBoundingClientRect()
        return {
          left: (r.left - (hr.left ?? 0)) / outerS,
          top: (r.top - (hr.top ?? 0)) / outerS,
          width: r.width / outerS,
          height: r.height / outerS,
        }
      })
    })()

    // Drive compositor-only portrait overlays off real time.
    const nowMs = performance.now()
    const cue = latestStateRef.current.ui.portraitMouth
    const pulse = latestStateRef.current.ui.portraitIdlePulse
    const hz = Number(latestStateRef.current.render.portraitMouthFlickerHz ?? 0)
    const amount = Number(latestStateRef.current.render.portraitMouthFlickerAmount ?? 0)
    const portraitMouthOn = party.map((c) => computePortraitMouthOn({ nowMs, cue, characterId: c.id, hz, amount }))
    // Idle pulse needs to feel immediate on press; do not rely solely on reducer/React timing.
    const portraitIdleOn = party.map((c) =>
      pulse?.characterId === c.id && (pulse.untilMs ?? 0) > nowMs ? 1
      : pressedPortraitCharacterId === c.id ? 1
      : 0,
    )
    const hover = cursor.state.hoverTarget
    const portraitHoverEyesOn = party.map((c) =>
      cursor.state.dragging?.started && hover?.kind === 'portrait' && hover.characterId === c.id && hover.target === 'eyes' ? 1 : 0,
    )
    const portraitHoverMouthOn = party.map((c) =>
      cursor.state.dragging?.started && hover?.kind === 'portrait' && hover.characterId === c.id && hover.target === 'mouth' ? 1 : 0,
    )
    // Hover mouth should show steadily (original affordance); cue mouth flicker wins when active.
    const portraitMouthIsOpen = portraitMouthOn.map((v, i) => (v > 0 ? v : portraitHoverMouthOn[i] ?? 0))

    const portraitMouthTex: Array<THREE.Texture | null> = []
    const portraitIdleTex: Array<THREE.Texture | null> = []
    const portraitEyesInspectTex: Array<THREE.Texture | null> = []
    const portraitMouthAr: number[] = []
    const portraitIdleAr: number[] = []
    const portraitEyesInspectAr: number[] = []
    const portraitMouthOnForShader: number[] = []
    for (const c of party) {
      const urls = portraitOverlayUrlsForSpecies(c.species)
      if (!urls) {
        portraitMouthTex.push(null)
        portraitIdleTex.push(null)
        portraitEyesInspectTex.push(null)
        portraitMouthAr.push(1)
        portraitIdleAr.push(1)
        portraitEyesInspectAr.push(1)
        portraitMouthOnForShader.push(0)
        continue
      }
      const loader = textureLoaderRef.current
      const cache = portraitTexCacheRef.current
      const arCache = portraitArCacheRef.current
      const getTex = (src: string) => {
        const existing = cache.get(src)
        if (existing) return existing
        if (!loader) return null
        const tex = loader.load(src, () => {
          const img = tex.image as unknown as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number } | undefined
          const w = Number(img?.naturalWidth ?? img?.width ?? 0)
          const h = Number(img?.naturalHeight ?? img?.height ?? 0)
          if (w > 0 && h > 0) arCache.set(src, w / h)
        })
        tex.colorSpace = THREE.SRGBColorSpace
        tex.minFilter = THREE.LinearFilter
        tex.magFilter = THREE.LinearFilter
        tex.generateMipmaps = false
        cache.set(src, tex)
        return tex
      }
      const idx = portraitMouthTex.length
      const isOpen = (portraitMouthIsOpen[idx] ?? 0) > 0
      const hasClosed = !!urls.mouthClosedSrc
      const mouthSrc = isOpen ? urls.mouthSrc : (urls.mouthClosedSrc ?? urls.mouthSrc)
      portraitMouthTex.push(getTex(mouthSrc))
      portraitIdleTex.push(getTex(urls.idleSrc))
      portraitEyesInspectTex.push(getTex(urls.eyesInspectSrc))
      portraitMouthAr.push(arCache.get(mouthSrc) ?? 1)
      portraitIdleAr.push(arCache.get(urls.idleSrc) ?? 1)
      portraitEyesInspectAr.push(arCache.get(urls.eyesInspectSrc) ?? 1)
      // If the species has a closed-mouth art, keep the compositor mouth overlay always active,
      // swapping textures between open/closed for instant transitions without capture latency.
      portraitMouthOnForShader.push(hasClosed ? 1 : isOpen ? 1 : 0)
    }

    const activeRoomPropRaw = roomPropertyUnderPlayer(latestStateRef.current)
    const uiSnap = latestStateRef.current.ui
    const telegraphOverride = {
      mode: uiSnap.roomTelegraphMode,
      strength: uiSnap.roomTelegraphStrength,
    }
    const activeRoomProp =
      telegraphOverride?.mode && telegraphOverride.mode !== 'auto'
        ? telegraphOverride.mode === 'off'
          ? null
          : telegraphOverride.mode
        : activeRoomPropRaw
    const telegraph = (() => {
      const rawStrength = telegraphOverride?.strength
      const strength = (fallback: number) =>
        rawStrength === undefined || rawStrength === null ? fallback : Number(rawStrength)

      // Luma-preserving tint override (compositor mode 1): visible on dark scenes; replaces floor theme cast without vignette.
      if (activeRoomProp === 'Burning')
        return {
          strength: strength(0.62),
          tintMode: 1 as const,
          color: { r: 1.0, g: 0.2, b: 0.07 },
        }
      if (activeRoomProp === 'Flooded')
        return {
          strength: strength(0.58),
          tintMode: 1 as const,
          color: { r: 0.12, g: 0.55, b: 1.0 },
        }
      if (activeRoomProp === 'Infected')
        return {
          strength: strength(0.6),
          tintMode: 1 as const,
          color: { r: 0.15, g: 0.95, b: 0.2 },
        }
      return { strength: 0.0, tintMode: 0 as const, color: { r: 1.0, g: 1.0, b: 1.0 } }
    })()
    const hazardPulseMs = 3800
    const hazardTintPulse =
      activeRoomProp === 'Burning' || activeRoomProp === 'Flooded' || activeRoomProp === 'Infected'
        ? 0.55 + 0.4 * Math.sin((performance.now() * 2 * Math.PI) / hazardPulseMs)
        : 1
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
      telegraphStrength: telegraph.strength,
      telegraphColor: telegraph.color,
      telegraphTintMode: telegraph.tintMode,
      telegraphTintPulse: telegraph.tintMode === 1 ? hazardTintPulse : 1,
      portraitRectsPx,
      portraitMouthTex,
      portraitIdleTex,
      portraitMouthOn: portraitMouthOnForShader,
      portraitIdleOn,
      portraitEyesInspectTex,
      portraitEyesInspectOn: portraitHoverEyesOn,
      portraitMouthAr,
      portraitIdleAr,
      portraitEyesInspectAr,
      portraitArtNudgeYCssPx: -30,
      portraitStatsRectsPx,
      navButtonRectsPx: navRectsPx,
      navPushedOn: [
        navPadPressedId === 'turnLeft' ? 1 : 0,
        navPadPressedId === 'forward' ? 1 : 0,
        navPadPressedId === 'turnRight' ? 1 : 0,
        navPadPressedId === 'strafeLeft' ? 1 : 0,
        navPadPressedId === 'back' ? 1 : 0,
        navPadPressedId === 'strafeRight' ? 1 : 0,
      ],
      navPushedTex: (() => {
        if (navPushedTexRef.current) return navPushedTexRef.current
        const loader = textureLoaderRef.current
        if (!loader) return null
        const tex = loader.load(NAV_PUSHED_SRC)
        tex.colorSpace = THREE.SRGBColorSpace
        tex.minFilter = THREE.LinearFilter
        tex.magFilter = THREE.LinearFilter
        tex.generateMipmaps = false
        navPushedTexRef.current = tex
        return tex
      })(),
    })
    const tPresent0 = performance.now()
    presenter.render()
    const tPresent1 = performance.now()

    const t1 = performance.now()
    const frameMs = t1 - t0
    const presentMs = tPresent1 - tPresent0
    const prev = perfEmaRef.current
    const a = 0.15
    const ema = {
      frameMs: prev.frameMs ? prev.frameMs * (1 - a) + frameMs * a : frameMs,
      worldMs: prev.worldMs ? prev.worldMs * (1 - a) + Number((window as any).__elfensteinPerf?.worldMs ?? 0) * a : Number((window as any).__elfensteinPerf?.worldMs ?? 0),
      presentMs: prev.presentMs ? prev.presentMs * (1 - a) + presentMs * a : presentMs,
    }
    perfEmaRef.current = ema
    ;(window as any).__elfensteinPerf = {
      ...(window as any).__elfensteinPerf,
      frameMs,
      presentMs,
      emaFrameMs: ema.frameMs,
      emaWorldMs: ema.worldMs,
      emaPresentMs: ema.presentMs,
      uiCaptureMs: lastUiCaptureDurMsRef.current,
      pointer: {
        isDown: cursor.state.isPointerDown,
        downStartedAtMs: pointerDownStartedAtMsRef.current,
        pressedPortraitCharacterId,
      },
      portraitIdleOn,
      counts: {
        tiles: latestStateRef.current.floor.tiles.length,
        pois: latestStateRef.current.floor.pois.length,
        npcs: latestStateRef.current.floor.npcs.length,
        itemsOnFloor: latestStateRef.current.floor.itemsOnFloor.length,
        floorGeomRevision: latestStateRef.current.floor.floorGeomRevision,
      },
    }
    return true
  }

  // Render on state changes (normal gameplay).
  useEffect(() => {
    const prev = prevPointerDownRef.current
    const cur = cursor.state.isPointerDown
    prevPointerDownRef.current = cur
    if (!prev && cur) pointerDownStartedAtMsRef.current = performance.now()
    if (prev && !cur) pointerDownStartedAtMsRef.current = null
    renderOnce()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, layoutTick, state, navPadPressedId, cursor.state.hoverTarget, cursor.state.dragging?.started, cursor.state.isPointerDown])

  // During resize, the browser can stretch stale frames; keep redrawing for a short burst.
  useEffect(() => {
    let raf = 0
    let stopped = false
    const loop = () => {
      if (stopped) return
      const now = performance.now()
      const s = latestStateRef.current
      const ui = s.ui
      const anyShakeActive = (!!ui.shake && ui.shake.untilMs > s.nowMs) || (!!ui.portraitShake && ui.portraitShake.untilMs > s.nowMs)
      const mouthActive = !!ui.portraitMouth && ui.portraitMouth.untilMs > s.nowMs
      const hazardTelegraphActive = roomPropertyUnderPlayer(s) != null
      const active =
        now < renderBurstUntilMsRef.current || anyShakeActive || mouthActive || hazardTelegraphActive
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

  useEffect(() => {
    return () => {
      const cancel = (window as any).cancelIdleCallback as undefined | ((h: number) => void)
      if (captureIdleHandleRef.current != null && typeof cancel === 'function') cancel(captureIdleHandleRef.current)
      captureIdleHandleRef.current = null
      captureScheduledRef.current = false
    }
  }, [])

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

      {state.ui.screen === 'title' ||
      state.ui.paperdollFor ||
      state.ui.npcDialogFor ||
      state.ui.death ||
      (state.ui.screen === 'hub' && state.ui.tavernTradeOpen) ||
      (state.ui.screen === 'game' && state.ui.debugShowNpcDialogPopup) ||
      (state.ui.screen === 'game' && state.ui.debugShowDeathPopup) ? (
        <div className={styles.stageModalLayer}>
          <TitleScreen state={state} dispatch={dispatch} />
          <TavernTradeModal state={state} dispatch={dispatch} />
          <DeathModal state={state} dispatch={dispatch} gameViewportRef={gameViewportRef} />
          <PaperdollModal state={state} dispatch={dispatch} content={content} />
          <NpcDialogModal state={state} dispatch={dispatch} content={content} gameViewportRef={gameViewportRef} />
        </div>
      ) : null}

      {captureMountEl
        ? createPortal(
            <div
              className={styles.captureHud}
              ref={captureWrapperRef}
              data-capture-wrap="true"
              style={{ width: STAGE_CSS_WIDTH, height: STAGE_CSS_HEIGHT }}
            >
              <div data-capture-root="true" ref={captureRootRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
                <HudLayout
                  state={state}
                  dispatch={noopDispatch}
                  content={content}
                  interactive={false}
                  captureForPostprocess={true}
                  world={null}
                  rootRef={captureHudRef}
                  gameViewportRef={captureGameViewportRef}
                  webglError={null}
                  navPadPressedId={navPadPressedId}
                  onNavPadVisualPress={onNavPadVisualPress}
                  captureNpcOverlay={
                    state.ui.death || (state.ui.screen === 'game' && state.ui.debugShowDeathPopup) ? (
                      <DeathModal variant="capture" state={state} dispatch={noopDispatch} />
                    ) : state.ui.npcDialogFor || (state.ui.screen === 'game' && state.ui.debugShowNpcDialogPopup) ? (
                      <NpcDialogModal variant="capture" state={state} dispatch={noopDispatch} content={content} />
                    ) : null
                  }
                  captureFullHudOverlay={
                    state.ui.screen === 'title' ? (
                      <TitleScreen variant="capture" state={state} dispatch={noopDispatch} />
                    ) : state.ui.paperdollFor ? (
                      <PaperdollModal variant="capture" state={state} dispatch={noopDispatch} content={content} />
                    ) : state.ui.screen === 'hub' && state.ui.tavernTradeOpen ? (
                      <TavernTradeModal variant="capture" state={state} dispatch={noopDispatch} />
                    ) : null
                  }
                />
              </div>
            </div>,
            captureMountEl,
          )
        : null}
    </div>
  )
}

