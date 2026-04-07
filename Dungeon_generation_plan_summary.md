# Dungeon generation plan (summary)

This document summarizes the intended dungeon-generation pipeline for Elfenstein, based on the design notes in `Elfenstein_notes.md`.

## Goals
- **Deterministic** (seeded) output suitable for future host-synced multiplayer.
- Support **Floor Types**: `Ruins`, `Dungeon`, `Cave` and **Floor Properties**: `Infested`, `Cursed`, `Destroyed`, `Overgrown`, `None`.
- Guarantee **playability**: connectivity, entrance/exit present, valid key/lock gating, reasonable pacing (early safety).
- Produce rich **tags** (room + region) to drive NPC/POI/item spawn tables.

## Pipeline (phased)
- **Phase 0 — Seed + inputs**
  - Inputs: `worldSeed`, `floorIndex`, `floorType`, `floorProperties[]`, difficulty knobs.
  - Use **phase-separated RNG streams** (layout/locks/tags/population) so changes don’t ripple unpredictably.

- **Phase 1 — Mission graph (progression first)**
  - Build an abstract graph with required nodes: `Entrance`, `Exit`, `Key(A)`, `Lock(A)` (repeatable A/B/…).
  - Optional nodes: `Well`, `Bed`, `ChestCluster`, `NPCQuest`, `Boss`, `Treasure`.
  - Enforce pacing: at least one safety POI (`Well`/`Bed`) within N steps, bounded critical-path length, at least one loop/shortcut.

- **Phase 2 — Lock graph (formal gating correctness)**
  - Place locks on edges and keys on reachable nodes.
  - Validate: `Key(A)` reachable without passing `Lock(A)`.
  - Ensure “backtracking relief” (shortcut/loop after acquiring a key).

- **Phase 3 — Geometry realization (per Floor Type)**
  - Embed the abstract graph into a **grid layout** (rooms + corridors) using a floor-type-specific realizer:
    - `Dungeon`: maze/loop backbone + “room inflation” at mission nodes.
    - `Ruins`: chunk (macro-tile) stitching + rubble/detailing pass.
    - `Cave`: digger agents for organic tunnels + chamber widening for mission nodes.
  - Always run **connectivity repair** (connect components) and corridor routing constraints.

- **Phase 4 — Region/district overlay (recommended)**
  - Partition into 3–6 districts (Voronoi/flood-fill) like `WorkshopWing`, `HabitatWing`, `StorageWing`, `CollapsedZone`.
  - Districts bias both **visual theming** and **tag/spawn distributions**.

- **Phase 5 — Tagging as a constraint solve**
  - Assign per-room tags:
    - `roomFunction`: `Passage`, `Habitat`, `Workshop`, `Communal`, `Storage`
    - `roomProperties`: `Burning`, `Flooded`, `Infected`
    - `roomStatus`: `Overgrown`, `Destroyed`, `Collapsed`
  - Apply quotas + adjacency rules (e.g., `Flooded` clusters near sources; `Storage` prefers dead-ends; floor properties bias frequencies).

- **Phase 6 — Population pass (tables driven by tags)**
  - Place POIs (`Well`, `Chest`, `Bed`), NPCs, items, doors/keys, torches using tables indexed by:
    - `floorType`, `floorProperties[]`, `districtTag`, `roomFunction`, `roomProperties`, `roomStatus`, plus mission-node role.
  - Use `Burning/Flooded/Infected` as **optional “soft gates”** that reward preparation/crafting.

- **Phase 7 — Validation + scoring**
  - Hard validations: connectedness (or all key content reachable), solvable `Entrance→Exit` respecting locks, no key behind its own lock.
  - Soft scoring (for rerolling during gen): loop count, dead-end ratio, corridor density, room size distribution, distance-to-safety metrics.

- **Phase 8 — Debuggability**
  - Debug UI hooks: show seed + regen, overlays (mission nodes, locks/keys, districts, room tags), connectivity heatmap, dump JSON output.

## Minimal data model (to standardize early)
- `FloorGenInput`: seed, floorIndex, floorType, properties, difficulty (`0`/`1`/`2` easy/normal/hard; see DESIGN §8.1).
- `MissionGraph`: typed nodes + typed edges (normal/locked/shortcut).
- `Tilemap`: grid of `Wall/Floor/Door/Pit/POI/NPCSpawn`.
- `Room`: id, cells/bounds, size, room tags, mission-node role.
- `SpawnRequest`: placement requests carrying tag context for table lookup.

## Build order (recommended)
- Implement Phases **1–3** for `Dungeon` floors first (exercises keys/doors + pacing).
- Add Phase **5** tagging next (even a greedy solver is enough to start).
- Add `Cave` (diggers) and `Ruins` (chunk stitching) realizers afterward.

## Acceptance criteria
- Same inputs always produce identical outputs.
- Keys/doors always valid and include at least one shortcut/loop to reduce tedious backtracking.
- Floor properties visibly change room tags and spawn outcomes.
- No unreachable POIs or soft-locks.

