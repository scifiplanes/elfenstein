import { useEffect, useMemo, useRef } from 'react'
import type { GameState } from '../../game/types'
import { MusicPlayer } from './MusicPlayer'
import { ALL_MUSIC_TRACKS } from './musicTracks'

const CROSSFADE_SEC = 2.5

export function MusicLayer(props: { state: GameState; track: string }) {
  const { state, track } = props
  const player = useMemo(() => new MusicPlayer(), [])
  // Ref so the preload callback always reads the latest desired track.
  const desiredTrack = useRef(track)

  useEffect(() => {
    const resume = () => player.ensure()
    window.addEventListener('pointerdown', resume)
    window.addEventListener('keydown', resume)

    void player.preload(ALL_MUSIC_TRACKS).then(() => {
      player.crossfadeTo(desiredTrack.current, 0)
    })

    return () => {
      player.stop()
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
    }
  }, [player])

  useEffect(() => {
    player.setVolume(state.audio.masterMusic)
  }, [player, state.audio.masterMusic])

  useEffect(() => {
    desiredTrack.current = track
    player.crossfadeTo(track, CROSSFADE_SEC)
  }, [player, track])

  return null
}
