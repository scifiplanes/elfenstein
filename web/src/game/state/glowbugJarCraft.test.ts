import { describe, expect, it } from 'vitest'
import { ContentDB } from '../content/contentDb'
import { reduce } from '../reducer'
import type { GameState, ItemId } from '../types'
import { makeInitialState } from './initialState'

const content = ContentDB.createDefault()

function gameWithJarAndBug(jarGlowbugs: number): GameState {
  const base = makeInitialState(content)
  const jarId = 'i_jar_t' as ItemId
  const bugId = 'i_bug_t' as ItemId
  const slots = base.party.inventory.slots.slice()
  slots[0] = bugId
  slots[1] = jarId
  return {
    ...base,
    ui: { ...base.ui, screen: 'game' },
    nowMs: 10_000_000,
    party: {
      ...base.party,
      chars: base.party.chars.map((ch) => ({
        ...ch,
        skills: { ...ch.skills, weaving: 10 },
        stamina: 50,
        hp: Math.max(1, ch.hp),
      })),
      items: {
        ...base.party.items,
        [jarId]: { id: jarId, defId: 'GlowbugJar', qty: 1, glowbugs: jarGlowbugs },
        [bugId]: { id: bugId, defId: 'Glowbug', qty: 1 },
      },
      inventory: { ...base.party.inventory, slots },
    },
  }
}

describe('Glowbug jar enrich (reducer)', () => {
  it('rejects inventory craft when jar already holds 12 glowbugs', () => {
    const jarId = 'i_jar_t' as ItemId
    const bugId = 'i_bug_t' as ItemId
    let s = gameWithJarAndBug(12)
    s = reduce(s, {
      type: 'drag/drop',
      nowMs: s.nowMs,
      payload: { itemId: bugId, source: { kind: 'inventorySlot', slotIndex: 0, itemId: bugId } },
      target: { kind: 'inventorySlot', slotIndex: 1 },
    })
    expect(s.ui.crafting).toBeUndefined()
    expect(s.ui.activityLog.some((e) => e.text.includes('full'))).toBe(true)
    expect(s.party.items[bugId]?.defId).toBe('Glowbug')
    expect(s.party.items[jarId]?.glowbugs).toBe(12)
  })
})
