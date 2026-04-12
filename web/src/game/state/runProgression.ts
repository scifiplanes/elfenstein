import { npcCombatTuningFromContent, npcKindHpMax } from '../content/npcCombat'
import type { CombatState, GameState } from '../types'
import { pushActivityLog } from './activityLog'

export function hpMax(state: GameState): number {
  return 100 + (state.run?.bonuses.hpMaxBonus ?? 0)
}

export function staminaMax(state: GameState): number {
  return 100 + (state.run?.bonuses.staminaMaxBonus ?? 0)
}

// --- Level curve (run XP) -------------------------------------------------

/** XP required to go from `level` → `level + 1` (first gate uses `XP_LEVEL_COST_BASE` only). */
export const XP_LEVEL_COST_BASE = 25
export const XP_LEVEL_COST_STEP = 20

export function xpForNextLevel(level: number): number {
  const L = Math.max(1, Math.floor(level))
  return XP_LEVEL_COST_BASE + (L - 1) * XP_LEVEL_COST_STEP
}

// --- Fixed grants -----------------------------------------------------------

export const XP_FLOOR_DESCEND = 12
export const XP_DOOR_UNLOCK = 18

/** Barrel / crate / chest first open. */
export const XP_CONTAINER_OPEN = 4
/** Shrine removed Cursed from at least one party member. */
export const XP_SHRINE_PURIFY = 6
/** Cracked wall opened into floor (item-on-POI success). */
export const XP_SECRET_OPEN = 12
/** Campfire roast success. */
export const XP_COOK_SUCCESS = 4
/** Each Kuratko egg pried from nest. */
export const XP_NEST_EGG = 3

/** Crafting success: `max(1, round(dc / XP_CRAFT_DC_DIVISOR))`. */
export const XP_CRAFT_DC_DIVISOR = 3

export function xpForCraftSuccess(dc: number): number {
  return Math.max(1, Math.round(Number(dc) / XP_CRAFT_DC_DIVISOR))
}

// --- Combat victory (threat-based + depth) ----------------------------------

/** Weight on runtime `hpMax` (includes spawn/boss scaling). */
export const COMBAT_XP_PER_HP = 0.21
/** Weight on scaled `baseDamage` from content tuning. */
export const COMBAT_XP_PER_DMG = 0.35
/** Extra XP when `variant === 'boss'` (on top of higher typical hp). */
export const COMBAT_XP_BOSS_FLAT = 8

/** `floorIndex` contribution per floor, before cap. */
export const COMBAT_XP_DEPTH_PER_FLOOR = 0.02
/** `difficulty` (0–2) step added to depth multiplier. */
export const COMBAT_XP_DEPTH_PER_DIFFICULTY = 0.02
/** Max combat XP multiplier from depth (e.g. 1.25 = +25%). */
export const COMBAT_XP_DEPTH_MUL_CAP = 1.25

export function combatXpDepthMul(state: GameState): number {
  const fi = Math.max(0, Math.floor(state.floor.floorIndex))
  const diff = Math.max(0, Math.min(2, Math.floor(Number(state.floor.difficulty))))
  const raw = 1 + fi * COMBAT_XP_DEPTH_PER_FLOOR + diff * COMBAT_XP_DEPTH_PER_DIFFICULTY
  return Math.min(COMBAT_XP_DEPTH_MUL_CAP, raw)
}

function combatXpForOneNpc(npc: GameState['floor']['npcs'][number]): number {
  const tuning = npcCombatTuningFromContent(npc.kind)
  const hp = Math.max(1, Math.floor(Number(npc.hpMax ?? npcKindHpMax(npc.kind))))
  const dmg = Math.max(1, Math.floor(Number(tuning.baseDamage)))
  let x = COMBAT_XP_PER_HP * hp + COMBAT_XP_PER_DMG * dmg
  if (npc.variant === 'boss') x += COMBAT_XP_BOSS_FLAT
  return Math.max(0, Math.round(x))
}

/**
 * Total XP for winning an encounter (before `applyXp`). Uses live `floor.npcs` rows
 * (hpMax reflects boss/spawn scaling). Missing ids fall back to kind defaults.
 */
export function combatVictoryXp(state: GameState, combat: CombatState): number {
  let sum = 0
  for (const npcId of combat.participants.npcs) {
    const row = state.floor.npcs.find((n) => n.id === npcId)
    if (row) sum += combatXpForOneNpc(row)
    else sum += 10 // rare: row missing — match old per-head baseline
  }
  return Math.max(0, Math.round(sum * combatXpDepthMul(state)))
}

export type ApplyXpResult = {
  state: GameState
  leveledUp: boolean
  gainedLevels: number
  perkIds: string[]
}

export function perkLabelForId(perkId: string): string {
  if (perkId === 'vitals_plus5') return '+5 max HP/STA'
  if (perkId === 'damage_plus10pct') return '+10% dmg'
  return perkId
}

/** Apply XP, log `gainMsg`, then append level-up lines when applicable. */
export function applyXpWithActivityLog(state: GameState, deltaXp: number, gainMsg: string): GameState {
  const before = state
  const xpRes = applyXp(state, deltaXp)
  let next = pushActivityLog(xpRes.state, gainMsg)
  return pushLevelUpActivityLogs(before, next, xpRes)
}

/** Append one activity-log line per level gained, with correct `Reached level N` numbers. */
export function pushLevelUpActivityLogs(stateBeforeXp: GameState, stateAfterXp: GameState, xpRes: ApplyXpResult): GameState {
  if (!xpRes.leveledUp) return stateAfterXp
  const startLevel = stateBeforeXp.run.level
  let next = stateAfterXp
  for (let i = 0; i < xpRes.perkIds.length; i++) {
    const perkId = xpRes.perkIds[i]!
    const levelReached = startLevel + i + 1
    next = pushActivityLog(next, `Reached level ${levelReached}. (${perkLabelForId(perkId)})`)
  }
  return next
}

function pickPerkIdForLevel(level: number): string {
  // MVP deterministic sequence.
  if (level === 2) return 'vitals_plus5'
  if (level === 3) return 'damage_plus10pct'
  return level % 2 === 0 ? 'vitals_plus5' : 'damage_plus10pct'
}

export function applyXp(state: GameState, deltaXp: number): ApplyXpResult {
  const delta = Math.max(0, Math.floor(deltaXp))
  if (!delta) return { state, leveledUp: false, gainedLevels: 0, perkIds: [] }
  let next: GameState = { ...state, run: { ...state.run, xp: state.run.xp + delta } }
  const perkIds: string[] = []
  let gainedLevels = 0

  while (next.run.xp >= xpForNextLevel(next.run.level)) {
    next = {
      ...next,
      run: {
        ...next.run,
        xp: next.run.xp - xpForNextLevel(next.run.level),
        level: next.run.level + 1,
      },
    }
    gainedLevels++
    const perkId = pickPerkIdForLevel(next.run.level)
    perkIds.push(perkId)
    next = applyPerk(next, perkId)
  }

  return { state: next, leveledUp: gainedLevels > 0, gainedLevels, perkIds }
}

export function applyPerk(state: GameState, perkId: string): GameState {
  if (state.run.perkHistory.some((p) => p.perkId === perkId && p.level === state.run.level)) return state

  if (perkId === 'vitals_plus5') {
    return {
      ...state,
      run: {
        ...state.run,
        perkHistory: state.run.perkHistory.concat([{ level: state.run.level, perkId }]),
        bonuses: {
          ...state.run.bonuses,
          hpMaxBonus: state.run.bonuses.hpMaxBonus + 5,
          staminaMaxBonus: state.run.bonuses.staminaMaxBonus + 5,
        },
      },
    }
  }
  if (perkId === 'damage_plus10pct') {
    return {
      ...state,
      run: {
        ...state.run,
        perkHistory: state.run.perkHistory.concat([{ level: state.run.level, perkId }]),
        bonuses: {
          ...state.run.bonuses,
          damageBonusPct: state.run.bonuses.damageBonusPct + 0.1,
        },
      },
    }
  }
  return {
    ...state,
    run: { ...state.run, perkHistory: state.run.perkHistory.concat([{ level: state.run.level, perkId }]) },
  }
}
