import type { FloorGenOutput, MissionGraph, MissionGraphEdge, MissionGraphNode } from './types'

/** Serializes progression anchors (POIs, locks, keys) for debug and future mission logic. */
export function buildMissionGraph(gen: FloorGenOutput): MissionGraph {
  const nodes: MissionGraphNode[] = [
    { id: 'mission_entrance', role: 'Entrance', pos: { ...gen.entrance } },
    { id: 'mission_exit', role: 'Exit', pos: { ...gen.exit } },
  ]
  const edges: MissionGraphEdge[] = []

  for (const p of gen.pois) {
    if (p.kind === 'Well' || p.kind === 'Bed' || p.kind === 'Chest') {
      const id = `mission_${p.kind}_${p.id}`
      nodes.push({ id, role: p.kind === 'Well' ? 'Well' : p.kind === 'Bed' ? 'Bed' : 'Chest', pos: { ...p.pos }, poiId: p.id })
      edges.push({ fromId: 'mission_entrance', toId: id, kind: 'path' })
    }
  }

  const locks = gen.doors.filter((d) => d.locked && d.lockId).sort((a, b) => (a.orderOnPath ?? 0) - (b.orderOnPath ?? 0))
  let chainFrom = 'mission_entrance'
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

  return { nodes, edges }
}
