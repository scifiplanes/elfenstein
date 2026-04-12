import type { ItemDefId } from '../types'
import { DEFAULT_ITEMS } from './items'

/** Item defs with **`hat`** tag and **`head`** equip slot (source of truth for portrait hat-band tuning). */
export const EQUIPPABLE_HAT_DEF_IDS: ItemDefId[] = [...DEFAULT_ITEMS]
  .filter((i) => i.tags.includes('hat') && Boolean(i.equipSlots?.includes('head')))
  .map((i) => i.id)
  .sort((a, b) => a.localeCompare(b))

const ALLOWED = new Set(EQUIPPABLE_HAT_DEF_IDS)

/** Percent of portrait frame height for the hat band; clamped **4–50** (default CSS band is **16%** when unset). */
export function clampPortraitHatSlotHeightPctByDefId(raw: unknown): Partial<Record<ItemDefId, number>> {
  const out: Partial<Record<ItemDefId, number>> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ALLOWED.has(k as ItemDefId)) continue
    if (typeof v !== 'number' || !Number.isFinite(v)) continue
    out[k as ItemDefId] = Math.max(4, Math.min(50, v))
  }
  return out
}

/** Additive **%** of portrait **width** (X) or **height** (Y) for the hat band position; clamped **−40..40** (CSS defaults **left 8%**, **top 0** when unset). */
export function clampPortraitHatOffsetPctByDefId(raw: unknown): Partial<Record<ItemDefId, number>> {
  const out: Partial<Record<ItemDefId, number>> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ALLOWED.has(k as ItemDefId)) continue
    if (typeof v !== 'number' || !Number.isFinite(v)) continue
    out[k as ItemDefId] = Math.max(-40, Math.min(40, v))
  }
  return out
}
