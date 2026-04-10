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
  Chumbo: {
    speed: 4,
    baseDamage: 8,
    damageType: 'Blunt',
    armor: 2,
    resistances: { Blunt: 0.08 },
    hpMax: 28,
  },
  Grub: {
    speed: 5,
    baseDamage: 4,
    damageType: 'Pierce',
    armor: 0,
    resistances: {},
    statusOnHit: [{ status: 'Parasitized', pct: 8, durationMs: 20_000 }],
    hpMax: 12,
  },
  Kuratko: {
    speed: 9,
    baseDamage: 4,
    damageType: 'Cut',
    armor: 0,
    resistances: {},
    hpMax: 14,
  },
  Grechka: {
    speed: 5,
    baseDamage: 5,
    damageType: 'Blunt',
    armor: 0,
    resistances: {},
    hpMax: 16,
  },
  Snailord: {
    speed: 3,
    baseDamage: 6,
    damageType: 'Earth',
    armor: 2,
    resistances: { Earth: 0.1 },
    statusOnHit: [{ status: 'Drenched', pct: 15, durationMs: 10_000 }],
    hpMax: 26,
  },
  Bulba: {
    speed: 4,
    baseDamage: 5,
    damageType: 'Earth',
    armor: 1,
    resistances: {},
    statusOnHit: [{ status: 'Spored', pct: 10, durationMs: 16_000 }],
    hpMax: 20,
  },
  Elder: {
    speed: 4,
    baseDamage: 5,
    damageType: 'Blunt',
    armor: 1,
    resistances: {},
    hpMax: 22,
  },
  Kerekere: {
    speed: 7,
    baseDamage: 5,
    damageType: 'Pierce',
    armor: 0,
    resistances: {},
    hpMax: 18,
  },
  Bok: {
    speed: 5,
    baseDamage: 6,
    damageType: 'Blunt',
    armor: 1,
    resistances: {},
    hpMax: 20,
  },
  RegularBok: {
    speed: 6,
    baseDamage: 5,
    damageType: 'Blunt',
    armor: 0,
    resistances: {},
    hpMax: 16,
  },
  BigHands: {
    speed: 3,
    baseDamage: 9,
    damageType: 'Blunt',
    armor: 2,
    resistances: { Blunt: 0.05 },
    hpMax: 32,
  },
  Gargantula: {
    speed: 5,
    baseDamage: 10,
    damageType: 'Pierce',
    armor: 2,
    resistances: { Pierce: 0.06 },
    statusOnHit: [{ status: 'Poisoned', pct: 18, durationMs: 22_000 }],
    hpMax: 40,
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
