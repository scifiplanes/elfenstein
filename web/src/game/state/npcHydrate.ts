import { npcKindHpMax } from '../content/npcCombat'
import type { GameState } from '../types'
import type { GenNpc } from '../../procgen/types'

/** Ensures each NPC has `hpMax`, clamped `hp`, and a `statuses` array. */
export function hydrateFloorNpcs(npcs: ReadonlyArray<GameState['floor']['npcs'][number]>): GameState['floor']['npcs'] {
  return npcs.map((n) => {
    const hpMax = n.hpMax ?? npcKindHpMax(n.kind)
    const hp = Math.min(n.hp, hpMax)
    return { ...n, hp, hpMax, statuses: n.statuses ?? [] }
  })
}

/** Procgen `GenNpc` rows → runtime floor NPCs. */
export function npcsWithDefaultStatuses(npcs: readonly GenNpc[]): GameState['floor']['npcs'] {
  return hydrateFloorNpcs(npcs as unknown as GameState['floor']['npcs'])
}
