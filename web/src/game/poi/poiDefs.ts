import type { PoiKind } from '../types'

/** POI kinds that use PNG billboards in `WorldRenderer` (excludes emoji-only POIs). */
export type PoiBitmapSpriteKind = Exclude<PoiKind, 'KuratkoNest' | 'Campfire' | 'CrackedWall'>

/** Filled well base (with water). */
export const POI_WELL_FILLED_SRC = '/content/npc_well.png'
/** Dry well base after drawing water (no glow/sparkle stack). */
export const POI_WELL_DRAINED_SRC = '/content/npc_well_drained.png'

export const POI_CHEST_CLOSED_SRC = '/content/chest_closed.png'
export const POI_CHEST_OPEN_SRC = '/content/chest_open.png'

export const POI_BARREL_CLOSED_SRC = '/content/barrel_closed.png'
export const POI_BARREL_OPEN_SRC = '/content/barrel_open.png'

export const POI_CRATE_CLOSED_SRC = '/content/crate_closed.png'
export const POI_CRATE_OPEN_SRC = '/content/crate_open.png'

/** Kuratko nest POI in the 3D view (eggs remaining / not `opened`). */
export const POI_KURATKO_NEST_EMOJI_WITH_EGGS = '🪺'
/** Kuratko nest POI after the last egg (`opened`). */
export const POI_KURATKO_NEST_EMOJI_EMPTY = '🪹'

/** Player-placed campfire POI in the 3D view (temporary art until a dedicated billboard). */
export const POI_CAMPFIRE_EMOJI = '🔥'

/** Cracked-wall secret POI in the 3D view (temporary art until a dedicated billboard). */
export const POI_CRACKED_WALL_EMOJI = '🛘'

export const POI_SPRITE_SRC: Record<PoiBitmapSpriteKind, string> = {
  Well: POI_WELL_FILLED_SRC,
  Chest: POI_CHEST_CLOSED_SRC,
  Barrel: POI_BARREL_CLOSED_SRC,
  Crate: POI_CRATE_CLOSED_SRC,
  Bed: '/content/poi_bed.png',
  Shrine: '/content/shrine_gnome.png',
  Exit: '/content/stairs_down.png',
}

/** Optional open-frame override used when a POI has `opened: true`. */
export const POI_OPENED_SPRITE_SRC: Partial<Record<PoiBitmapSpriteKind, string>> = {
  Chest: POI_CHEST_OPEN_SRC,
  Barrel: POI_BARREL_OPEN_SRC,
  Crate: POI_CRATE_OPEN_SRC,
  Shrine: '/content/shrine_gnome_off.png',
}

/** Additive glow layer drawn above the main Well billboard (not pick targets). */
export const POI_WELL_GLOW_SRC = '/content/npc_well_glow.png'
export const POI_WELL_SPARKLE_FRAMES = [
  '/content/npc_well_sparkle_1.png',
  '/content/npc_well_sparkle_2.png',
  '/content/npc_well_sparkle_3.png',
] as const
