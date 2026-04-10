import { describe, expect, it } from 'vitest'
import { npcQuestEnglishLine, npcQuestGibberishLine, QUEST_SPEECH_GIBBERISH_SEED_XOR } from './npcQuestSpeech'

describe('npcQuestEnglishLine', () => {
  it('returns null when there is no quest want', () => {
    expect(npcQuestEnglishLine({ quest: undefined }, () => 'x')).toBeNull()
    expect(npcQuestEnglishLine({}, () => 'x')).toBeNull()
  })

  it('returns bring-me line using item name resolver', () => {
    const line = npcQuestEnglishLine({ quest: { wants: 'IronKey', hated: [] } }, (id) =>
      id === 'IronKey' ? 'Iron key' : id,
    )
    expect(line).toBe('…bring me Iron key.')
  })
})

describe('npcQuestGibberishLine', () => {
  const npcBase = {
    id: 'npc_a',
    language: 'DeepGnome' as const,
    quest: { wants: 'IronKey' as const, hated: [] as const },
  }

  it('returns null when there is no quest want', () => {
    expect(npcQuestGibberishLine({ id: 'x', language: 'Mojibake' }, () => 'x', 0)).toBeNull()
  })

  it('is deterministic for seed, id, and language', () => {
    const g = (lang: typeof npcBase.language) =>
      npcQuestGibberishLine({ ...npcBase, language: lang }, (id) => (id === 'IronKey' ? 'Iron key' : id), 42)
    const a = g('DeepGnome')
    const b = g('DeepGnome')
    expect(a).toBe(b)
    expect(a!.length).toBeGreaterThan(0)
    expect(g('Mojibake')).not.toBe(a)
  })

  it('matches XOR constant used for dialog seed', () => {
    expect(QUEST_SPEECH_GIBBERISH_SEED_XOR).toBe(0xabc)
  })
})
