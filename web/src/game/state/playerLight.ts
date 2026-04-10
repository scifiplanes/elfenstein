import type { ContentDB } from '../content/contentDb'
import type { Character, GameState } from '../types'

export type PlayerCameraLightKind = 'bare' | 'torch' | 'lantern' | 'headlamp' | 'glowbug'

const KIND_RANK: Record<PlayerCameraLightKind, number> = {
  bare: 0,
  glowbug: 1,
  torch: 2,
  headlamp: 3,
  lantern: 4,
}

/**
 * Strongest equipped `playerLight` on one character (slots: hands + head).
 * Priority: Lantern (hands) > Headlamp > Torch > Glowbug > bare.
 */
function cameraLightKindForCharacter(c: Character, state: GameState, content: ContentDB): PlayerCameraLightKind {
  const slots = ['handLeft', 'handRight', 'head'] as const
  let hasTorch = false
  let hasGlowbug = false
  let hasHeadlamp = false
  let hasLantern = false

  for (const slot of slots) {
    const itemId = c.equipment[slot]
    if (!itemId) continue
    const inv = state.party.items[itemId]
    if (!inv) continue
    const tag = content.item(inv.defId).playerLight
    if (tag === 'lantern') hasLantern = true
    else if (tag === 'headlamp') hasHeadlamp = true
    else if (tag === 'torch') hasTorch = true
    else if (tag === 'glowbug') hasGlowbug = true
  }

  if (hasLantern) return 'lantern'
  if (hasHeadlamp) return 'headlamp'
  if (hasTorch) return 'torch'
  if (hasGlowbug) return 'glowbug'
  return 'bare'
}

/**
 * Party-wide camera PointLight: use the **strongest** equipped light among **all** party members
 * (so a headlamp on any portrait affects the dungeon view, not only `party.chars[0]`).
 */
export function resolvePlayerCameraLightKind(state: GameState, content: ContentDB): PlayerCameraLightKind {
  let best: PlayerCameraLightKind = 'bare'
  for (const c of state.party.chars) {
    const k = cameraLightKindForCharacter(c, state, content)
    if (KIND_RANK[k] > KIND_RANK[best]) best = k
  }
  return best
}
