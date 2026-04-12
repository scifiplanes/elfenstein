import type { CharacterId, Species } from '../../game/types'

export type PortraitSpeciesPartyRow = { id: CharacterId; species: Species }

/**
 * When two or more party members share a species, only the first in `party.chars` order
 * keeps the default portrait colors; later slots get a CSS tint (see `PortraitPanel`).
 */
export function portraitNeedsDuplicateSpeciesTint(
  partyChars: readonly PortraitSpeciesPartyRow[],
  characterId: CharacterId,
): boolean {
  const idx = partyChars.findIndex((c) => c.id === characterId)
  if (idx < 0) return false
  const species = partyChars[idx]!.species
  const firstIdx = partyChars.findIndex((c) => c.species === species)
  return idx > firstIdx
}
