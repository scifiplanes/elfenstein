import { useEffect, useMemo, useRef } from 'react'
import type { Dispatch } from 'react'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import { SfxEngine } from './SfxEngine'
import { shakeTransform } from './shakeTransform'
import styles from './FeedbackLayer.module.css'

export function FeedbackLayer(props: { state: GameState; dispatch: Dispatch<Action> }) {
  const { state, dispatch } = props
  const engine = useMemo(() => new SfxEngine(), [])
  const lastSeen = useRef<Set<string>>(new Set())

  useEffect(() => {
    const q = state.ui.sfxQueue ?? []
    if (!q.length) return
    for (const s of q) {
      if (lastSeen.current.has(s.id)) continue
      lastSeen.current.add(s.id)
      engine.play(s.kind, state.audio as any)
    }
    // Clear on next tick; reducer already clears each frame, but dispatching ensures immediate.
    dispatch({ type: 'time/tick', nowMs: state.nowMs })
  }, [state.ui.sfxQueue, engine, dispatch, state.nowMs])

  const shake = state.ui.shake
  const transform = shake
    ? shakeTransform(
        state.nowMs,
        shake.startedAtMs ?? shake.untilMs - 160,
        shake.untilMs,
        shake.magnitude,
        state.render.camShakeLengthMs,
        state.render.camShakeDecayMs,
      )
    : 'none'

  return (
    <div className={styles.layer}>
      <div className={styles.shake} style={{ transform }} />
    </div>
  )
}

