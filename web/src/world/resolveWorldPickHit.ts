import { isPassableOpenDoorTile } from '../game/tiles'
import type { Tile } from '../game/types'

/**
 * Choose which ray hit to use for 3D viewport targeting (clicks, hover, drag-drop).
 * Distance order is preserved in `hits` (closest first). Matches `THREE.Intersection` shape (`userData` on `object`).
 *
 * - Floor items win over everything else on the ray (loot in front of chests).
 * - Closed/locked door billboards block targets behind them.
 * - Passable open-door billboards do not block PoIs behind them (avoids bogus `player/step` onto PoI cells).
 * - Among passable open door vs NPC, the closer pick wins.
 */
export function resolveWorldPickHit<T extends { object: { userData: unknown } }>(
  hits: readonly T[],
  tiles: readonly Tile[],
  w: number,
): T | null {
  let firstDeferredNpcOrOpenDoor: T | null = null
  for (const hit of hits) {
    const ud = hit.object.userData as { kind?: unknown; id?: unknown }
    const kind = String(ud.kind ?? '')
    const id = ud.id == null ? '' : String(ud.id)
    if (!id) continue
    if (kind === 'floorItem') return hit
    if (kind === 'door') {
      const parts = id.split(',')
      const gx = Number(parts[0])
      const gy = Number(parts[1])
      let passableOpen = false
      if (Number.isFinite(gx) && Number.isFinite(gy)) {
        const idx = gx + gy * w
        if (idx >= 0 && idx < tiles.length) {
          passableOpen = isPassableOpenDoorTile(tiles[idx]!)
        }
      }
      if (!passableOpen) return hit
    }
    if (kind === 'poi') return hit
    if (kind === 'npc' || kind === 'door') {
      if (!firstDeferredNpcOrOpenDoor) firstDeferredNpcOrOpenDoor = hit
    }
  }
  return firstDeferredNpcOrOpenDoor
}
