import type { DamageType, EquipmentSlot, ItemDefId, PoiKind, Species, StatusEffectId, WeaponDamageStat } from '../types'
import { DEFAULT_ITEMS } from './items'
import { DEFAULT_STATUSES } from './statuses'

/** Equipped on party slot 0: drives camera PointLight tuning (see `resolvePlayerCameraLightKind`). */
export type PlayerLightTag = 'torch' | 'lantern' | 'headlamp' | 'glowbug'

/** Per-POI hook for dragging an item onto that POI (see `applyItemOnPoi`). */
export type ItemPoiUseHook = {
  transformTo?: ItemDefId
  toast?: string
  /** Shrine: destroy the offered item after use. */
  consumeOffering?: boolean
  /** Shrine: grant **Blessed** to every living party member for this many ms. */
  blessPartyMs?: number
}

export type ItemDef = {
  id: ItemDefId
  name: string
  icon: { kind: 'emoji'; value: string } | { kind: 'sprite'; path: string }
  tags: Array<
    'food' | 'weapon' | 'container' | 'material' | 'quest' | 'tool' | 'hat' | 'oneHand' | 'twoHand'
  >
  weapon?: {
    baseDamage: number
    damageType: DamageType
    /** Optional additive scaling: `floor(stat * 0.25)` merged before % run bonus. */
    damageStat?: WeaponDamageStat
    consumesOnUse?: boolean
    staminaCost?: number
    statusOnHit?: Array<{ status: StatusEffectId; pct: number; durationMs?: number }>
  }
  equipSlots?: EquipmentSlot[]
  feed?: { hunger: number; thirst?: number; stamina?: number; hp?: number; statusChances?: Array<{ status: StatusEffectId; pct: number; onlySpecies?: Species }> }
  useOnPoi?: Partial<Record<PoiKind, ItemPoiUseHook>>
  /** Combat-only: drag onto acting PC portrait hands during encounter to apply Fire resist for `shieldTurns` of that PC’s turns. */
  combatShield?: {
    fireResistBonusPct: number
    staminaCost: number
    shieldTurns: number
    consumesOnUse: true
  }
  playerLight?: PlayerLightTag
}

export type StatusEffectDef = {
  id: StatusEffectId
  name: string
  kind: 'positive' | 'negative' | 'neutral'
  defaultDurationMs?: number
}

export class ContentDB {
  private readonly itemsById: Record<ItemDefId, ItemDef>
  private readonly statusById: Record<StatusEffectId, StatusEffectDef>

  private constructor(args: { items: ItemDef[]; statuses: StatusEffectDef[] }) {
    this.itemsById = Object.fromEntries(args.items.map((i) => [i.id, i])) as Record<ItemDefId, ItemDef>
    this.statusById = Object.fromEntries(args.statuses.map((s) => [s.id, s])) as Record<StatusEffectId, StatusEffectDef>
  }

  static createDefault() {
    return new ContentDB({
      items: DEFAULT_ITEMS,
      statuses: DEFAULT_STATUSES,
    })
  }

  item(defId: ItemDefId): ItemDef {
    const found = this.itemsById[defId]
    if (!found) throw new Error(`Unknown item def: ${defId}`)
    return found
  }

  status(id: StatusEffectId): StatusEffectDef {
    const found = this.statusById[id]
    if (!found) throw new Error(`Unknown status: ${id}`)
    return found
  }
}

