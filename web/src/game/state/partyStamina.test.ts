import { describe, expect, it } from 'vitest'
import { reduce } from '../reducer'
import { makeInitialState } from './initialState'
import { ContentDB } from '../content/contentDb'
import { applyPartyStaminaCost, canPartyPayStamina, pickCraftStaminaPayer } from './partyStamina'
import type { Character, CharacterId, GameState } from '../types'

const CONTENT = ContentDB.createDefault()

describe('partyStamina', () => {
  it('canPartyPayStamina requires every living member to afford the cost', () => {
    let s = makeInitialState(CONTENT)
    s = { ...s, party: { ...s.party, chars: s.party.chars.map((c) => ({ ...c, stamina: 5, hp: 10 })) } }
    expect(canPartyPayStamina(s, 5)).toBe(true)
    expect(canPartyPayStamina(s, 6)).toBe(false)
  })

  it('pickCraftStaminaPayer returns null when cost is 0', () => {
    const s = makeInitialState(CONTENT)
    expect(pickCraftStaminaPayer(s, 0, 'weaving')).toBe(null)
  })

  it('pickCraftStaminaPayer returns null when no living character can afford', () => {
    let s = makeInitialState(CONTENT)
    s = { ...s, party: { ...s.party, chars: s.party.chars.map((c) => ({ ...c, stamina: 2, hp: 10 })) } }
    expect(pickCraftStaminaPayer(s, 5, 'weaving')).toBe(null)
  })

  it('pickCraftStaminaPayer picks the only affordable character', () => {
    let s = makeInitialState(CONTENT)
    const [c0, ...rest] = s.party.chars
    const chars: Character[] = [{ ...c0!, stamina: 10, hp: 10 }, ...rest.map((c) => ({ ...c, stamina: 2, hp: 10 }))]
    s = { ...s, party: { ...s.party, chars } }
    expect(pickCraftStaminaPayer(s, 5, 'weaving')).toBe(c0!.id)
  })

  it('pickCraftStaminaPayer breaks skill ties by roster order', () => {
    const s0 = makeInitialState(CONTENT)
    const c = s0.party.chars[0]!
    const chars: Character[] = [
      { ...c, id: 'c1' as CharacterId, skills: { weaving: 2 }, stamina: 10, hp: 10 },
      { ...c, id: 'c2' as CharacterId, skills: { weaving: 2 }, stamina: 10, hp: 10 },
    ]
    const s: GameState = { ...s0, party: { ...s0.party, chars } }
    expect(pickCraftStaminaPayer(s, 5, 'weaving')).toBe('c1')
  })

  it('pickCraftStaminaPayer picks higher skill over earlier roster slot', () => {
    const s0 = makeInitialState(CONTENT)
    const c = s0.party.chars[0]!
    const chars: Character[] = [
      { ...c, id: 'c_a' as CharacterId, skills: { weaving: 1 }, stamina: 10, hp: 10 },
      { ...c, id: 'c_b' as CharacterId, skills: { weaving: 4 }, stamina: 10, hp: 10 },
    ]
    const s: GameState = { ...s0, party: { ...s0.party, chars } }
    expect(pickCraftStaminaPayer(s, 5, 'weaving')).toBe('c_b')
  })

  it('pickCraftStaminaPayer ignores dead characters even if skilled', () => {
    const s0 = makeInitialState(CONTENT)
    const c = s0.party.chars[0]!
    const chars: Character[] = [
      { ...c, id: 'c_dead' as CharacterId, skills: { weaving: 9 }, stamina: 10, hp: 0 },
      { ...c, id: 'c_ok' as CharacterId, skills: { weaving: 1 }, stamina: 10, hp: 10 },
    ]
    const s: GameState = { ...s0, party: { ...s0.party, chars } }
    expect(pickCraftStaminaPayer(s, 5, 'weaving')).toBe('c_ok')
  })

  it('applyPartyStaminaCost subtracts from all living party members and adds portrait toasts', () => {
    let s = makeInitialState(CONTENT)
    s = { ...s, party: { ...s.party, chars: s.party.chars.map((c) => ({ ...c, stamina: 10, hp: 10 })) } }
    const next = applyPartyStaminaCost(s, 3)
    expect(next.party.chars.every((c) => c.stamina === 7)).toBe(true)
    const toasts = next.ui.portraitToasts ?? []
    expect(toasts.length).toBe(s.party.chars.length)
    expect(toasts.every((t) => t.text === '−3 STA')).toBe(true)
  })

  it('portrait rest tap converts hunger/thirst to stamina with cooldown', () => {
    let s = makeInitialState(CONTENT)
    const cid = s.party.chars[0]!.id
    s = {
      ...s,
      ui: { ...s.ui, screen: 'game' },
      party: {
        ...s.party,
        chars: s.party.chars.map((c, i) =>
          i === 0 ? { ...c, hunger: 20, thirst: 20, stamina: 5, hp: 10 } : { ...c, hp: 10 },
        ),
      },
      render: { ...s.render, portraitRestStaminaGain: 8, portraitRestHungerCost: 4, portraitRestThirstCost: 4, portraitRestCooldownMs: 999_000 },
    }
    const a = reduce(s, { type: 'ui/portraitFrameTap', characterId: cid })
    const c0 = a.party.chars[0]!
    expect(c0.stamina).toBeGreaterThan(5)
    expect(c0.hunger).toBe(16)
    expect(c0.thirst).toBe(16)
    const b = reduce(a, { type: 'ui/portraitFrameTap', characterId: cid })
    const c1 = b.party.chars[0]!
    expect(c1.stamina).toBe(c0.stamina)
    expect(c1.hunger).toBe(c0.hunger)
  })
})
