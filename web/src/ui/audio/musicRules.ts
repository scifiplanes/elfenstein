import type { GameState } from '../../game/types'
import { MUSIC_SETS, type MusicSet } from './musicTracks'

/**
 * Priority-ordered rules. First matching rule wins.
 * Add entries here to introduce new triggers — nothing else needs to change.
 */
const RULES: Array<{
  set: MusicSet
  active: (state: GameState) => boolean
}> = [
  {
    set: MUSIC_SETS.safeHaven,
    active: ({ floor }) =>
      floor.npcs.some(
        (npc) => npc.name === 'Bobr' && manhattan(floor.playerPos, npc.pos) <= 2,
      ),
  },
]

/** Returns the MusicSet that should be active for the given game state. */
export function selectMusicSet(state: GameState): MusicSet {
  return RULES.find((r) => r.active(state))?.set ?? MUSIC_SETS.dungeon
}

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}
