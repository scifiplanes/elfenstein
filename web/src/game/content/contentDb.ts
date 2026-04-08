import type { EquipmentSlot, ItemDefId, PoiKind, Species, StatusEffectId } from '../types'

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
      items: [
        {
          id: 'Mushrooms',
          name: 'Mushrooms',
          icon: { kind: 'emoji', value: '🍄' },
          tags: ['food'],
          feed: {
            hunger: 18,
            stamina: 6,
            hp: 4,
            statusChances: [
              { status: 'Blessed', pct: 4, onlySpecies: 'Mycyclops' },
              { status: 'Sick', pct: 6 },
            ],
          },
        },
        { id: 'Foodroot', name: 'Foodroot', icon: { kind: 'emoji', value: '🥕' }, tags: ['food'], feed: { hunger: 24, stamina: 6, hp: 10 } },
        { id: 'WaterbagEmpty', name: 'Waterbag (Empty)', icon: { kind: 'emoji', value: '🫙' }, tags: ['container'], useOnPoi: { Well: { transformTo: 'WaterbagFull', toast: 'Filled the waterbag.' } } },
        { id: 'WaterbagFull', name: 'Waterbag (Full)', icon: { kind: 'emoji', value: '💧' }, tags: ['container', 'food'], feed: { hunger: 0, thirst: 30 } },
        { id: 'Stone', name: 'Stone', icon: { kind: 'emoji', value: '🪨' }, tags: ['material', 'weapon'], equipSlots: ['handLeft', 'handRight'] },
        { id: 'Stick', name: 'Stick', icon: { kind: 'emoji', value: '🪵' }, tags: ['material', 'weapon'], equipSlots: ['handLeft', 'handRight'] },
        { id: 'Club', name: 'Club', icon: { kind: 'emoji', value: '🏏' }, tags: ['weapon'], equipSlots: ['handLeft', 'handRight'] },
        { id: 'Spear', name: 'Spear', icon: { kind: 'emoji', value: '🗡️' }, tags: ['weapon'], equipSlots: ['handLeft', 'handRight'] },
        { id: 'IronKey', name: 'Iron key', icon: { kind: 'emoji', value: '🗝️' }, tags: ['quest'] },
        { id: 'BrassKey', name: 'Brass key', icon: { kind: 'emoji', value: '🗝️' }, tags: ['quest'] },
        // Remedies are edible so `feedCharacter` can apply cure effects then consume.
        { id: 'BandageStrip', name: 'Bandage strip', icon: { kind: 'emoji', value: '🩹' }, tags: ['food'], feed: { hunger: 0 } },
        { id: 'AntitoxinVial', name: 'Antitoxin vial', icon: { kind: 'emoji', value: '🧪' }, tags: ['food'], feed: { hunger: 0 } },
        { id: 'HerbPoultice', name: 'Herb poultice', icon: { kind: 'emoji', value: '🌿' }, tags: ['food'], feed: { hunger: 0 } },
        { id: 'ClothScrap', name: 'Cloth scrap', icon: { kind: 'emoji', value: '🧵' }, tags: ['material'] },
        { id: 'Twine', name: 'Twine', icon: { kind: 'emoji', value: '🪢' }, tags: ['material', 'tool'] },
        { id: 'HerbLeaf', name: 'Herb leaf', icon: { kind: 'emoji', value: '🍃' }, tags: ['material'] },
        { id: 'BitterHerb', name: 'Bitter herb', icon: { kind: 'emoji', value: '🌱' }, tags: ['material'] },
        { id: 'GlassVial', name: 'Glass vial', icon: { kind: 'emoji', value: '🧴' }, tags: ['material', 'container'] },
        { id: 'Chisel', name: 'Chisel', icon: { kind: 'emoji', value: '🪓' }, tags: ['tool'] },
        { id: 'StoneShard', name: 'Stone shard', icon: { kind: 'emoji', value: '🪨' }, tags: ['tool', 'weapon'], equipSlots: ['handLeft', 'handRight'] },
        { id: 'Ash', name: 'Ash', icon: { kind: 'emoji', value: '⚫️' }, tags: ['material'] },
        { id: 'Sulfur', name: 'Sulfur', icon: { kind: 'emoji', value: '🟡' }, tags: ['material'] },
        { id: 'Firebolt', name: 'Firebolt', icon: { kind: 'emoji', value: '🔥' }, tags: ['weapon'] },
        { id: 'Fireshield', name: 'Fireshield', icon: { kind: 'emoji', value: '🛡️' }, tags: ['tool'] },
        { id: 'Sling', name: 'Sling', icon: { kind: 'emoji', value: '🪃' }, tags: ['weapon', 'tool'], equipSlots: ['handLeft', 'handRight'] },
        { id: 'Bolas', name: 'Bolas', icon: { kind: 'emoji', value: '🪢' }, tags: ['weapon', 'tool'], equipSlots: ['handLeft', 'handRight'] },
        { id: 'Bow', name: 'Bow', icon: { kind: 'emoji', value: '🏹' }, tags: ['weapon', 'tool'], equipSlots: ['handLeft', 'handRight'] },
        { id: 'MortarMeal', name: 'Mortar meal', icon: { kind: 'emoji', value: '🥣' }, tags: ['food'], feed: { hunger: 12, stamina: 4 } },
        { id: 'Flourball', name: 'Flourball', icon: { kind: 'emoji', value: '🍞' }, tags: ['food'], feed: { hunger: 22, stamina: 8, hp: 4 } },
        { id: 'HerbTea', name: 'Herb tea', icon: { kind: 'emoji', value: '🫖' }, tags: ['food', 'container'], feed: { hunger: 0, thirst: 18, stamina: 3 } },

        // Hive/Swarm ecosystem (Elfenstein_notes).
        { id: 'Hive', name: 'Hive', icon: { kind: 'emoji', value: '🪺' }, tags: ['tool'] },
        { id: 'SwarmQueen', name: 'Swarm Queen', icon: { kind: 'emoji', value: '👑' }, tags: ['quest'] },
        { id: 'SwarmBasket', name: 'Swarm basket', icon: { kind: 'emoji', value: '🧺' }, tags: ['tool'] },
        { id: 'CapturedSwarm', name: 'Captured swarm', icon: { kind: 'emoji', value: '🫧' }, tags: ['tool'] },
      ],
      statuses: [
        { id: 'Poisoned', name: 'Poisoned', kind: 'negative', defaultDurationMs: 30_000 },
        { id: 'Blessed', name: 'Blessed', kind: 'positive', defaultDurationMs: 45_000 },
        { id: 'Sick', name: 'Sick', kind: 'negative', defaultDurationMs: 30_000 },
        { id: 'Bleeding', name: 'Bleeding', kind: 'negative', defaultDurationMs: 25_000 },
        { id: 'Burning', name: 'Burning', kind: 'negative', defaultDurationMs: 12_000 },
        { id: 'Drenched', name: 'Drenched', kind: 'neutral', defaultDurationMs: 12_000 },
        { id: 'Drowsy', name: 'Drowsy', kind: 'negative', defaultDurationMs: 18_000 },
        { id: 'Focused', name: 'Focused', kind: 'positive', defaultDurationMs: 20_000 },
        { id: 'Cursed', name: 'Cursed', kind: 'negative' },
        { id: 'Frightened', name: 'Frightened', kind: 'negative', defaultDurationMs: 14_000 },
        { id: 'Rooted', name: 'Rooted', kind: 'negative', defaultDurationMs: 7_000 },
        { id: 'Shielded', name: 'Shielded', kind: 'positive', defaultDurationMs: 12_000 },
        { id: 'Starving', name: 'Starving', kind: 'negative' },
        { id: 'Dehydrated', name: 'Dehydrated', kind: 'negative' },
      ],
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

