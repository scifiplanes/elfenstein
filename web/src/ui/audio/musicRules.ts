import type { GameState } from '../../game/types'
import { MUSIC_TRACKS } from './musicTracks'

/**
 * Priority-ordered music rules. The first rule whose `active` predicate
 * returns true wins. Add new entries above the existing ones to give them
 * higher priority, or below to give them lower priority.
 */
const RULES: Array<{
  track: string
  active: (state: GameState) => boolean
}> = [
  {
    track: MUSIC_TRACKS.safeHaven,
    active: ({ floor }) =>
      floor.npcs.some(
        (npc) => npc.name === 'Bobr' && manhattan(floor.playerPos, npc.pos) <= 4,
      ),
  },
]

/** Returns the URL of the track that should be playing given the current game state. */
export function selectMusicTrack(state: GameState): string {
  return RULES.find((r) => r.active(state))?.track ?? MUSIC_TRACKS.dungeon
}

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}
