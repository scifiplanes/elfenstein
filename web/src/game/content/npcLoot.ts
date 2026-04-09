import type { GameState, Id, NpcKind } from '../types'

type LootEntry = { defId: string; weight: number }

function hashStr(s: string) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Weighted item defs per NPC kind. Totals need not match across kinds.
 * Def ids must exist in `DEFAULT_ITEMS`.
 */
const NPC_LOOT_TABLES: Record<NpcKind, LootEntry[]> = {
  Swarm: [
    { defId: 'Mushrooms', weight: 5 },
    { defId: 'Ash', weight: 3 },
    { defId: 'HerbLeaf', weight: 2 },
    { defId: 'Stick', weight: 2 },
  ],
  Skeleton: [
    { defId: 'Stone', weight: 4 },
    { defId: 'StoneShard', weight: 3 },
    { defId: 'Stick', weight: 3 },
    { defId: 'Sulfur', weight: 2 },
  ],
  Catoctopus: [
    { defId: 'Foodroot', weight: 4 },
    { defId: 'Mushrooms', weight: 3 },
    { defId: 'GlassVial', weight: 2 },
    { defId: 'Stick', weight: 2 },
  ],
  Wurglepup: [
    { defId: 'Mushrooms', weight: 4 },
    { defId: 'Foodroot', weight: 3 },
    { defId: 'Ash', weight: 2 },
    { defId: 'GlassVial', weight: 2 },
  ],
  Bobr: [
    { defId: 'Stone', weight: 3 },
    { defId: 'Stick', weight: 3 },
    { defId: 'Mushrooms', weight: 2 },
    { defId: 'Foodroot', weight: 2 },
    { defId: 'Ash', weight: 2 },
    { defId: 'Sulfur', weight: 2 },
  ],
}

/** Match prior MVP: ~45% of deaths yield one floor drop. */
const DROP_ROLL_MAX = 45

/**
 * Deterministic loot from `floor.seed` + `npcId` + `kind` only (no wall-clock).
 */
export function pickNpcLootDefId(state: GameState, kind: NpcKind, npcId: Id): string | null {
  const base = `${state.floor.seed}:${npcId}`
  const dropRoll = (hashStr(`${base}:drop`) % 100) + 1
  if (dropRoll > DROP_ROLL_MAX) return null

  const table = NPC_LOOT_TABLES[kind]
  const total = table.reduce((s, e) => s + e.weight, 0)
  if (total <= 0) return null

  let pick = hashStr(`${base}:which`) % total
  for (const e of table) {
    if (pick < e.weight) return e.defId
    pick -= e.weight
  }
  return table[table.length - 1]!.defId
}
