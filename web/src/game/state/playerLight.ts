import type { ContentDB } from '../content/contentDb'
import { GLOWBUG_JAR_MAX_GLOWBUGS } from '../content/recipes'
import type { GameState, InventoryItem } from '../types'

const EQUIP_LIGHT_SLOTS = ['handLeft', 'handRight', 'head'] as const

/** Theme intensity multipliers from `getThemeLightIntent` (same as primary `PointLight` path). */
export type PartyPlayerLightThemeMults = {
  lanternIntensityMult: number
  torchIntensityMult: number
}

export type PartyPlayerLightAggregate = {
  summandCount: number
  anyHeadlamp: boolean
  /** True if any equipped row is **`playerLight: 'lantern'`** (not headlamp). */
  anyLantern: boolean
  /**
   * Σ (per-tag base × theme mult × per-row glowbug mult) for equipped `playerLight` rows.
   * Excludes `globalIntensity` and flicker (applied in `WorldRenderer.syncTuning`).
   */
  intensityBeforeGlobalFlicker: number
  /**
   * Single-light reach: **max(d)** + **√(Σ_rest d²)** over equipped sources (glowbug rows:
   * `glowbugDistance × sqrt(mul)` per source). Two sources ⇒ **d₁ + d₂**; larger parties stack
   * between RSS and a full linear sum.
   */
  combinedDistance: number
  /** Largest per-source reach among equipped `playerLight` rows (same **d** as in `combinedDistance`). */
  maxSourceDistance: number
  /** Max **`heldTorchDistance`** among equipped **torch** rows; **0** if none. */
  maxTorchHeldDistance: number
}

/**
 * Strongest source sets base reach; every other source adds √(Σ d²) on top.
 * For two positive distances this equals their **sum**.
 */
export function combinedPartyPlayerLightDistance(sourceDistances: readonly number[]): number {
  const n = sourceDistances.length
  if (n === 0) return 0
  if (n === 1) return sourceDistances[0]!
  let maxI = 0
  let maxD = sourceDistances[0]!
  for (let i = 1; i < n; i++) {
    const d = sourceDistances[i]!
    if (d > maxD) {
      maxD = d
      maxI = i
    }
  }
  let restSq = 0
  for (let i = 0; i < n; i++) {
    if (i === maxI) continue
    const d = sourceDistances[i]!
    restSq += d * d
  }
  return maxD + Math.sqrt(restSq)
}

/**
 * One merged `PointLight` uses summed intensity (clamped by cap) and `combinedPartyPlayerLightDistance`.
 * When the cap clips `rawIntensity` but distance still reflects every source, falloff stretches and the
 * near field looks **dimmer** than a single source at the same cap. Scale distance by `cap/raw` only when
 * multiple summands and `raw > cap` so local brightness stays in line with fewer lights.
 * **`WorldRenderer`** then clamps to **`maxSourceDistance`** so a second source cannot shrink reach below
 * the best single equipped source (e.g. torch + lantern under a tight cap was darker than torch alone).
 * When both **lantern** and **torch** are equipped, distance is also **capped** at **`maxTorchHeldDistance`**
 * so merged reach does not exceed **torch-only** falloff (larger **`PointLight.distance`** at the same cap
 * intensity thins near-field brightness in Three.js).
 */
export function effectiveMergedPlayerLightDistance(
  summandCount: number,
  combinedDistance: number,
  rawIntensity: number,
  intensityCap: number,
): number {
  if (combinedDistance <= 0 || rawIntensity <= 0) return combinedDistance
  if (summandCount <= 1 || rawIntensity <= intensityCap) return combinedDistance
  return combinedDistance * (intensityCap / rawIntensity)
}

/**
 * Glowbug jar uses clamped `glowbugs`; raw Glowbug item uses **1** (same rule as floor-item lights).
 */
export function glowbugMulForInventory(inv: InventoryItem): number {
  if (inv.defId === 'GlowbugJar') {
    return Math.max(1, Math.min(GLOWBUG_JAR_MAX_GLOWBUGS, inv.glowbugs ?? 1))
  }
  return 1
}

/**
 * Party-wide primary dungeon light: **sum** every equipped `playerLight` instance (all members × hands + head).
 * One `PointLight` in the renderer uses the aggregate; see `equippedLightIntensityCap` on `RenderTuning`.
 */
export function resolvePartyPlayerLightAggregate(
  state: GameState,
  content: ContentDB,
  theme: PartyPlayerLightThemeMults,
): PartyPlayerLightAggregate {
  const lanternM = theme.lanternIntensityMult
  const torchM = theme.torchIntensityMult
  const r = state.render

  let summandCount = 0
  let anyHeadlamp = false
  let anyLantern = false
  let maxTorchHeldDistance = 0
  let intensityBeforeGlobalFlicker = 0
  const sourceDistances: number[] = []

  for (const c of state.party.chars) {
    for (const slot of EQUIP_LIGHT_SLOTS) {
      const itemId = c.equipment[slot]
      if (!itemId) continue
      const inv = state.party.items[itemId]
      if (!inv) continue
      const tag = content.item(inv.defId).playerLight
      if (!tag) continue

      summandCount += 1
      switch (tag) {
        case 'torch': {
          intensityBeforeGlobalFlicker += r.heldTorchIntensity * torchM
          const td = r.heldTorchDistance
          sourceDistances.push(td)
          if (td > maxTorchHeldDistance) maxTorchHeldDistance = td
          break
        }
        case 'lantern': {
          anyLantern = true
          intensityBeforeGlobalFlicker += r.equippedLanternIntensity * lanternM
          sourceDistances.push(r.equippedLanternDistance)
          break
        }
        case 'headlamp': {
          anyHeadlamp = true
          // Themes often boost wall torches (`torchIntensityMult` > `lanternIntensityMult`); headlamp
          // should not read weaker than a held torch when `headlampIntensity` ≥ `heldTorchIntensity`.
          const headM = Math.max(lanternM, torchM)
          intensityBeforeGlobalFlicker += r.headlampIntensity * headM
          sourceDistances.push(r.headlampDistance)
          break
        }
        case 'glowbug': {
          const g = glowbugMulForInventory(inv)
          intensityBeforeGlobalFlicker += r.glowbugIntensity * lanternM * g
          sourceDistances.push(r.glowbugDistance * Math.sqrt(g))
          break
        }
      }
    }
  }

  const combinedDistance = combinedPartyPlayerLightDistance(sourceDistances)
  let maxSourceDistance = 0
  for (const d of sourceDistances) {
    if (d > maxSourceDistance) maxSourceDistance = d
  }

  return {
    summandCount,
    anyHeadlamp,
    anyLantern,
    intensityBeforeGlobalFlicker,
    combinedDistance,
    maxSourceDistance,
    maxTorchHeldDistance,
  }
}
