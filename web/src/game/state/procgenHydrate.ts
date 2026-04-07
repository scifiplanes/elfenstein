import type { GameState } from '../types'
import { makeDropJitter } from './dropJitter'

export function hydrateGenFloorItems(
  render: Pick<GameState['render'], 'dropJitterRadius'>,
  floorItems: Array<{ defId: string; pos: { x: number; y: number }; qty?: number }>,
  floorSeed: number,
): { spawnedItems: GameState['party']['items']; spawnedOnFloor: GameState['floor']['itemsOnFloor'] } {
  if (!floorItems.length) return { spawnedItems: {}, spawnedOnFloor: [] }
  const spawnedItems: GameState['party']['items'] = {}
  const spawnedOnFloor: GameState['floor']['itemsOnFloor'] = []
  for (let i = 0; i < floorItems.length; i++) {
    const it = floorItems[i]
    const id = `g_${floorSeed}_${it.defId}_${it.pos.x}_${it.pos.y}_${i}`
    spawnedItems[id] = { id, defId: it.defId, qty: it.qty ?? 1 }
    const jitter = makeDropJitter({
      floorSeed,
      itemId: id,
      nonce: 0,
      radius: render.dropJitterRadius ?? 0.28,
    })
    spawnedOnFloor.push({ id, pos: { x: it.pos.x, y: it.pos.y }, jitter })
  }
  return { spawnedItems, spawnedOnFloor }
}

export function snapViewToGrid(
  w: number,
  h: number,
  camEyeHeight: number,
  playerPos: { x: number; y: number },
  playerDir: 0 | 1 | 2 | 3,
): GameState['view'] {
  return {
    camPos: {
      x: playerPos.x - w / 2,
      y: camEyeHeight,
      z: playerPos.y - h / 2,
    },
    camYaw: (playerDir * Math.PI) / 2,
    anim: undefined,
  }
}
