import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { GameState } from '../../game/types'
import { MusicPlayer } from './MusicPlayer'
import { ALL_MUSIC_TRACKS, type MusicSet } from './musicTracks'

/** Crossfade duration when the active set changes (e.g. entering Bobr range). */
const SET_CROSSFADE_SEC = 2.5
/** Crossfade duration when rotating to the next variation within the same set. */
const VARIATION_CROSSFADE_SEC = 1.5

function randInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

export function MusicLayer(props: { state: GameState; musicSet: MusicSet }) {
  const { state, musicSet } = props
  const player = useMemo(() => new MusicPlayer(), [])

  const activeSetRef  = useRef<MusicSet | null>(null)
  const desiredSetRef = useRef(musicSet)
  const rotationTimer = useRef(0)

  // Ref so the setTimeout callback always calls the latest version without a stale closure.
  const startVariationRef = useRef<(set: MusicSet, idx: number, xfadeSec: number) => void>(
    () => undefined,
  )

  const startVariation = useCallback(
    (set: MusicSet, idx: number, xfadeSec: number) => {
      window.clearTimeout(rotationTimer.current)

      const track = set.tracks[idx]
      player.crossfadeTo(track, xfadeSec)
      activeSetRef.current = set

      const duration = player.getDuration(track)
      if (!duration) return

      const plays = randInt(set.playsMin, set.playsMax)
      rotationTimer.current = window.setTimeout(() => {
        // Guard: if the active set changed while this timer was pending, bail out.
        if (activeSetRef.current?.id !== set.id) return
        const next = (idx + 1) % set.tracks.length
        startVariationRef.current(set, next, VARIATION_CROSSFADE_SEC)
      }, duration * plays * 1000)
    },
    [player],
  )

  // Keep ref in sync so the timer callback always has the latest function.
  startVariationRef.current = startVariation

  // Mount: preload all tracks, attach gesture listeners for autoplay policy.
  useEffect(() => {
    const resume = () => player.ensure()
    window.addEventListener('pointerdown', resume)
    window.addEventListener('keydown', resume)

    void player.preload(ALL_MUSIC_TRACKS).then(() => {
      const set = desiredSetRef.current
      startVariation(set, 0, 0)
    })

    return () => {
      player.stop()
      window.clearTimeout(rotationTimer.current)
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
    }
  }, [player, startVariation])

  // Volume.
  useEffect(() => {
    player.setVolume(state.audio.masterMusic)
  }, [player, state.audio.masterMusic])

  // Set changes: reset rotation to the first track of the new set.
  // No-ops when the same set object is passed (stable reference from MUSIC_SETS).
  useEffect(() => {
    desiredSetRef.current = musicSet
    if (activeSetRef.current?.id !== musicSet.id) {
      startVariation(musicSet, 0, SET_CROSSFADE_SEC)
    }
  }, [musicSet, startVariation])

  return null
}
