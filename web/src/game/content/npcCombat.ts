import type { DamageType, NpcKind, Resistances, StatusEffectId } from '../types'

/** Per-kind combat stats for encounters and PC hit resolution; `hpMax` is used at spawn and for HUD bars. */
export type NpcCombatRow = {
  speed: number
  baseDamage: number
  damageType: DamageType
  /** Flat subtraction after base damage, for Blunt/Pierce/Cut hits from PCs only. */
  armor: number
  resistances: Resistances
  statusOnHit?: Array<{ status: StatusEffectId; pct: number; durationMs?: number }>
  hpMax: number
}

export const NPC_COMBAT_BY_KIND: Record<NpcKind, NpcCombatRow> = {
  Swarm: {
    speed: 8,
    baseDamage: 5,
    damageType: 'Pierce',
    armor: 0,
    resistances: {},
    statusOnHit: [{ status: 'Poisoned', pct: 12, durationMs: 18_000 }],
    hpMax: 10,
  },
  Skeleton: {
    speed: 5,
    baseDamage: 7,
    damageType: 'Fire',
    armor: 1,
    resistances: { Cut: 0.08, Pierce: 0.05 },
    hpMax: 18,
  },
  Catoctopus: {
    speed: 6,
    baseDamage: 6,
    damageType: 'Blunt',
    armor: 0,
    resistances: { Blunt: 0.06 },
    hpMax: 22,
  },
  Wurglepup: {
    speed: 7,
    baseDamage: 5,
    damageType: 'Cut',
    armor: 0,
    resistances: { Cut: 0.04 },
    hpMax: 20,
  },
  Bobr: {
    speed: 4,
    baseDamage: 6,
    damageType: 'Blunt',
    armor: 1,
    resistances: { Blunt: 0.05 },
    hpMax: 24,
  },
}

export function npcKindHpMax(kind: NpcKind): number {
  return NPC_COMBAT_BY_KIND[kind].hpMax
}

/** Stats used by `combat.ts` (excludes hpMax). */
export function npcCombatTuningFromContent(kind: NpcKind): Omit<NpcCombatRow, 'hpMax'> {
  const { hpMax: _h, ...rest } = NPC_COMBAT_BY_KIND[kind]
  return rest
}
