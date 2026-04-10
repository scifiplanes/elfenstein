import type { ItemDefId, NpcLanguage } from '../types'
import { toGibberish } from './gibberish'

/** XOR mixed into `floorSeed` for quest speech gibberish (dialog strip + combat log). */
export const QUEST_SPEECH_GIBBERISH_SEED_XOR = 0xabc

export function npcQuestGibberishSeed(floorSeed: number): number {
  return Math.floor(floorSeed) ^ QUEST_SPEECH_GIBBERISH_SEED_XOR
}

type QuestSpeechNpc = {
  id: string
  language: NpcLanguage
  quest?: { wants: ItemDefId; hated?: ItemDefId[] }
}

/** English substrate for NPC dialog / combat log when they have a quest item want. */
export function npcQuestEnglishLine(
  npc: { quest?: { wants: ItemDefId; hated?: ItemDefId[] } },
  getItemName: (id: ItemDefId) => string,
): string | null {
  const wants = npc.quest?.wants
  if (!wants) return null
  return `…bring me ${getItemName(wants)}.`
}

/**
 * Diegetic quest line: same generator as the NPC dialog speech strip (`NpcDialogModal`).
 * Returns `null` when the NPC has no quest want.
 */
export function npcQuestGibberishLine(
  npc: QuestSpeechNpc,
  getItemName: (id: ItemDefId) => string,
  floorSeed: number,
): string | null {
  const english = npcQuestEnglishLine(npc, getItemName)
  if (english == null) return null
  return toGibberish(npc.language, english, npcQuestGibberishSeed(floorSeed), npc.id)
}
