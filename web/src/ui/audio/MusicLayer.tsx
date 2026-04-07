import { useEffect, useMemo } from 'react'
import type { GameState } from '../../game/types'
import { MusicPlayer } from './MusicPlayer'

export function MusicLayer(props: { state: GameState; src: string }) {
  const { state, src } = props
  const player = useMemo(() => new MusicPlayer(), [])

  // Load once. Also attach gesture listeners so the AudioContext resumes on
  // first user interaction (browsers block autoplay until a gesture occurs).
  useEffect(() => {
    void player.load(src)
    const resume = () => player.ensure()
    window.addEventListener('pointerdown', resume)
    window.addEventListener('keydown', resume)
    return () => {
      player.stop()
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
    }
  }, [player, src])

  useEffect(() => {
    player.setVolume(state.audio.masterMusic)
  }, [player, state.audio.masterMusic])

  return null
}
