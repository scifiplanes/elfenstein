import { useMemo, useEffect, useRef } from 'react'
import type { Dispatch } from 'react'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import { SfxEngine, type SfxKind } from './SfxEngine'
import { SfxFilePlayer } from '../audio/SfxFilePlayer'
import { shakeTransform } from './shakeTransform'
import styles from './FeedbackLayer.module.css'

/**
 * Maps a sound kind to one or more audio files.
 * A random file is picked on each play. Add an entry here to switch any kind
 * from procedural synthesis to file-based playback.
 */
const SFX_FILES: Partial<Record<SfxKind, string[]>> = {
  munch: [
    '/sounds/sfx/munch1.mp3',
    '/sounds/sfx/munch2.mp3',
    '/sounds/sfx/munch3.mp3',
  ],
  bones: [
    '/sounds/sfx/bones_1.mp3',
    '/sounds/sfx/bones_2.mp3',
    '/sounds/sfx/bones_3.mp3',
  ],
  well: [
    '/sounds/sfx/well.mp3',
  ],
  deep_gnome: [
    '/sounds/sfx/speech/deep_gnome_phrase_1.mp3'
  ]
}

export function FeedbackLayer(props: { state: GameState; dispatch: Dispatch<Action> }) {
  const { state, dispatch } = props
  const engine = useMemo(() => new SfxEngine(), [])
  const lastSeen = useRef<Set<string>>(new Set())

  // One SfxFilePlayer per mapped kind. Loading starts immediately on mount.
  const filePlayers = useMemo(() => {
    const map = new Map<SfxKind, SfxFilePlayer>()
    for (const [kind, urls] of Object.entries(SFX_FILES) as Array<[SfxKind, string[]]>) {
      const player = new SfxFilePlayer()
      void player.load(urls)
      map.set(kind, player)
    }
    return map
  }, [])

  useEffect(() => {
    const q = state.ui.sfxQueue ?? []
    if (!q.length) return
    for (const s of q) {
      if (lastSeen.current.has(s.id)) continue
      lastSeen.current.add(s.id)
      const filePlayer = filePlayers.get(s.kind as SfxKind)
      if (filePlayer) {
        filePlayer.play(state.audio.masterSfx)
      } else {
        engine.play(s.kind as SfxKind, state.audio)
      }
    }
    // Clear on next tick; reducer already clears each frame, but dispatching ensures immediate.
    dispatch({ type: 'time/tick', nowMs: state.nowMs })
  }, [state.ui.sfxQueue, engine, filePlayers, dispatch, state.nowMs, state.audio])

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
