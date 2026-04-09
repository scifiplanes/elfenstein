import { describe, expect, it } from 'vitest'
import { npcQuestEnglishLine } from './npcQuestSpeech'

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
