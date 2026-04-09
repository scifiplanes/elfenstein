import type { GameState } from '../types'
import type { GenNpc } from '../../procgen/types'

/** Ensures runtime NPCs always carry a `statuses` array (procgen may omit for older bundles). */
export function npcsWithDefaultStatuses(npcs: readonly GenNpc[]): GameState['floor']['npcs'] {
  return npcs.map((n) => ({ ...n, statuses: n.statuses ?? [] }))
}
