import { describe, expect, it } from 'vitest'
import { ContentDB } from '../content/contentDb'
import { DEFAULT_RENDER } from '../tuningDefaults'
import type { GameState, ItemId } from '../types'
import { makeInitialState } from './initialState'
import {
  combinedPartyPlayerLightDistance,
  glowbugMulForInventory,
  resolvePartyPlayerLightAggregate,
  type PartyPlayerLightThemeMults,
} from './playerLight'

const content = ContentDB.createDefault()
const unitTheme: PartyPlayerLightThemeMults = { lanternIntensityMult: 1, torchIntensityMult: 1 }

describe('combinedPartyPlayerLightDistance', () => {
  it('is 0 for no sources', () => {
    expect(combinedPartyPlayerLightDistance([])).toBe(0)
  })

  it('is the sole distance for one source', () => {
    expect(combinedPartyPlayerLightDistance([12])).toBe(12)
  })

  it('sums two sources (linear pair)', () => {
    expect(combinedPartyPlayerLightDistance([8, 24])).toBe(32)
    expect(combinedPartyPlayerLightDistance([24, 8])).toBe(32)
  })

  it('uses max + RSS of the rest for three+ sources', () => {
    expect(combinedPartyPlayerLightDistance([10, 10, 10])).toBeCloseTo(10 + 10 * Math.SQRT2)
  })
})

describe('glowbugMulForInventory', () => {
  it('returns clamped glowbugs for GlowbugJar', () => {
    expect(
      glowbugMulForInventory({
        id: 'x' as ItemId,
        defId: 'GlowbugJar',
        qty: 1,
        glowbugs: 7,
      }),
    ).toBe(7)
  })

  it('returns 1 for raw Glowbug stack row', () => {
    expect(
      glowbugMulForInventory({
        id: 'x' as ItemId,
        defId: 'Glowbug',
        qty: 3,
      }),
    ).toBe(1)
  })
})

describe('resolvePartyPlayerLightAggregate', () => {
  it('reports no summands when nothing equipped', () => {
    const state = makeInitialState(content)
    const a = resolvePartyPlayerLightAggregate(state, content, unitTheme)
    expect(a.summandCount).toBe(0)
    expect(a.anyHeadlamp).toBe(false)
    expect(a.intensityBeforeGlobalFlicker).toBe(0)
    expect(a.combinedDistance).toBe(0)
  })

  it('sums one equipped lantern using per-instance base', () => {
    const base = makeInitialState(content)
    const lid = 'i_lan_pl' as ItemId
    const ch = base.party.chars[0]!
    const state: GameState = {
      ...base,
      party: {
        ...base.party,
        chars: [{ ...ch, equipment: { ...ch.equipment, handRight: lid } }],
        items: { ...base.party.items, [lid]: { id: lid, defId: 'Lantern', qty: 1 } },
      },
    }
    const a = resolvePartyPlayerLightAggregate(state, content, unitTheme)
    expect(a.summandCount).toBe(1)
    expect(a.intensityBeforeGlobalFlicker).toBeCloseTo(DEFAULT_RENDER.equippedLanternIntensity)
    expect(a.combinedDistance).toBe(DEFAULT_RENDER.equippedLanternDistance)
  })

  it('sums lanterns across two party members', () => {
    const base = makeInitialState(content)
    const l0 = 'i_lan_a' as ItemId
    const l1 = 'i_lan_b' as ItemId
    const [c0, c1] = base.party.chars
    const state: GameState = {
      ...base,
      party: {
        ...base.party,
        chars: [
          { ...c0!, equipment: { ...c0!.equipment, handLeft: l0 } },
          { ...c1!, equipment: { ...c1!.equipment, handLeft: l1 } },
        ],
        items: {
          ...base.party.items,
          [l0]: { id: l0, defId: 'Lantern', qty: 1 },
          [l1]: { id: l1, defId: 'Lantern', qty: 1 },
        },
      },
    }
    const a = resolvePartyPlayerLightAggregate(state, content, unitTheme)
    expect(a.summandCount).toBe(2)
    expect(a.intensityBeforeGlobalFlicker).toBeCloseTo(DEFAULT_RENDER.equippedLanternIntensity * 2)
    const D = DEFAULT_RENDER.equippedLanternDistance
    expect(a.combinedDistance).toBeCloseTo(2 * D)
  })

  it('sums torches with torch theme mult', () => {
    const base = makeInitialState(content)
    const t0 = 'i_to_a' as ItemId
    const t1 = 'i_to_b' as ItemId
    const [c0, c1] = base.party.chars
    const state: GameState = {
      ...base,
      party: {
        ...base.party,
        chars: [
          { ...c0!, equipment: { ...c0!.equipment, handRight: t0 } },
          { ...c1!, equipment: { ...c1!.equipment, handRight: t1 } },
        ],
        items: {
          ...base.party.items,
          [t0]: { id: t0, defId: 'Torch', qty: 1 },
          [t1]: { id: t1, defId: 'Torch', qty: 1 },
        },
      },
    }
    const torchTheme: PartyPlayerLightThemeMults = { lanternIntensityMult: 1, torchIntensityMult: 1.5 }
    const a = resolvePartyPlayerLightAggregate(state, content, torchTheme)
    expect(a.summandCount).toBe(2)
    expect(a.intensityBeforeGlobalFlicker).toBeCloseTo(DEFAULT_RENDER.heldTorchIntensity * 1.5 * 2)
  })

  it('adds each glowbug jar row instead of taking party max jar fill', () => {
    const base = makeInitialState(content)
    const j0 = 'i_j0' as ItemId
    const j1 = 'i_j1' as ItemId
    const [c0, c1] = base.party.chars
    const state: GameState = {
      ...base,
      party: {
        ...base.party,
        chars: [
          { ...c0!, equipment: { ...c0!.equipment, handRight: j0 } },
          { ...c1!, equipment: { ...c1!.equipment, handRight: j1 } },
        ],
        items: {
          ...base.party.items,
          [j0]: { id: j0, defId: 'GlowbugJar', qty: 1, glowbugs: 3 },
          [j1]: { id: j1, defId: 'GlowbugJar', qty: 1, glowbugs: 7 },
        },
      },
    }
    const a = resolvePartyPlayerLightAggregate(state, content, unitTheme)
    expect(a.summandCount).toBe(2)
    const expected = DEFAULT_RENDER.glowbugIntensity * (3 + 7)
    expect(a.intensityBeforeGlobalFlicker).toBeCloseTo(expected)
    const d0 = DEFAULT_RENDER.glowbugDistance * Math.sqrt(3)
    const d1 = DEFAULT_RENDER.glowbugDistance * Math.sqrt(7)
    expect(a.combinedDistance).toBeCloseTo(d0 + d1)
  })

  it('sets anyHeadlamp when a headlamp is equipped', () => {
    const base = makeInitialState(content)
    const hid = 'i_hl' as ItemId
    const ch = base.party.chars[0]!
    const state: GameState = {
      ...base,
      party: {
        ...base.party,
        chars: [{ ...ch, equipment: { ...ch.equipment, head: hid } }],
        items: { ...base.party.items, [hid]: { id: hid, defId: 'Headlamp', qty: 1 } },
      },
    }
    const a = resolvePartyPlayerLightAggregate(state, content, unitTheme)
    expect(a.anyHeadlamp).toBe(true)
    expect(a.intensityBeforeGlobalFlicker).toBeCloseTo(DEFAULT_RENDER.headlampIntensity)
  })

  it('headlamp uses max(lantern, torch) theme mult (torch-boosted themes do not dim head vs held torch)', () => {
    const base = makeInitialState(content)
    const hid = 'i_hl' as ItemId
    const ch = base.party.chars[0]!
    const state: GameState = {
      ...base,
      party: {
        ...base.party,
        chars: [{ ...ch, equipment: { ...ch.equipment, head: hid } }],
        items: { ...base.party.items, [hid]: { id: hid, defId: 'Headlamp', qty: 1 } },
      },
    }
    const theme: PartyPlayerLightThemeMults = { lanternIntensityMult: 1, torchIntensityMult: 1.5 }
    const a = resolvePartyPlayerLightAggregate(state, content, theme)
    expect(a.intensityBeforeGlobalFlicker).toBeCloseTo(DEFAULT_RENDER.headlampIntensity * 1.5)
  })

  it('four headlamps: ~60 intensity and ~90 combined distance at unit theme (ADR-0477 anchor)', () => {
    const base = makeInitialState(content)
    const ids = ['i_hl0', 'i_hl1', 'i_hl2', 'i_hl3'] as const
    const [c0, c1, c2, c3] = base.party.chars
    const state: GameState = {
      ...base,
      party: {
        ...base.party,
        chars: [
          { ...c0!, equipment: { ...c0!.equipment, head: ids[0] } },
          { ...c1!, equipment: { ...c1!.equipment, head: ids[1] } },
          { ...c2!, equipment: { ...c2!.equipment, head: ids[2] } },
          { ...c3!, equipment: { ...c3!.equipment, head: ids[3] } },
        ],
        items: {
          ...base.party.items,
          [ids[0]]: { id: ids[0], defId: 'Headlamp', qty: 1 },
          [ids[1]]: { id: ids[1], defId: 'Headlamp', qty: 1 },
          [ids[2]]: { id: ids[2], defId: 'Headlamp', qty: 1 },
          [ids[3]]: { id: ids[3], defId: 'Headlamp', qty: 1 },
        },
      },
    }
    const a = resolvePartyPlayerLightAggregate(state, content, unitTheme)
    expect(a.summandCount).toBe(4)
    expect(a.intensityBeforeGlobalFlicker).toBeCloseTo(DEFAULT_RENDER.headlampIntensity * 4, 1)
    const d = DEFAULT_RENDER.headlampDistance
    expect(a.combinedDistance).toBeCloseTo(d + d * Math.sqrt(3), 1)
  })

  it('three lanterns: max(d) + √(Σ_rest d²)', () => {
    const base = makeInitialState(content)
    const l0 = 'i_l0' as ItemId
    const l1 = 'i_l1' as ItemId
    const l2 = 'i_l2' as ItemId
    const ch = base.party.chars[0]!
    const state: GameState = {
      ...base,
      party: {
        ...base.party,
        chars: [
          {
            ...ch,
            equipment: { ...ch.equipment, handLeft: l0, handRight: l1, head: l2 },
          },
        ],
        items: {
          ...base.party.items,
          [l0]: { id: l0, defId: 'Lantern', qty: 1 },
          [l1]: { id: l1, defId: 'Lantern', qty: 1 },
          [l2]: { id: l2, defId: 'Lantern', qty: 1 },
        },
      },
    }
    const a = resolvePartyPlayerLightAggregate(state, content, unitTheme)
    const D = DEFAULT_RENDER.equippedLanternDistance
    expect(a.combinedDistance).toBeCloseTo(D + Math.sqrt(2) * D)
  })

  it('combinedDistance sums two different per-source reaches', () => {
    const base = makeInitialState(content)
    const tid = 'i_t' as ItemId
    const lid = 'i_l' as ItemId
    const ch = base.party.chars[0]!
    const state: GameState = {
      ...base,
      party: {
        ...base.party,
        chars: [
          {
            ...ch,
            equipment: { ...ch.equipment, handLeft: tid, handRight: lid },
          },
        ],
        items: {
          ...base.party.items,
          [tid]: { id: tid, defId: 'Torch', qty: 1 },
          [lid]: { id: lid, defId: 'Lantern', qty: 1 },
        },
      },
    }
    const a = resolvePartyPlayerLightAggregate(state, content, unitTheme)
    const dt = DEFAULT_RENDER.heldTorchDistance
    const dl = DEFAULT_RENDER.equippedLanternDistance
    expect(a.combinedDistance).toBeCloseTo(dt + dl)
  })
})
