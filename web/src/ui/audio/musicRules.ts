import type { GameState } from '../../game/types'
import { BG_NOISE_TRACKS, PROXIMITY_OVERLAYS } from './musicTracks'

/**
 * Returns the URL of the base ambient loop for the current floor type.
 * Falls back to Dungeon if the type isn't mapped.
 */
export function selectBgTrack(state: GameState): string {
  return BG_NOISE_TRACKS[state.floor.floorType] ?? BG_NOISE_TRACKS.Dungeon
}

/**
 * Returns the target volume for every proximity overlay, based on the player's
 * distance to the nearest matching NPC or POI on the current floor.
 */
export function selectOverlays(state: GameState): Array<{ track: string; volume: number }> {
  return PROXIMITY_OVERLAYS.map((overlay) => {
    let minDist = Infinity

    if (overlay.npcNames || overlay.npcKinds) {
      for (const npc of state.floor.npcs) {
        if (overlay.npcNames?.includes(npc.name) || overlay.npcKinds?.includes(npc.kind)) {
          minDist = Math.min(minDist, manhattan(state.floor.playerPos, npc.pos))
        }
      }
    }

    if (overlay.poiKinds) {
      for (const poi of state.floor.pois) {
        if (overlay.poiKinds.includes(poi.kind)) {
          minDist = Math.min(minDist, manhattan(state.floor.playerPos, poi.pos))
        }
      }
    }

    const volume =
      minDist === Infinity
        ? 0
        : clamp01((overlay.zeroDist - minDist) / (overlay.zeroDist - overlay.fullDist))

    return { track: overlay.track, volume }
  })
}

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}
