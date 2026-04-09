import type { ItemDefId } from '../types'

/** English substrate for NPC dialog / combat log when they have a quest item want. */
export function npcQuestEnglishLine(
  npc: { quest?: { wants: ItemDefId } },
  getItemName: (id: ItemDefId) => string,
): string | null {
  const wants = npc.quest?.wants
  if (!wants) return null
  return `…bring me ${getItemName(wants)}.`
}
