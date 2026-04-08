import type { GameState } from '../types'

export function hpMax(state: GameState): number {
  return 100 + (state.run?.bonuses.hpMaxBonus ?? 0)
}

export function staminaMax(state: GameState): number {
  return 100 + (state.run?.bonuses.staminaMaxBonus ?? 0)
}

export function xpForNextLevel(level: number): number {
  const L = Math.max(1, Math.floor(level))
  return 25 + (L - 1) * 20
}

function pickPerkIdForLevel(level: number): string {
  // MVP deterministic sequence.
  if (level === 2) return 'vitals_plus5'
  if (level === 3) return 'damage_plus10pct'
  return level % 2 === 0 ? 'vitals_plus5' : 'damage_plus10pct'
}

export function applyXp(state: GameState, deltaXp: number): { state: GameState; leveledUp: boolean; gainedLevels: number; perkIds: string[] } {
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

