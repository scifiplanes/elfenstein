/**
 * Mission-first dungeon generation (abstract progression graph before grid embedding).
 * See `Dungeon_generation_plan_summary.md` and DESIGN.md §8.4.
 *
 * **Palace v1:** `planMissionBeforeGeometry` returns a linear `PlannedMission` for
 * `floorType === 'Palace'`; locks follow `targetLockCount` in `placeLocksOnPath`.
 * Ruins stamp↔node embedding remains future work.
 */
import type { Rng } from './seededRng'
import type {
  FloorGenDifficulty,
  FloorGenInput,
  FloorGenOutput,
  PalacePlannedMissionTemplateId,
  PlannedMission,
  PlannedMissionEdge,
  PlannedMissionNode,
} from './types'
import { normalizeFloorGenDifficulty } from './types'

export type {
  PalacePlannedMissionTemplateId,
  PlannedMission,
  PlannedMissionEdge,
  PlannedMissionNode,
  PlannedMissionNodeRole,
} from './types'

function palaceTemplateSpine(): PlannedMission {
  const nodes: PlannedMissionNode[] = [
    { id: 'n_e', role: 'Entrance' },
    { id: 'n_x', role: 'Exit' },
  ]
  const edges: PlannedMissionEdge[] = [{ fromId: 'n_e', toId: 'n_x', kind: 'walk' }]
  return { templateId: 'palace_spine', nodes, edges }
}

function palaceTemplateSealA(): PlannedMission {
  const nodes: PlannedMissionNode[] = [
    { id: 'n_e', role: 'Entrance' },
    { id: 'n_ka', role: 'KeyPickup', lockId: 'A' },
    { id: 'n_ga', role: 'LockGate', lockId: 'A' },
    { id: 'n_x', role: 'Exit' },
  ]
  const edges: PlannedMissionEdge[] = [
    { fromId: 'n_e', toId: 'n_ka', kind: 'walk' },
    { fromId: 'n_ka', toId: 'n_ga', kind: 'walk' },
    { fromId: 'n_ga', toId: 'n_x', kind: 'gated', lockId: 'A' },
  ]
  return { templateId: 'palace_seal_a', nodes, edges }
}

function palaceTemplateSealAb(): PlannedMission {
  const nodes: PlannedMissionNode[] = [
    { id: 'n_e', role: 'Entrance' },
    { id: 'n_ka', role: 'KeyPickup', lockId: 'A' },
    { id: 'n_ga', role: 'LockGate', lockId: 'A' },
    { id: 'n_kb', role: 'KeyPickup', lockId: 'B' },
    { id: 'n_gb', role: 'LockGate', lockId: 'B' },
    { id: 'n_x', role: 'Exit' },
  ]
  const edges: PlannedMissionEdge[] = [
    { fromId: 'n_e', toId: 'n_ka', kind: 'walk' },
    { fromId: 'n_ka', toId: 'n_ga', kind: 'walk' },
    { fromId: 'n_ga', toId: 'n_kb', kind: 'gated', lockId: 'A' },
    { fromId: 'n_kb', toId: 'n_gb', kind: 'walk' },
    { fromId: 'n_gb', toId: 'n_x', kind: 'gated', lockId: 'B' },
  ]
  return { templateId: 'palace_seal_ab', nodes, edges }
}

function pickPalaceTemplateId(difficulty: FloorGenDifficulty, rng: Rng): PalacePlannedMissionTemplateId {
  const r = rng.next()
  if (difficulty === 0) {
    if (r < 0.5) return 'palace_spine'
    if (r < 0.85) return 'palace_seal_a'
    return 'palace_seal_ab'
  }
  if (difficulty === 2) {
    if (r < 0.2) return 'palace_spine'
    if (r < 0.55) return 'palace_seal_a'
    return 'palace_seal_ab'
  }
  if (r < 0.35) return 'palace_spine'
  if (r < 0.7) return 'palace_seal_a'
  return 'palace_seal_ab'
}

function missionForTemplateId(id: PalacePlannedMissionTemplateId): PlannedMission {
  if (id === 'palace_spine') return palaceTemplateSpine()
  if (id === 'palace_seal_a') return palaceTemplateSealA()
  return palaceTemplateSealAb()
}

/** BFS: traverse `walk` always; traverse `gated` only if `openLocks` contains that edge's `lockId`. */
function reachableWithOpenLocks(
  plan: PlannedMission,
  startId: string,
  goalId: string,
  openLocks: Set<string>,
): boolean {
  const adj = new Map<string, PlannedMissionEdge[]>()
  for (const e of plan.edges) {
    const list = adj.get(e.fromId) ?? []
    list.push(e)
    adj.set(e.fromId, list)
  }
  for (const list of adj.values()) list.sort((a, b) => a.toId.localeCompare(b.toId))

  const q: string[] = [startId]
  const seen = new Set<string>([startId])
  for (let qi = 0; qi < q.length; qi++) {
    const cur = q[qi]!
    if (cur === goalId) return true
    for (const e of adj.get(cur) ?? []) {
      if (e.kind === 'gated') {
        const L = e.lockId
        if (!L || !openLocks.has(L)) continue
      }
      if (seen.has(e.toId)) continue
      seen.add(e.toId)
      q.push(e.toId)
    }
  }
  return false
}

/** Ordered lock ids as first encountered along gated edges on the unique Entrance→Exit path. */
function lockOrderOnPlannedPath(plan: PlannedMission): string[] | null {
  const ent = plan.nodes.find((n) => n.role === 'Entrance')
  const ex = plan.nodes.find((n) => n.role === 'Exit')
  if (!ent || !ex) return null

  const byFrom = new Map<string, PlannedMissionEdge[]>()
  for (const e of plan.edges) {
    const list = byFrom.get(e.fromId) ?? []
    list.push(e)
    byFrom.set(e.fromId, list)
  }
  for (const list of byFrom.values()) list.sort((a, b) => a.toId.localeCompare(b.toId))

  const order: string[] = []
  const seen = new Set<string>([ent.id])
  let cur = ent.id
  while (cur !== ex.id) {
    const outs = byFrom.get(cur) ?? []
    if (outs.length !== 1) return null
    const e = outs[0]!
    if (e.kind === 'gated' && e.lockId) order.push(e.lockId)
    if (seen.has(e.toId)) return null
    seen.add(e.toId)
    cur = e.toId
  }
  return order
}

/**
 * Validates abstract lock/key ordering: each key is reachable before its gate opens;
 * exit unreachable with no keys; exit reachable with all keys.
 */
export function validatePlannedMission(plan: PlannedMission): boolean {
  const ent = plan.nodes.find((n) => n.role === 'Entrance')
  const ex = plan.nodes.find((n) => n.role === 'Exit')
  if (!ent || !ex) return false

  const lockOrder = lockOrderOnPlannedPath(plan)
  if (lockOrder === null) return false

  const hasGates = lockOrder.length > 0
  const exitReachNoKeys = reachableWithOpenLocks(plan, ent.id, ex.id, new Set())

  if (hasGates && exitReachNoKeys) return false
  if (!hasGates && !exitReachNoKeys) return false
  if (!hasGates) return true

  const open = new Set<string>()
  for (const L of lockOrder) {
    const keyNode = plan.nodes.find((n) => n.role === 'KeyPickup' && n.lockId === L)
    if (!keyNode) return false
    if (!reachableWithOpenLocks(plan, ent.id, keyNode.id, open)) return false
    open.add(L)
  }

  return reachableWithOpenLocks(plan, ent.id, ex.id, open)
}

export function plannedMissionTargetLockCount(plan: PlannedMission): 0 | 1 | 2 {
  const gated = plan.edges.filter((e) => e.kind === 'gated')
  const ids = [...new Set(gated.map((e) => e.lockId).filter((x): x is string => Boolean(x)))]
  if (ids.length === 0) return 0
  if (ids.length === 1) return 1
  return 2
}

export function validatePlannedMissionRealized(gen: FloorGenOutput, plan: PlannedMission): boolean {
  const target = plannedMissionTargetLockCount(plan)
  const locked = gen.doors.filter((d) => d.locked && d.lockId).sort((a, b) => (a.orderOnPath ?? 0) - (b.orderOnPath ?? 0))
  if (locked.length !== target) return false

  const keys = gen.floorItems.filter((it) => it.forLockId)
  if (target === 0) return keys.length === 0

  const expectedLocks = new Set(
    plan.edges.filter((e) => e.kind === 'gated').map((e) => e.lockId).filter((x): x is string => Boolean(x)),
  )
  if (expectedLocks.size !== target) return false

  for (const d of locked) {
    if (!d.lockId || !expectedLocks.has(d.lockId)) return false
    const k = keys.find((it) => it.forLockId === d.lockId)
    if (!k) return false
  }
  return true
}

/**
 * Linear node ids from Entrance to Exit (inclusive). Null if not a simple path.
 */
export function plannedLinearPathNodeIds(plan: PlannedMission): string[] | null {
  const ent = plan.nodes.find((n) => n.role === 'Entrance')
  const ex = plan.nodes.find((n) => n.role === 'Exit')
  if (!ent || !ex) return null

  const byFrom = new Map<string, PlannedMissionEdge[]>()
  for (const e of plan.edges) {
    const list = byFrom.get(e.fromId) ?? []
    list.push(e)
    byFrom.set(e.fromId, list)
  }
  for (const list of byFrom.values()) list.sort((a, b) => a.toId.localeCompare(b.toId))

  const out: string[] = [ent.id]
  const seen = new Set<string>([ent.id])
  let cur = ent.id
  while (cur !== ex.id) {
    const outs = byFrom.get(cur) ?? []
    if (outs.length !== 1) return null
    const e = outs[0]!
    if (seen.has(e.toId)) return null
    seen.add(e.toId)
    out.push(e.toId)
    cur = e.toId
  }
  return out
}

/**
 * Runs on `streams.mission` RNG (see `FloorGenMeta.streams`). Returning `null` keeps the
 * current geometry-first order; callers should still construct `missionRng` so the stream
 * stays phase-stable when this begins emitting plans.
 */
export function planMissionBeforeGeometry(input: FloorGenInput, rng: Rng): PlannedMission | null {
  if (input.floorType !== 'Palace') return null
  const difficulty = normalizeFloorGenDifficulty(input.difficulty)
  const tid = pickPalaceTemplateId(difficulty, rng)
  const plan = missionForTemplateId(tid)
  return validatePlannedMission(plan) ? plan : palaceTemplateSpine()
}
