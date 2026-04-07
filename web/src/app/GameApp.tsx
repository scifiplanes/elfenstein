import { useEffect, useMemo, useReducer, useState } from 'react'
import { CursorLayer } from '../ui/cursor/CursorLayer'
import { CursorProvider } from '../ui/cursor/CursorProvider'
import { DebugPanel } from '../ui/debug/DebugPanel'
import { initialState, reduce } from '../game/reducer'
import { ContentDB } from '../game/content/contentDb'
import { FeedbackLayer } from '../ui/feedback/FeedbackLayer'
import { SpatialAudioLayer } from '../ui/audio/SpatialAudioLayer'
import { MusicLayer } from '../ui/audio/MusicLayer'
import { loadDebugSettingsFromProject, saveDebugSettingsToProject } from './debugSettingsPersistence'
import { DitheredFrameRoot } from '../ui/frame/DitheredFrameRoot'

export function GameApp() {
  const content = useMemo(() => ContentDB.createDefault(), [])
  const [state, dispatch] = useReducer(reduce, undefined, () => initialState(content))
  const [debugTuningHydrated, setDebugTuningHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadDebugSettingsFromProject().then((data) => {
      if (cancelled) return
      if (data?.render || data?.audio) {
        dispatch({ type: 'debug/loadTuning', render: data.render, audio: data.audio })
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
      void saveDebugSettingsToProject(state.render, state.audio)
    }, 450)
    return () => window.clearTimeout(t)
  }, [debugTuningHydrated, state.render, state.audio])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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
      <DitheredFrameRoot state={state} dispatch={dispatch} content={content} />
      <MusicLayer state={state} src="/sounds/dungeon_bg_music.mp3" />
      <SpatialAudioLayer state={state} />
      <FeedbackLayer state={state} dispatch={dispatch} />
      <CursorLayer state={state} content={content} />
      <DebugPanel state={state} dispatch={dispatch} />
    </CursorProvider>
  )
}

