import type { ContentDB } from '../content/contentDb'
import type { ItemDefId } from '../types'

/** Drag-to-smash: weapons (non-consuming) or Chisel; excludes torches/consumables-on-use. */
export function canItemBreakOpenDoor(content: ContentDB, defId: ItemDefId): boolean {
  if (defId === 'Chisel') return true
  const def = content.item(defId)
  if (!def.tags.includes('weapon')) return false
  if (def.weapon?.consumesOnUse) return false
  return true
}

/** Kuratko nest: poke/slash eggs loose or scatter an emptied nest (same rules as splintering an open door frame). */
export function canItemBreakKuratkoNest(content: ContentDB, defId: ItemDefId): boolean {
  return canItemBreakOpenDoor(content, defId)
}
