import { Fragment, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { CursorLayer } from '../ui/cursor/CursorLayer'
import { CursorProvider } from '../ui/cursor/CursorProvider'
import { DebugPanel } from '../ui/debug/DebugPanel'
import { initialState, reduce } from '../game/reducer'
import { ContentDB } from '../game/content/contentDb'
import { FeedbackLayer } from '../ui/feedback/FeedbackLayer'
import { SpatialAudioLayer } from '../ui/audio/SpatialAudioLayer'
import { MusicLayer } from '../ui/audio/MusicLayer'
import {
  buildDebugUiPersist,
  loadDebugSettingsFromLocal,
  loadDebugSettingsFromProject,
  saveDebugSettingsToLocal,
  saveDebugSettingsToProject,
} from './debugSettingsPersistence'
import { DitheredFrameRoot } from '../ui/frame/DitheredFrameRoot'
import { FixedStageViewport } from './FixedStageViewport'

export function GameApp() {
  const content = useMemo(() => ContentDB.createDefault(), [])
  const [state, dispatch] = useReducer(reduce, undefined, () => initialState(content))
  const [debugTuningHydrated, setDebugTuningHydrated] = useState(false)
  const stateRef = useRef(state)
  stateRef.current = state
  const debugTuningHydratedRef = useRef(false)
  debugTuningHydratedRef.current = debugTuningHydrated
  const projectSaveTimerRef = useRef(0)
  const projectSaveFailToastTimerRef = useRef(0)

  const persistProjectDebugNow = useCallback(() => {
    const s = stateRef.current
    return saveDebugSettingsToProject(s.render, s.audio, s.hubHotspots, buildDebugUiPersist(s.ui))
  }, [])

  const scheduleProjectSaveFailToast = useCallback(() => {
    window.clearTimeout(projectSaveFailToastTimerRef.current)
    projectSaveFailToastTimerRef.current = window.setTimeout(() => {
      projectSaveFailToastTimerRef.current = 0
      dispatch({
        type: 'ui/toast',
        text: 'Could not save debug settings to project (check dev server / disk permissions).',
        ms: 3200,
      })
    }, 400)
  }, [dispatch])

  useEffect(() => {
    let cancelled = false
    loadDebugSettingsFromProject().then((data) => {
      if (cancelled) return
      if (data?.render || data?.audio) {
        dispatch({ type: 'debug/loadTuning', render: data.render, audio: data.audio })
      }
      if (data?.hubHotspots) {
        dispatch({ type: 'debug/loadHubHotspots', patch: data.hubHotspots })
      }
      if (data?.debugUi) {
        dispatch({ type: 'debug/loadPersistedUi', patch: data.debugUi })
      }
      const local = loadDebugSettingsFromLocal()
      if (local?.render || local?.audio) {
        dispatch({ type: 'debug/loadTuning', render: local.render, audio: local.audio })
      }
      if (local?.hubHotspots) {
        dispatch({ type: 'debug/loadHubHotspots', patch: local.hubHotspots })
      }
      if (local?.debugUi) {
        dispatch({ type: 'debug/loadPersistedUi', patch: local.debugUi })
      }
      setDebugTuningHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!debugTuningHydrated) return
    const t = window.setTimeout(() => {
      saveDebugSettingsToLocal(
        state.render,
        state.audio,
        state.hubHotspots,
        buildDebugUiPersist(state.ui),
      )
    }, 450)
    return () => window.clearTimeout(t)
  }, [
    debugTuningHydrated,
    state.render,
    state.render.npcSpawnCountMin,
    state.render.npcSpawnCountMax,
    state.audio,
    state.hubHotspots,
    state.ui.debugBgTrack,
    state.ui.procgenDebugOverlay,
    state.ui.roomTelegraphMode,
    state.ui.roomTelegraphStrength,
    state.ui.debugShowNpcDialogPopup,
    state.ui.debugShowDeathPopup,
  ])

  /** Debounced write of the same snapshot as localStorage to `web/public/debug-settings.json` (Vite dev only). */
  useEffect(() => {
    if (!debugTuningHydrated) return
    if (!import.meta.env.DEV) return
    window.clearTimeout(projectSaveTimerRef.current)
    projectSaveTimerRef.current = window.setTimeout(() => {
      projectSaveTimerRef.current = 0
      void persistProjectDebugNow().then((ok) => {
        if (!ok) scheduleProjectSaveFailToast()
      })
    }, 2000)
    return () => {
      window.clearTimeout(projectSaveTimerRef.current)
      projectSaveTimerRef.current = 0
    }
  }, [
    debugTuningHydrated,
    persistProjectDebugNow,
    scheduleProjectSaveFailToast,
    state.render,
    state.render.npcSpawnCountMin,
    state.render.npcSpawnCountMax,
    state.audio,
    state.hubHotspots,
    state.ui.debugBgTrack,
    state.ui.procgenDebugOverlay,
    state.ui.roomTelegraphMode,
    state.ui.roomTelegraphStrength,
    state.ui.debugShowNpcDialogPopup,
    state.ui.debugShowDeathPopup,
  ])

  /** Flush pending disk save when the tab is hidden or unloaded (dev only); avoids losing edits if the 2s debounce never fires. */
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const flush = () => {
      if (!debugTuningHydratedRef.current) return
      window.clearTimeout(projectSaveTimerRef.current)
      projectSaveTimerRef.current = 0
      void persistProjectDebugNow().then((ok) => {
        if (!ok) scheduleProjectSaveFailToast()
      })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [persistProjectDebugNow, scheduleProjectSaveFailToast])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const s = stateRef.current
        if (s.ui.settingsOpen) {
          e.preventDefault()
          dispatch({ type: 'ui/setSettingsOpen', open: false })
          return
        }
        if (s.ui.npcDialogFor || (s.ui.screen === 'game' && s.ui.debugShowNpcDialogPopup)) {
          e.preventDefault()
          dispatch({ type: 'ui/closeNpcDialog' })
          return
        }
        if (s.ui.paperdollFor) {
          e.preventDefault()
          dispatch({ type: 'ui/closePaperdoll' })
          return
        }
        if (s.ui.tradeSession) {
          e.preventDefault()
          dispatch({ type: 'trade/close' })
          return
        }
        e.preventDefault()
        dispatch({ type: 'ui/toggleSettings' })
        return
      }
      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault()
        dispatch({ type: 'player/turn', dir: -1 })
        return
      }
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault()
        dispatch({ type: 'player/turn', dir: 1 })
        return
      }
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        dispatch({ type: 'player/strafe', side: -1 })
        return
      }
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        dispatch({ type: 'player/strafe', side: 1 })
        return
      }
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault()
        dispatch({ type: 'player/step', forward: 1 })
        return
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault()
        dispatch({ type: 'player/step', forward: -1 })
        return
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        dispatch({ type: 'combat/fleeAttempt' })
        return
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        dispatch({ type: 'combat/defend' })
        return
      }
      if (e.key === 'F2') {
        e.preventDefault()
        dispatch({ type: 'ui/toggleDebug' })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    let raf = 0
    const loop = () => {
      dispatch({ type: 'time/tick', nowMs: performance.now() })
      raf = window.requestAnimationFrame(loop)
    }
    raf = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(raf)
  }, [])

  return (
    <CursorProvider>
      <Fragment>
        <FixedStageViewport>
          <DitheredFrameRoot state={state} dispatch={dispatch} content={content} />
          <MusicLayer state={state} />
          <SpatialAudioLayer state={state} />
          <FeedbackLayer state={state} dispatch={dispatch} />
          <DebugPanel state={state} dispatch={dispatch} />
        </FixedStageViewport>
        <CursorLayer state={state} content={content} />
      </Fragment>
    </CursorProvider>
  )
}

