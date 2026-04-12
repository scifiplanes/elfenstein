import type { CharacterId, GameState, SkillId } from '../types'
import { staminaMax } from './runProgression'
import { pushPortraitToast } from './portraitToasts'

function livingChars(chars: GameState['party']['chars']) {
  return chars.filter((c) => c.hp > 0)
}

export function canPartyPayStamina(state: GameState, cost: number): boolean {
  if (cost <= 0) return true
  return livingChars(state.party.chars).every((c) => c.stamina >= cost)
}

/** Living party member who can pay `cost` with highest `skills[skill]`; roster order breaks ties. */
export function pickCraftStaminaPayer(state: GameState, cost: number, skill: SkillId): CharacterId | null {
  if (cost <= 0) return null
  const affordable = state.party.chars.filter((c) => c.hp > 0 && c.stamina >= cost)
  if (affordable.length === 0) return null
  const maxSk = Math.max(...affordable.map((c) => Number(c.skills?.[skill] ?? 0)))
  const picked = state.party.chars.find(
    (c) => c.hp > 0 && c.stamina >= cost && Number(c.skills?.[skill] ?? 0) === maxSk,
  )
  return picked?.id ?? null
}

export function applyPartyStaminaCost(
  state: GameState,
  cost: number,
  opts?: { portraitToast?: boolean; toastTtlMs?: number },
): GameState {
  if (cost <= 0) return state
  const chars = state.party.chars.map((c) =>
    c.hp > 0 ? { ...c, stamina: Math.max(0, c.stamina - cost) } : c,
  )
  let next: GameState = { ...state, party: { ...state.party, chars } }
  if (opts?.portraitToast !== false) {
    const ttl = opts?.toastTtlMs ?? Math.max(400, Math.round(Number(state.render.portraitToastTtlMs ?? 1600)))
    for (const c of chars) {
      if (c.hp <= 0) continue
      next = pushPortraitToast(next, {
        characterId: c.id,
        kind: 'statDelta',
        text: `−${cost} STA`,
        ttlMs: ttl,
      })
    }
  }
  return next
}

export function tryPartyStaminaCost(
  state: GameState,
  cost: number,
  onPaid: (s: GameState) => GameState,
  opts?: { portraitToast?: boolean },
): GameState | null {
  if (!canPartyPayStamina(state, cost)) return null
  const paid = applyPartyStaminaCost(state, cost, opts)
  return onPaid(paid)
}

export function canCharacterPayStamina(state: GameState, characterId: CharacterId, cost: number): boolean {
  if (cost <= 0) return true
  const c = state.party.chars.find((x) => x.id === characterId)
  return Boolean(c && c.hp > 0 && c.stamina >= cost)
}

export function applyCharacterStaminaCost(
  state: GameState,
  characterId: CharacterId,
  cost: number,
  opts?: { portraitToast?: boolean },
): GameState {
  if (cost <= 0) return state
  const idx = state.party.chars.findIndex((c) => c.id === characterId)
  if (idx < 0) return state
  const c = state.party.chars[idx]!
  if (c.hp <= 0) return state
  const chars = state.party.chars.slice()
  chars[idx] = { ...c, stamina: Math.max(0, c.stamina - cost) }
  let next: GameState = { ...state, party: { ...state.party, chars } }
  if (opts?.portraitToast !== false) {
    next = pushPortraitToast(next, {
      characterId,
      kind: 'statDelta',
      text: `−${cost} STA`,
    })
  }
  return next
}

/** Stamina ratio 0..1 vs max for one character (for low-stamina warnings). */
export function staminaRatio(state: GameState, characterId: CharacterId): number {
  const c = state.party.chars.find((x) => x.id === characterId)
  if (!c || c.hp <= 0) return 1
  const sm = Math.max(1, staminaMax(state))
  return Math.min(1, c.stamina / sm)
}
