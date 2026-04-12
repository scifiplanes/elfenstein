# Plan: Party-wide additive player light (single PointLight)

**Status:** planned (not implemented)  
**Related code:** `web/src/game/state/playerLight.ts`, `web/src/world/WorldRenderer.ts`, `web/src/game/tuningDefaults.ts`

## Goal

- Treat equipped `playerLight` items as **separate contributions** that **sum** across the **whole party**, instead of choosing one “strongest” kind.
- Each equipped instance should be **weaker** than the old single-winner tuning so stacking stays controllable.
- **Performance:** keep **one** primary equipped `PointLight` (`WorldRenderer`’s `lantern`). Do **not** add one light per item or multiple shadow-casting lights for equipment.

## Current behavior (baseline)

- `resolvePlayerCameraLightKind` picks one tag per character, then the party-wide **best** tag via `KIND_RANK` (lantern > headlamp > torch > glowbug > bare).
- `WorldRenderer.syncTuning` sets `this.lantern` intensity/distance from that **single** winner’s full tuning values.
- Glowbug scaling uses **party max** jar fill (`resolveGlowbugLightMultiplier`), not per-item contribution.

## Target behavior

1. **Sources:** Every party member × slots `handLeft`, `handRight`, `head`. Each equipped item with `playerLight` in `contentDb` is one summand.
2. **Intensity:**  
   `partialI = perTagBase × themeMult(tag) × globalIntensity × flicker × glowMul(thatItem)`  
   `totalI = Σ partialI`  
   If there are **no** summands, use **`bareLightIntensity` / `bareLightDistance`** (unchanged “no gear” path).
3. **Safety:** Apply `totalI = min(totalI, equippedLightIntensityCap)` after the sum (new `RenderTuning` field) so full party + many glowbug jars cannot wash the scene out.
4. **Distance (single light):** Combine per-source distances with a cheap rule — shipped behavior: **max(d) + √(Σ_rest d²)** (two sources = **sum**; more = between RSS and linear); the plan originally suggested **`max`** only.
5. **Headlamp attachment:** If **any** equipped source is a headlamp, parent the primary light on the camera; otherwise keep world-space offset from player + yaw (match current feel).
6. **Color / theme:** Keep a **single** tint path (theme intent + warm base); no extra lights for hue.

## Glowbugs

- Use **per inventory row:** raw **Glowbug** → multiplier `1`; **GlowbugJar** → `glowbugs` clamped to max (same cap as crafting).
- **Do not** use party-wide **max** jar count for summing; each equipped jar adds its own term.
- If many jars stack too hard, prefer **lower `glowbugIntensity`**, optional **sublinear** scaling per jar (e.g. `√glowbugs`), and rely on **`equippedLightIntensityCap`**.

## Default tuning rebalance

**Semantic change:** `heldTorchIntensity`, `equippedLanternIntensity`, `headlampIntensity`, and `glowbugIntensity` become **per equipped instance** bases (before party sum), not “full primary when this tag wins.”

**Illustrative first pass** (tune after playtest):

| Field | Current default | Proposed direction |
|--------|-----------------|-------------------|
| `equippedLanternIntensity` | 4.0 | ~**1.35** per lantern |
| `headlampIntensity` | 4.0 | ~**1.35** per headlamp |
| `heldTorchIntensity` | 1.0 | ~**0.38** per torch |
| `glowbugIntensity` | 0.45 | ~**0.10–0.12** per bug in that stack (with jar rules above) |
| `bareLightIntensity` / distance | 4 / 24 | **Unchanged** |
| Distances (lantern/headlamp/torch/glowbug) | as today | Optional slight reduction if `max(distance)` reads too large |

**New field:** `equippedLightIntensityCap` (e.g. **8–10**), applied after sum.

Update **`RenderTuning` comments** in `types.ts`, **`DEFAULT_RENDER`** in `tuningDefaults.ts`, reducer/default merge for new keys, and debug panel if these should be F2-tunable.

## Implementation touchpoints

| Area | Work |
|------|------|
| `playerLight.ts` | Aggregate party-wide partial intensities + distances + per-item glow; helper for “any headlamp equipped?”; deprecate or narrow `resolvePlayerCameraLightKind` / `resolveGlowbugLightMultiplier` for the old max-only use |
| `WorldRenderer.ts` | `syncTuning` / `syncScene`: drive `this.lantern` from aggregate; per summand may still need torch vs lantern **theme** multiplier |
| `playerLight.test.ts` | Sum behavior, per-jar terms, cap, bare fallback |
| `DESIGN.md` | Document party-wide sum + semantics of intensity fields once shipped |
| `DECISIONS.md` | ADR when behavior lands |

## Non-goals (performance)

- Multiple `PointLight`s for equipped items.
- Multiple shadow-casting lights for equipment.

## Acceptance checks

- One lantern: **dimmer** than old single-winner ~4.0 equivalent.
- Two or more sources (same or different characters): **brighter** than one source alone.
- Full party stacking: **bounded** when cap is enabled; no negative/NaN intensity.
- No equipped `playerLight` anywhere: same as current **bare** light.
