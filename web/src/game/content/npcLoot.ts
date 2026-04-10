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
    { defId: 'Bone', weight: 2 },
    { defId: 'Tooth', weight: 1 },
  ],
  Catoctopus: [
    { defId: 'Foodroot', weight: 4 },
    { defId: 'Mushrooms', weight: 3 },
    { defId: 'GlassVial', weight: 2 },
    { defId: 'Stick', weight: 2 },
    { defId: 'Slime', weight: 2 },
  ],
  Wurglepup: [
    { defId: 'Mushrooms', weight: 4 },
    { defId: 'Foodroot', weight: 3 },
    { defId: 'Ash', weight: 2 },
    { defId: 'GlassVial', weight: 2 },
    { defId: 'Mucus', weight: 2 },
  ],
  Bobr: [
    { defId: 'Stone', weight: 3 },
    { defId: 'Stick', weight: 3 },
    { defId: 'Mushrooms', weight: 2 },
    { defId: 'Foodroot', weight: 2 },
    { defId: 'Ash', weight: 2 },
    { defId: 'Sulfur', weight: 2 },
    { defId: 'BobrJuice', weight: 4 },
  ],
  Chumbo: [
    { defId: 'Bone', weight: 4 },
    { defId: 'Stone', weight: 3 },
    { defId: 'Sweetroot', weight: 2 },
    { defId: 'Claw', weight: 2 },
  ],
  Grub: [
    { defId: 'Grubling', weight: 4 },
    { defId: 'Moss', weight: 5 },
    { defId: 'Slime', weight: 2 },
  ],
  Kuratko: [
    { defId: 'Twine', weight: 3 },
    { defId: 'ClothScrap', weight: 3 },
    { defId: 'HerbLeaf', weight: 2 },
    { defId: 'Glowbug', weight: 2 },
  ],
  Grechka: [
    { defId: 'Salt', weight: 4 },
    { defId: 'Foodroot', weight: 3 },
    { defId: 'MortarMeal', weight: 2 },
    { defId: 'Stone', weight: 2 },
  ],
  Snailord: [
    { defId: 'Mucus', weight: 4 },
    { defId: 'Slime', weight: 3 },
    { defId: 'Gem', weight: 1 },
    { defId: 'GlassVial', weight: 2 },
  ],
  Bulba: [
    { defId: 'Fungus', weight: 4 },
    { defId: 'Mushrooms', weight: 3 },
    { defId: 'Moss', weight: 3 },
    { defId: 'SporeCap', weight: 1 },
  ],
  Elder: [
    { defId: 'Figurine', weight: 2 },
    { defId: 'Gem', weight: 2 },
    { defId: 'HerbLeaf', weight: 3 },
    { defId: 'GlassVial', weight: 2 },
  ],
  Kerekere: [
    { defId: 'Glowbug', weight: 3 },
    { defId: 'Twine', weight: 3 },
    { defId: 'BobrJuice', weight: 2 },
    { defId: 'Stick', weight: 2 },
  ],
  Bok: [
    { defId: 'Salt', weight: 3 },
    { defId: 'Sweetroot', weight: 3 },
    { defId: 'ClothScrap', weight: 2 },
    { defId: 'Figurine', weight: 1 },
  ],
  RegularBok: [
    { defId: 'Foodroot', weight: 3 },
    { defId: 'Twine', weight: 3 },
    { defId: 'Stone', weight: 2 },
    { defId: 'HerbLeaf', weight: 2 },
  ],
  BigHands: [
    { defId: 'Bone', weight: 4 },
    { defId: 'Claw', weight: 3 },
    { defId: 'Stone', weight: 2 },
  ],
  Gargantula: [
    { defId: 'Gem', weight: 3 },
    { defId: 'Tooth', weight: 3 },
    { defId: 'Claw', weight: 3 },
    { defId: 'Slime', weight: 2 },
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
