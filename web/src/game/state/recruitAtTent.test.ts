import { describe, expect, it } from 'vitest'
import { ContentDB } from '../content/contentDb'
import { reduce } from '../reducer'
import { makeInitialState } from './initialState'
import { debugReplaceAllPartyWithTentTemplates, recruitAtTent, regenerateTentPortraitHues } from './recruitAtTent'
import {
  TENT_REPLACEMENT_PORTRAIT_SATURATE_ALIVE_MAX,
  TENT_REPLACEMENT_PORTRAIT_SATURATE_ALIVE_MIN,
} from './tentReplacementPortraitTint'

const content = ContentDB.createDefault()

function hubVillage(s: ReturnType<typeof makeInitialState>) {
  return {
    ...s,
    ui: { ...s.ui, screen: 'hub' as const, hubScene: 'village' as const },
  }
}

describe('recruitAtTent', () => {
  it('starters do not set tentReplacementPortraitHueDeg', () => {
    const base = hubVillage(makeInitialState(content, { floorSeed: 1 }))
    expect(base.party.chars.every((c) => c.tentReplacementPortraitHueDeg === undefined)).toBe(true)
    expect(base.party.chars.every((c) => c.tentReplacementPortraitSaturateMult === undefined)).toBe(true)
  })

  it('regenerateTentPortraitHues returns same state when no tent hues', () => {
    const s = hubVillage(makeInitialState(content))
    expect(regenerateTentPortraitHues(s)).toBe(s)
  })

  it('regenerateTentPortraitHues re-rolls only tent recruits and bumps revision', () => {
    const mkDead = (run: ReturnType<typeof makeInitialState>) => ({
      ...run,
      party: {
        ...run.party,
        chars: run.party.chars.map((c, i) => (i === 1 ? { ...c, hp: 0 } : c)),
      },
    })
    const recruited = recruitAtTent(mkDead(hubVillage(makeInitialState(content, { floorSeed: 777 }))), content)
    const hue0 = recruited.party.chars[1]!.tentReplacementPortraitHueDeg
    const once = regenerateTentPortraitHues(recruited)
    expect(once.run.debugTentPortraitHueRevision).toBe(1)
    const hue1 = once.party.chars[1]!.tentReplacementPortraitHueDeg
    const sat0 = recruited.party.chars[1]!.tentReplacementPortraitSaturateMult
    const sat1 = once.party.chars[1]!.tentReplacementPortraitSaturateMult
    expect(hue1).not.toBe(hue0)
    expect(sat1).not.toBe(sat0)
    expect(once.party.chars[0]!.tentReplacementPortraitHueDeg).toBeUndefined()
    const twice = regenerateTentPortraitHues(once)
    expect(twice.run.debugTentPortraitHueRevision).toBe(2)
    expect(twice.party.chars[1]!.tentReplacementPortraitHueDeg).not.toBe(hue1)
    expect(twice.party.chars[1]!.tentReplacementPortraitSaturateMult).not.toBe(sat1)
  })

  it('assigns stable tentReplacementPortraitHueDeg in 0..359', () => {
    const mkDead = (run: ReturnType<typeof makeInitialState>) => ({
      ...run,
      party: {
        ...run.party,
        chars: run.party.chars.map((c, i) => (i === 1 ? { ...c, hp: 0 } : c)),
      },
    })
    const s1 = mkDead(hubVillage(makeInitialState(content, { floorSeed: 424242 })))
    const s2 = mkDead(hubVillage(makeInitialState(content, { floorSeed: 424242 })))
    const a = recruitAtTent(s1, content)
    const b = recruitAtTent(s2, content)
    const hueA = a.party.chars[1]!.tentReplacementPortraitHueDeg
    const hueB = b.party.chars[1]!.tentReplacementPortraitHueDeg
    const satA = a.party.chars[1]!.tentReplacementPortraitSaturateMult
    const satB = b.party.chars[1]!.tentReplacementPortraitSaturateMult
    expect(hueA).toBe(hueB)
    expect(satA).toBe(satB)
    expect(hueA).toBeGreaterThanOrEqual(0)
    expect(hueA!).toBeLessThan(360)
    expect(satA!).toBeGreaterThanOrEqual(TENT_REPLACEMENT_PORTRAIT_SATURATE_ALIVE_MIN)
    expect(satA!).toBeLessThanOrEqual(TENT_REPLACEMENT_PORTRAIT_SATURATE_ALIVE_MAX)
  })

  it('replaces first dead party member and increments tent recruit count', () => {
    const base = hubVillage(makeInitialState(content))
    const dead = base.party.chars.map((c, i) => (i === 1 ? { ...c, hp: 0 } : c))
    const state = { ...base, party: { ...base.party, chars: dead } }
    const next = recruitAtTent(state, content)
    expect(next).not.toBe(state)
    expect(next.party.chars[1]!.hp).toBeGreaterThan(0)
    expect(next.run.tentRecruitsCompleted).toBe(1)
    expect(next.party.chars[0]!.hp).toBeGreaterThan(0)
    const log = (next.ui.activityLog ?? []).map((e) => e.text).join(' ')
    expect(log).toMatch(/joins the party from the tent/)
  })

  it('returns same state when no one is dead', () => {
    const base = hubVillage(makeInitialState(content))
    const next = recruitAtTent(base, content)
    expect(next).toBe(base)
  })

  it('returns same state when not on village hub', () => {
    const base = makeInitialState(content)
    const dead = base.party.chars.map((c) => ({ ...c, hp: 0 }))
    const state = {
      ...base,
      party: { ...base.party, chars: dead },
      ui: { ...base.ui, screen: 'hub' as const, hubScene: 'tavern' as const },
    }
    expect(recruitAtTent(state, content)).toBe(state)
  })
})

describe('debugReplaceAllPartyWithTentTemplates', () => {
  const gameScreen = (s: ReturnType<typeof makeInitialState>) => ({
    ...s,
    ui: { ...s.ui, screen: 'game' as const },
  })

  it('replaces every slot, preserves ids, clears statuses/equipment, sets tent hue', () => {
    const base = gameScreen(makeInitialState(content, { floorSeed: 42 }))
    const idsBefore = base.party.chars.map((c) => c.id)
    const next = debugReplaceAllPartyWithTentTemplates(base, content)
    expect(next.run.debugReplaceAllPartyRevision).toBe(1)
    expect(next.party.chars.map((c) => c.id)).toEqual(idsBefore)
    expect(next.party.chars.every((c) => c.tentReplacementPortraitHueDeg !== undefined)).toBe(true)
    expect(next.party.chars.every((c) => c.tentReplacementPortraitSaturateMult !== undefined)).toBe(true)
    for (const c of next.party.chars) {
      expect(c.statuses).toEqual([])
      expect(c.equipment).toEqual({})
      const h = c.tentReplacementPortraitHueDeg!
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(360)
      const sat = c.tentReplacementPortraitSaturateMult!
      expect(sat).toBeGreaterThanOrEqual(TENT_REPLACEMENT_PORTRAIT_SATURATE_ALIVE_MIN)
      expect(sat).toBeLessThanOrEqual(TENT_REPLACEMENT_PORTRAIT_SATURATE_ALIVE_MAX)
    }
    expect((next.ui.activityLog ?? []).some((e) => e.text.includes('Debug: party replaced with tent templates'))).toBe(true)
  })

  it('bumps revision on repeated calls', () => {
    const base = gameScreen(makeInitialState(content, { floorSeed: 7 }))
    const once = debugReplaceAllPartyWithTentTemplates(base, content)
    const twice = debugReplaceAllPartyWithTentTemplates(once, content)
    expect(twice.run.debugReplaceAllPartyRevision).toBe(2)
  })

  it('reducer rejects replace while in combat', () => {
    const base = gameScreen(makeInitialState(content, { floorSeed: 11 }))
    const c1 = base.party.chars[0]!.id
    const state = {
      ...base,
      combat: {
        encounterId: 'enc1',
        startedAtMs: 0,
        participants: { party: [c1], npcs: ['n1'] },
        turnQueue: [{ kind: 'pc' as const, id: c1, initiative: 10 }],
        turnIndex: 0,
      },
    }
    const next = reduce(state, { type: 'debug/replaceAllPartyWithTentTemplates' })
    expect((next.ui.activityLog ?? []).some((e) => e.text.includes('Not while in combat'))).toBe(true)
    expect(next.ui.sfxQueue?.some((s) => s.kind === 'reject')).toBe(true)
    expect(next.party.chars.map((c) => c.name)).toEqual(state.party.chars.map((c) => c.name))
  })
})

describe('hub/recruitAtTent reducer', () => {
  it('plays reject when no dead hero', () => {
    const base = hubVillage(makeInitialState(content))
    const next = reduce(base, { type: 'hub/recruitAtTent' })
    expect(next.party.chars.every((c) => c.hp > 0)).toBe(true)
    expect((next.ui.activityLog ?? []).some((e) => e.text.includes('No fallen heroes'))).toBe(true)
    expect(next.ui.sfxQueue?.some((s) => s.kind === 'reject')).toBe(true)
  })
})

describe('hub/enterDungeon living gate', () => {
  it('rejects when entire party is dead', () => {
    const base = hubVillage(makeInitialState(content))
    const dead = base.party.chars.map((c) => ({ ...c, hp: 0 }))
    const state = { ...base, party: { ...base.party, chars: dead } }
    const next = reduce(state, { type: 'hub/enterDungeon' })
    expect(next.ui.screen).toBe('hub')
    expect((next.ui.activityLog ?? []).some((e) => e.text.includes('living party member'))).toBe(true)
    expect(next.ui.sfxQueue?.some((s) => s.kind === 'reject')).toBe(true)
  })
})
