import type { FloorType } from '../../procgen/types'
import type { NpcKind, PoiKind } from '../../game/types'

/** Base ambient loops — one per floor type, looped indefinitely. */
export const BG_NOISE_TRACKS: Record<FloorType, string> = {
  Dungeon: '/sounds/music/bg_noise_1.mp3',
  Cave:    '/sounds/music/bg_noise_2.mp3',
  Ruins:   '/sounds/music/bg_noise_3.mp3',
}

/** Short label for each bg track (for the debug menu). */
export const BG_NOISE_LABELS: Record<string, string> = {
  '/sounds/music/bg_noise_1.mp3': 'bg_noise_1 (Dungeon)',
  '/sounds/music/bg_noise_2.mp3': 'bg_noise_2 (Cave)',
  '/sounds/music/bg_noise_3.mp3': 'bg_noise_3 (Ruins)',
}

/** Random ambient SFX played occasionally in the background. */
export const BG_SFX_TRACKS = [
  '/sounds/music/creak_1.mp3',
]

/**
 * An overlay track that fades in/out based on proximity to a matching NPC or POI.
 * Multiple overlays can play simultaneously, each at an independent volume.
 */
export type ProximityOverlay = {
  track: string
  /** NPC names (npc.name) that trigger this overlay. */
  npcNames?: string[]
  /** NPC kinds (npc.kind) that trigger this overlay. */
  npcKinds?: NpcKind[]
  /** POI kinds (poi.kind) that trigger this overlay. */
  poiKinds?: PoiKind[]
  /** Manhattan distance at which the overlay reaches full volume. */
  fullDist: number
  /** Manhattan distance at which the overlay fades to silence. */
  zeroDist: number
}

/**
 * All proximity-based overlay tracks.
 * Add entries here to give any NPC or POI its own ambient sound layer.
 */
export const PROXIMITY_OVERLAYS: ProximityOverlay[] = [
  {
    track: '/sounds/music/safe_haven_loop.mp3',
    npcNames: ['Bobr'],
    fullDist: 0.5,
    zeroDist: 3,
  },
  {
    track: '/sounds/music/chant_1.mp3',
    poiKinds: ['Shrine'],
    fullDist: 1,
    zeroDist: 4,
  },
]

/** Flat list of every music URL — used to preload all tracks up front. */
export const ALL_MUSIC_TRACKS = [
  ...Object.values(BG_NOISE_TRACKS),
  ...new Set(PROXIMITY_OVERLAYS.map((o) => o.track)),
]

