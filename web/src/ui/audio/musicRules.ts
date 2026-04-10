import type { GameState } from '../../game/types'
import { BG_NOISE_TRACKS, PROXIMITY_OVERLAYS, TAVERN_TRACK, TITLE_THEME_TRACK, VILLAGE_TRACK } from './musicTracks'

/**
 * Returns the URL of the track that should loop as the primary background.
 * Title → menu theme; village hub → village loop; in-game → floor-type ambient.
 */
export function selectBgTrack(state: GameState): string {
  if (state.ui.screen === 'title') return TITLE_THEME_TRACK
  if (state.ui.screen === 'hub' && state.ui.hubScene === 'village') return VILLAGE_TRACK
  if (state.ui.screen === 'hub' && state.ui.hubScene === 'tavern') return TAVERN_TRACK
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
