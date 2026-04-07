import type { FloorGenOutput, MissionGraph, MissionGraphEdge, MissionGraphNode } from './types'
import { bfsDistances, shortestPathLatticeStats } from './validate'

const POI_KIND_ORDER: Record<string, number> = { Well: 0, Bed: 1, Chest: 2 }

/** Serializes progression anchors (POIs, locks, keys) for debug and future mission logic. */
export function buildMissionGraph(gen: FloorGenOutput): MissionGraph {
  const nodes: MissionGraphNode[] = [
    { id: 'mission_entrance', role: 'Entrance', pos: { ...gen.entrance } },
    { id: 'mission_exit', role: 'Exit', pos: { ...gen.exit } },
  ]
  const edges: MissionGraphEdge[] = []

  const w = gen.meta.w
  const h = gen.meta.h
  const dist = bfsDistances(gen.tiles, w, h, gen.entrance)

  const missionPois = gen.pois.filter((p) => p.kind === 'Well' || p.kind === 'Bed' || p.kind === 'Chest')
  const sortedPois = [...missionPois].sort((a, b) => {
    const ia = a.pos.x + a.pos.y * w
    const ib = b.pos.x + b.pos.y * w
    const da = ia >= 0 && ia < dist.length ? dist[ia] : -1
    const db = ib >= 0 && ib < dist.length ? dist[ib] : -1
    if (da !== db) return da - db
    const oa = POI_KIND_ORDER[a.kind] ?? 9
    const ob = POI_KIND_ORDER[b.kind] ?? 9
    if (oa !== ob) return oa - ob
    return a.id.localeCompare(b.id)
  })

  let chainFrom = 'mission_entrance'
  for (const p of sortedPois) {
    const id = `mission_${p.kind}_${p.id}`
    nodes.push({
      id,
      role: p.kind === 'Well' ? 'Well' : p.kind === 'Bed' ? 'Bed' : 'Chest',
      pos: { ...p.pos },
      poiId: p.id,
    })
    edges.push({ fromId: chainFrom, toId: id, kind: 'path' })
    chainFrom = id
  }

  const locks = gen.doors.filter((d) => d.locked && d.lockId).sort((a, b) => (a.orderOnPath ?? 0) - (b.orderOnPath ?? 0))
  for (const d of locks) {
    const lk = `mission_lock_${d.lockId}`
    nodes.push({ id: lk, role: 'LockGate', pos: { ...d.pos }, lockId: d.lockId })
    const keyIt = gen.floorItems.find((it) => it.forLockId === d.lockId)
    if (keyIt) {
      const ky = `mission_key_${d.lockId}`
      nodes.push({
        id: ky,
        role: 'KeyPickup',
        pos: { ...keyIt.pos },
        lockId: d.lockId,
        itemDefId: keyIt.defId,
      })
      edges.push({ fromId: chainFrom, toId: ky, kind: 'path' })
    }
    edges.push({ fromId: chainFrom, toId: lk, kind: 'locked', lockId: d.lockId })
    chainFrom = lk
  }
  edges.push({ fromId: chainFrom, toId: 'mission_exit', kind: 'path' })

  const { shortestLen: L, latticeCells } = shortestPathLatticeStats(gen.tiles, w, h, gen.entrance, gen.exit)
  const hasAlternateEntranceExitRoute = L >= 3 && latticeCells > L + 2
  if (hasAlternateEntranceExitRoute) {
    edges.push({ fromId: 'mission_entrance', toId: 'mission_exit', kind: 'shortcut' })
  }

  return { nodes, edges, hasAlternateEntranceExitRoute }
}
