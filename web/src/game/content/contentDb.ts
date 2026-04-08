import type { EquipmentSlot, ItemDefId, PoiKind, Species, StatusEffectId } from '../types'
import { DEFAULT_ITEMS } from './items'
import { DEFAULT_STATUSES } from './statuses'

export type ItemDef = {
  id: ItemDefId
  name: string
  icon: { kind: 'emoji'; value: string } | { kind: 'sprite'; path: string }
  tags: Array<'food' | 'weapon' | 'container' | 'material' | 'quest' | 'tool'>
  equipSlots?: EquipmentSlot[]
  feed?: { hunger: number; thirst?: number; stamina?: number; hp?: number; statusChances?: Array<{ status: StatusEffectId; pct: number; onlySpecies?: Species }> }
  useOnPoi?: Partial<Record<PoiKind, { transformTo?: ItemDefId; toast?: string }>>
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

