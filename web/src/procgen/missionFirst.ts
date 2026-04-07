/**
 * Mission-first dungeon generation (abstract progression graph before grid embedding).
 * See `Dungeon_generation_plan_summary.md` and DESIGN.md §8.4.
 *
 * **Embedding contract (future):** When `planMissionBeforeGeometry` returns non-null,
 * floor-type realizers should reserve walkable mass so each planned node has a distinct
 * chamber or corridor junction (visit order = graph topological walk from Entrance),
 * then run locks/POIs to match planned LockGate/KeyPickup/Well/Bed/Chest roles.
 * The shipped pipeline in `generateDungeon.ts` remains geometry-first until that embed exists.
 *
 * ---
 * Track B specification (planned; not shipped)
 * ---
 *
 * **PlannedMission vs MissionGraph**
 * - `PlannedMission` (this module): abstract DAG before geometry — node ids, roles
 *   (`Entrance`, `Exit`, `LockGate`, `KeyPickup`, `Well`, `Bed`, `Chest`, `Wildcard`),
 *   edges labelled `walk` | `gated` + optional `lockId`. No grid positions.
 * - `MissionGraph` (`types.ts` / `missionGraph.ts`): *realized* graph after generation —
 *   same conceptual roles but every node carries `pos` (and optional `poiId` / `itemDefId`).
 *   Today it is built *post hoc* from tiles + POIs + doors. After Track B, positions must
 *   match embedded chambers; the graph may still add `shortcut` / `hasAlternateEntranceExitRoute`
 *   from lattice stats.
 *
 * **Formal plan validation (before any tile allocation)**
 * - Every `KeyPickup` for `lockId` L must be reachable from `Entrance` in the abstract
 *   graph without traversing a `gated` edge that requires L (mirror of `validateGen` lock order).
 * - `Exit` must not be reachable from `Entrance` until all `gated` edges are satisfied
 *   (ordering of lock discovery matches gameplay).
 * - Optional pacing: max graph distance to a `Well`/`Bed` node (analogous to BFS caps today).
 *
 * **Embedding strategy by floorType** (geometry-last)
 * - **Dungeon (`realizeDungeonBsp`)**: build a corridor spine matching planned edge order;
 *   inflate BSP leaves or carved rects at each mission node site before sibling L-stitch;
 *   entrance/exit cells chosen to align with `Entrance`/`Exit` nodes.
 * - **Cave (`realizeCave`)**: worm-carve backbone along abstract path; widen or blob-carve
 *   at each node; single `GenRoom` fallback must not swallow distinct node sites — either
 *   tag sub-chambers or run a secondary carve pass per node.
 * - **Ruins (`realizeRuins`)**: place macro-stamps so stamped chambers map 1:1 to mission
 *   nodes where possible; doorways between stamps follow planned edges; extra stamps only
 *   for filler loop geometry.
 *
 * **Downstream wiring**
 * - `placeLocksOnPath` becomes “place planned locks” (or validate that grid locks match
 *   plan) so `forLockId` / door order stay consistent with `PlannedMission`.
 * - `buildMissionGraph` should prefer copying plan structure + filling positions from the
 *   grid rather than the current entrance→POI BFS chain heuristic when a plan exists.
 *
 * **Schema**
 * - When embedding ships: bump `floor.gen.meta.genVersion`, add e.g. `meta.plannedMission`
 *   (JSON-serializable `PlannedMission`) for dumps and multiplayer sync debugging.
 *   Current shipped version uses `genVersion` 5 for difficulty meta only (see ADR-0105).
 *
 * ---
 */
import type { Rng } from './seededRng'
import type { FloorGenInput } from './types'

export type PlannedMissionNodeRole =
  | 'Entrance'
  | 'Exit'
  | 'LockGate'
  | 'KeyPickup'
  | 'Well'
  | 'Bed'
  | 'Chest'
  /** Placeholder for boss / quest / extra POI before roles are fixed in data. */
  | 'Wildcard'

export type PlannedMissionNode = {
  id: string
  role: PlannedMissionNodeRole
  /** For LockGate / KeyPickup pairs. */
  lockId?: string
}

export type PlannedMissionEdge = {
  fromId: string
  toId: string
  kind: 'walk' | 'gated'
  lockId?: string
}

export type PlannedMission = {
  nodes: PlannedMissionNode[]
  edges: PlannedMissionEdge[]
}

/**
 * Runs on `streams.mission` RNG (see `FloorGenMeta.streams`). Returning `null` keeps the
 * current geometry-first order; callers should still construct `missionRng` so the stream
 * stays phase-stable when this begins emitting plans.
 */
export function planMissionBeforeGeometry(_input: FloorGenInput, _rng: Rng): PlannedMission | null {
  return null
}
