import type { DamageType, EquipmentSlot, ItemDefId, PoiKind, Species, StatusEffectId, WeaponDamageStat } from '../types'
import { DEFAULT_ITEMS } from './items'
import { DEFAULT_STATUSES } from './statuses'

/** Equipped items: drives primary dungeon `PointLight` via party-wide sum (see `resolvePartyPlayerLightAggregate`, `WorldRenderer`). */
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

/** Emoji item icon; optional `tintFilter` / `displayScale` / `rotateDeg` / flips disambiguate shared glyphs and tune presentation in the HUD and on floor billboards. */
export type ItemEmojiIcon = {
  kind: 'emoji'
  value: string
  /** CSS `filter` (same as `element.style.filter`), e.g. `hue-rotate(28deg) saturate(1.15)`. */
  tintFilter?: string
  /** Uniform scale vs the slot’s default emoji size; keep near **1** (e.g. **0.88–1.12**). */
  displayScale?: number
  /** Clockwise rotation in degrees around the glyph center (CSS `transform` + canvas billboards). */
  rotateDeg?: number
  /** Mirror the glyph left–right (`scaleX(-1)` in UI; canvas billboards match). */
  flipHorizontal?: boolean
  /** Mirror the glyph top–bottom (`scaleY(-1)` in UI; canvas billboards match). */
  flipVertical?: boolean
}

export type ItemDef = {
  id: ItemDefId
  name: string
  icon: ItemEmojiIcon | { kind: 'sprite'; path: string }
  tags: Array<
    | 'food'
    | 'weapon'
    | 'container'
    | 'material'
    | 'quest'
    | 'tool'
    | 'hat'
    | 'oneHand'
    | 'twoHand'
    | 'remedy'
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
  feed?: {
    hunger: number
    thirst?: number
    stamina?: number
    hp?: number
    /** When true, portrait toast highlights this item as a deliberate stamina snack (see stamina economy). */
    primaryStamina?: boolean
    statusChances?: Array<{ status: StatusEffectId; pct: number; onlySpecies?: Species }>
    /** After feeding one unit, add this empty container (merge stack if one exists in inventory). */
    leaveEmptyAs?: ItemDefId
  }
  useOnPoi?: Partial<Record<PoiKind, ItemPoiUseHook>>
  /** Combat-only: drag onto acting PC portrait hands during encounter to apply Fire resist for `shieldTurns` of that PC’s turns. */
  combatShield?: {
    fireResistBonusPct: number
    staminaCost: number
    shieldTurns: number
    consumesOnUse: true
  }
  playerLight?: PlayerLightTag
  /** When set, instances track `InventoryItem.durability` and can break at 0. */
  durabilityMax?: number
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

