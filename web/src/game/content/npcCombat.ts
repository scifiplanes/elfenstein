import type { DamageType, NpcKind, Resistances, StatusEffectId } from '../types'

/**
 * Global scale on authored `NPC_COMBAT_BY_KIND.hpMax` for spawn + HUD (`npcKindHpMax`).
 * Keeps one knob for “all enemies tankier” without re-editing every row (**ADR-0440** = **×3**; was **×2** in **ADR-0429**).
 */
export const NPC_SPAWN_HP_TABLE_MUL = 3

/**
 * Global scale on authored `baseDamage` for combat tuning (`npcCombatTuningFromContent`, boss base).
 */
export const NPC_COMBAT_DAMAGE_TABLE_MUL = 3

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
    baseDamage: 6,
    damageType: 'Pierce',
    armor: 0,
    resistances: {},
    statusOnHit: [{ status: 'Poisoned', pct: 14, durationMs: 20_000 }],
    hpMax: 13,
  },
  Skeleton: {
    speed: 6,
    baseDamage: 8,
    damageType: 'Fire',
    armor: 1,
    resistances: { Cut: 0.1, Pierce: 0.06 },
    hpMax: 23,
  },
  Catoctopus: {
    speed: 7,
    baseDamage: 7,
    damageType: 'Blunt',
    armor: 0,
    resistances: { Blunt: 0.08 },
    hpMax: 28,
  },
  Wurglepup: {
    speed: 8,
    baseDamage: 6,
    damageType: 'Cut',
    armor: 0,
    resistances: { Cut: 0.05 },
    hpMax: 25,
  },
  Bobr: {
    speed: 5,
    baseDamage: 7,
    damageType: 'Blunt',
    armor: 1,
    resistances: { Blunt: 0.06 },
    hpMax: 30,
  },
  Chumbo: {
    speed: 5,
    baseDamage: 10,
    damageType: 'Blunt',
    armor: 3,
    resistances: { Blunt: 0.1 },
    hpMax: 35,
  },
  Grub: {
    speed: 6,
    baseDamage: 5,
    damageType: 'Pierce',
    armor: 0,
    resistances: {},
    statusOnHit: [{ status: 'Parasitized', pct: 9, durationMs: 22_000 }],
    hpMax: 15,
  },
  SporeGrub: {
    speed: 6,
    baseDamage: 5,
    damageType: 'Pierce',
    armor: 0,
    resistances: {},
    statusOnHit: [{ status: 'Spored', pct: 8, durationMs: 16_000 }],
    hpMax: 15,
  },
  SunGrub: {
    speed: 7,
    baseDamage: 5,
    damageType: 'Pierce',
    armor: 0,
    resistances: {},
    statusOnHit: [{ status: 'Parasitized', pct: 7, durationMs: 20_000 }],
    hpMax: 17,
  },
  Kuratko: {
    speed: 9,
    baseDamage: 5,
    damageType: 'Cut',
    armor: 0,
    resistances: {},
    hpMax: 18,
  },
  Grechka: {
    speed: 6,
    baseDamage: 6,
    damageType: 'Blunt',
    armor: 0,
    resistances: {},
    hpMax: 20,
  },
  Snailord: {
    speed: 4,
    baseDamage: 7,
    damageType: 'Earth',
    armor: 3,
    resistances: { Earth: 0.13 },
    statusOnHit: [{ status: 'Drenched', pct: 17, durationMs: 11_000 }],
    hpMax: 33,
  },
  Bulba: {
    speed: 5,
    baseDamage: 6,
    damageType: 'Earth',
    armor: 1,
    resistances: {},
    statusOnHit: [{ status: 'Spored', pct: 12, durationMs: 18_000 }],
    hpMax: 25,
  },
  Elder: {
    speed: 5,
    baseDamage: 6,
    damageType: 'Blunt',
    armor: 1,
    resistances: {},
    hpMax: 28,
  },
  Kerekere: {
    speed: 8,
    baseDamage: 6,
    damageType: 'Pierce',
    armor: 0,
    resistances: {},
    hpMax: 23,
  },
  Bok: {
    speed: 6,
    baseDamage: 7,
    damageType: 'Blunt',
    armor: 1,
    resistances: {},
    hpMax: 25,
  },
  RegularBok: {
    speed: 7,
    baseDamage: 6,
    damageType: 'Blunt',
    armor: 0,
    resistances: {},
    hpMax: 20,
  },
  BigHands: {
    speed: 4,
    baseDamage: 11,
    damageType: 'Blunt',
    armor: 3,
    resistances: { Blunt: 0.06 },
    hpMax: 40,
  },
  Gargantula: {
    speed: 6,
    baseDamage: 12,
    damageType: 'Pierce',
    armor: 3,
    resistances: { Pierce: 0.08 },
    statusOnHit: [{ status: 'Poisoned', pct: 21, durationMs: 24_000 }],
    hpMax: 50,
  },
}

export function npcKindHpMax(kind: NpcKind): number {
  const raw = NPC_COMBAT_BY_KIND[kind].hpMax * NPC_SPAWN_HP_TABLE_MUL
  return Math.max(1, Math.round(raw))
}

/** Stats used by `combat.ts` (excludes hpMax). */
export function npcCombatTuningFromContent(kind: NpcKind): Omit<NpcCombatRow, 'hpMax'> {
  const { hpMax: _h, ...rest } = NPC_COMBAT_BY_KIND[kind]
  return {
    ...rest,
    baseDamage: Math.max(1, Math.round(rest.baseDamage * NPC_COMBAT_DAMAGE_TABLE_MUL)),
  }
}
