import type { PoiKind } from '../types'

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

export const POI_SPRITE_SRC: Record<PoiKind, string> = {
  Well: POI_WELL_FILLED_SRC,
  Chest: POI_CHEST_CLOSED_SRC,
  Barrel: POI_BARREL_CLOSED_SRC,
  Crate: POI_CRATE_CLOSED_SRC,
  Bed: '/content/poi_bed.png',
  Shrine: '/content/shrine_gnome.png',
  CrackedWall: '/content/poi_cracked_wall.png',
  Exit: '/content/stairs_down.png',
}

/** Optional open-frame override used when a POI has `opened: true`. */
export const POI_OPENED_SPRITE_SRC: Partial<Record<PoiKind, string>> = {
  Chest: POI_CHEST_OPEN_SRC,
  Barrel: POI_BARREL_OPEN_SRC,
  Crate: POI_CRATE_OPEN_SRC,
  Shrine: '/content/shrine_gnome_off.png',
}

/** Drawn behind / on top of the main Well billboard (not pick targets). */
export const POI_WELL_GLOW_SRC = '/content/npc_well_glow.png'
export const POI_WELL_SPARKLE_FRAMES = [
  '/content/npc_well_sparkle_1.png',
  '/content/npc_well_sparkle_2.png',
  '/content/npc_well_sparkle_3.png',
] as const
