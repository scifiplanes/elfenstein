import { useEffect, useMemo } from 'react'
import type { GameState } from '../../game/types'
import { SpatialAudio } from './SpatialAudio'

export function SpatialAudioLayer(props: { state: GameState }) {
  const { state } = props
  const engine = useMemo(() => new SpatialAudio(), [])

  useEffect(() => {
    const emitters = [
      ...state.floor.pois.map((p) => ({ id: `poi:${p.id}`, pos: p.pos, kind: 'poi' as const })),
      ...state.floor.npcs.map((n) => ({ id: `npc:${n.id}`, pos: n.pos, kind: 'npc' as const })),
    ]
    engine.setEmitters(
      emitters,
      state.floor.playerPos,
      {
        master: state.audio.masterSfx,
        maxDistance: state.audio.distanceMaxCells,
        minGain: state.audio.volumeFar,
        maxGain: state.audio.volumeNear,
        minCutoffHz: state.audio.lowpassFarHz,
        maxCutoffHz: state.audio.lowpassNearHz,
      },
    )
  }, [engine, state.floor.pois, state.floor.npcs, state.floor.playerPos, state.audio])

  return null
}

