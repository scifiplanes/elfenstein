import { describe, expect, it } from 'vitest'
import { ContentDB } from '../content/contentDb'
import type { ItemId } from '../types'
import { applyItemOnPoi, applyPoiUse } from './poi'
import { makeInitialState } from './initialState'
import { XP_COOK_SUCCESS, XP_NEST_EGG } from './runProgression'

const content = ContentDB.createDefault()

describe('applyPoiUse', () => {
  it('KuratkoNest bare use hints; tool drag harvests eggs until empty', () => {
    const base = makeInitialState(content)
    const rev0 = base.floor.floorGeomRevision
    const stickId = 'i_stick_nest' as ItemId
    const state = {
      ...base,
      floor: {
        ...base.floor,
        seed: 42,
        pois: [{ id: 'nest1', kind: 'KuratkoNest' as const, pos: { x: 4, y: 4 }, eggsLeft: 2, opened: false }],
      },
      party: {
        ...base.party,
        items: {
          ...base.party.items,
          [stickId]: { id: stickId, defId: 'Stick', qty: 1 },
        },
      },
    }
    const hint = applyPoiUse(state, content, 'nest1')
    expect(hint.floor.pois.find((p) => p.id === 'nest1')?.eggsLeft).toBe(2)
    expect(hint.ui.activityLog?.[hint.ui.activityLog.length - 1]?.text).toContain('bare-handed')

    const n1 = applyItemOnPoi(state, content, stickId, 'nest1')
    expect(n1.floor.pois.find((p) => p.id === 'nest1')?.eggsLeft).toBe(1)
    expect(n1.floor.itemsOnFloor.some((it) => n1.party.items[it.id]?.defId === 'KuratkoEgg')).toBe(true)
    expect(n1.floor.floorGeomRevision).toBe(rev0 + 1)
    expect(n1.ui.activityLog?.[n1.ui.activityLog.length - 1]?.text).toBe(`You pry a Kuratko egg loose. (+${XP_NEST_EGG} XP)`)

    const n2 = applyItemOnPoi(n1, content, stickId, 'nest1')
    const nestOpen = n2.floor.pois.find((p) => p.id === 'nest1')
    expect(nestOpen?.eggsLeft).toBe(0)
    expect(nestOpen?.opened).toBe(true)

    const n3 = applyPoiUse(n2, content, 'nest1')
    const last = n3.ui.activityLog?.[n3.ui.activityLog.length - 1]
    expect(last?.text).toBe('The nest is empty.')
  })

  it('KuratkoNest rejects non-tool item drag with eggs', () => {
    const base = makeInitialState(content)
    const saltId = 'i_salt_nest' as ItemId
    const state = {
      ...base,
      floor: {
        ...base.floor,
        pois: [{ id: 'nest1', kind: 'KuratkoNest' as const, pos: { x: 4, y: 4 }, eggsLeft: 1, opened: false }],
      },
      party: {
        ...base.party,
        items: {
          ...base.party.items,
          [saltId]: { id: saltId, defId: 'Salt', qty: 1 },
        },
      },
    }
    const next = applyItemOnPoi(state, content, saltId, 'nest1')
    expect(next.floor.pois.find((p) => p.id === 'nest1')?.eggsLeft).toBe(1)
    expect(next.ui.activityLog?.[next.ui.activityLog.length - 1]?.text).toBe('That will not reach into the nest.')
  })

  it('KuratkoNest tool drag removes empty nest', () => {
    const base = makeInitialState(content)
    const stickId = 'i_stick_empty' as ItemId
    const state = {
      ...base,
      floor: {
        ...base.floor,
        pois: [{ id: 'nest1', kind: 'KuratkoNest' as const, pos: { x: 4, y: 4 }, eggsLeft: 0, opened: true }],
      },
      party: {
        ...base.party,
        items: {
          ...base.party.items,
          [stickId]: { id: stickId, defId: 'Stick', qty: 1 },
        },
      },
    }
    const next = applyItemOnPoi(state, content, stickId, 'nest1')
    expect(next.floor.pois.some((p) => p.id === 'nest1')).toBe(false)
    expect(next.ui.activityLog?.[next.ui.activityLog.length - 1]?.text).toBe('You scatter the empty nest.')
  })

  it('removes an opened Barrel POI and bumps floorGeomRevision', () => {
    const base = makeInitialState(content)
    const partyItemsBefore = Object.keys(base.party.items).length
    const floorItemsBefore = base.floor.itemsOnFloor.length
    const rev0 = base.floor.floorGeomRevision
    const state = {
      ...base,
      floor: {
        ...base.floor,
        pois: [{ id: 't_barrel', kind: 'Barrel' as const, pos: { x: 1, y: 1 }, opened: true }],
      },
    }
    const next = applyPoiUse(state, content, 't_barrel')
    expect(next.floor.pois.some((p) => p.id === 't_barrel')).toBe(false)
    expect(next.floor.floorGeomRevision).toBe(rev0 + 1)
    expect(Object.keys(next.party.items).length).toBe(partyItemsBefore)
    expect(next.floor.itemsOnFloor.length).toBe(floorItemsBefore)
    const last = next.ui.activityLog?.[next.ui.activityLog.length - 1]
    expect(last?.text).toBe('The barrel splinters apart.')
  })

  it('removes an opened Crate POI and bumps floorGeomRevision', () => {
    const base = makeInitialState(content)
    const rev0 = base.floor.floorGeomRevision
    const state = {
      ...base,
      floor: {
        ...base.floor,
        pois: [{ id: 't_crate', kind: 'Crate' as const, pos: { x: 2, y: 2 }, opened: true }],
      },
    }
    const next = applyPoiUse(state, content, 't_crate')
    expect(next.floor.pois.some((p) => p.id === 't_crate')).toBe(false)
    expect(next.floor.floorGeomRevision).toBe(rev0 + 1)
    const last = next.ui.activityLog?.[next.ui.activityLog.length - 1]
    expect(last?.text).toBe('The crate breaks to splinters.')
  })
})

describe('applyItemOnPoi', () => {
  it('Shrine + Sweetroot consumes offering and grants Blessed to living party', () => {
    const base = makeInitialState(content)
    const itemId = 'i_sweet_offer' as ItemId
    const state = {
      ...base,
      floor: {
        ...base.floor,
        pois: [{ id: 'shrine1', kind: 'Shrine' as const, pos: { x: 1, y: 1 } }],
      },
      party: {
        ...base.party,
        items: {
          ...base.party.items,
          [itemId]: { id: itemId, defId: 'Sweetroot', qty: 1 },
        },
      },
    }
    const next = applyItemOnPoi(state, content, itemId, 'shrine1')
    expect(next.party.items[itemId]).toBeUndefined()
    for (const c of next.party.chars) {
      if (c.hp > 0) {
        expect(c.statuses.some((s) => s.id === 'Blessed')).toBe(true)
      }
    }
    const last = next.ui.activityLog?.[next.ui.activityLog.length - 1]
    expect(last?.text).toContain('shrine')
  })

  it('Campfire + Mushrooms roasts and drops RoastMushrooms on the floor', () => {
    const base = makeInitialState(content)
    const itemId = 'i_raw_mush' as ItemId
    const chars = base.party.chars.map((c, i) => (i === 0 ? { ...c, skills: { ...c.skills, cooking: 10 } } : c))
    const state = {
      ...base,
      floor: {
        ...base.floor,
        seed: 7,
        pois: [{ id: 'cf1', kind: 'Campfire' as const, pos: { x: 3, y: 3 }, cookUsesLeft: 6 }],
      },
      party: {
        ...base.party,
        chars,
        items: {
          ...base.party.items,
          [itemId]: { id: itemId, defId: 'Mushrooms', qty: 1 },
        },
      },
    }
    const next = applyItemOnPoi(state, content, itemId, 'cf1')
    expect(next.party.items[itemId]).toBeUndefined()
    const roastOnFloor = next.floor.itemsOnFloor.find((it) => next.party.items[it.id]?.defId === 'RoastMushrooms')
    expect(roastOnFloor).toBeDefined()
    const cf = next.floor.pois.find((p) => p.id === 'cf1')
    expect(cf?.kind).toBe('Campfire')
    expect(cf?.cookUsesLeft).toBe(5)
    const last = next.ui.activityLog?.[next.ui.activityLog.length - 1]
    expect(last?.text).toBe(`Roasted. (+${XP_COOK_SUCCESS} XP)`)
  })

  it('Campfire removes itself after last cook use', () => {
    const base = makeInitialState(content)
    const itemId = 'i_raw_mush2' as ItemId
    const chars = base.party.chars.map((c, i) => (i === 0 ? { ...c, skills: { ...c.skills, cooking: 10 } } : c))
    const state = {
      ...base,
      floor: {
        ...base.floor,
        seed: 11,
        pois: [{ id: 'cf2', kind: 'Campfire' as const, pos: { x: 2, y: 2 }, cookUsesLeft: 1 }],
      },
      party: {
        ...base.party,
        chars,
        items: {
          ...base.party.items,
          [itemId]: { id: itemId, defId: 'Mushrooms', qty: 1 },
        },
      },
    }
    const next = applyItemOnPoi(state, content, itemId, 'cf2')
    expect(next.floor.pois.some((p) => p.id === 'cf2')).toBe(false)
  })

  it('Campfire + Snailing roasts to RoastSnailing', () => {
    const base = makeInitialState(content)
    const itemId = 'i_raw_snail' as ItemId
    const chars = base.party.chars.map((c, i) => (i === 0 ? { ...c, skills: { ...c.skills, cooking: 10 } } : c))
    const state = {
      ...base,
      floor: {
        ...base.floor,
        seed: 23,
        pois: [{ id: 'cfSnail', kind: 'Campfire' as const, pos: { x: 4, y: 4 }, cookUsesLeft: 5 }],
      },
      party: {
        ...base.party,
        chars,
        items: {
          ...base.party.items,
          [itemId]: { id: itemId, defId: 'Snailing', qty: 1 },
        },
      },
    }
    const next = applyItemOnPoi(state, content, itemId, 'cfSnail')
    expect(next.party.items[itemId]).toBeUndefined()
    const roastOnFloor = next.floor.itemsOnFloor.find((it) => next.party.items[it.id]?.defId === 'RoastSnailing')
    expect(roastOnFloor).toBeDefined()
    const last = next.ui.activityLog?.[next.ui.activityLog.length - 1]
    expect(last?.text).toBe(`Roasted. (+${XP_COOK_SUCCESS} XP)`)
  })

  it('Campfire + KuratkoEgg roasts to RoastKuratkoEgg', () => {
    const base = makeInitialState(content)
    const itemId = 'i_k_egg' as ItemId
    const chars = base.party.chars.map((c, i) => (i === 0 ? { ...c, skills: { ...c.skills, cooking: 10 } } : c))
    const state = {
      ...base,
      floor: {
        ...base.floor,
        seed: 19,
        pois: [{ id: 'cfEgg', kind: 'Campfire' as const, pos: { x: 5, y: 5 }, cookUsesLeft: 4 }],
      },
      party: {
        ...base.party,
        chars,
        items: {
          ...base.party.items,
          [itemId]: { id: itemId, defId: 'KuratkoEgg', qty: 1 },
        },
      },
    }
    const next = applyItemOnPoi(state, content, itemId, 'cfEgg')
    expect(next.party.items[itemId]).toBeUndefined()
    const roastOnFloor = next.floor.itemsOnFloor.find((it) => next.party.items[it.id]?.defId === 'RoastKuratkoEgg')
    expect(roastOnFloor).toBeDefined()
    const last = next.ui.activityLog?.[next.ui.activityLog.length - 1]
    expect(last?.text).toBe(`Roasted. (+${XP_COOK_SUCCESS} XP)`)
  })

  it('Campfire rejects unknown ingredients without consuming', () => {
    const base = makeInitialState(content)
    const itemId = 'i_salt' as ItemId
    const state = {
      ...base,
      floor: {
        ...base.floor,
        pois: [{ id: 'cf3', kind: 'Campfire' as const, pos: { x: 1, y: 1 }, cookUsesLeft: 3 }],
      },
      party: {
        ...base.party,
        items: {
          ...base.party.items,
          [itemId]: { id: itemId, defId: 'Salt', qty: 1 },
        },
      },
    }
    const next = applyItemOnPoi(state, content, itemId, 'cf3')
    expect(next.party.items[itemId]?.defId).toBe('Salt')
    expect(next.floor.pois.find((p) => p.id === 'cf3')?.cookUsesLeft).toBe(3)
    const last = next.ui.activityLog?.[next.ui.activityLog.length - 1]
    expect(last?.text).toBe('That will not cook here.')
  })
})

describe('applyItemOnPoi — Well', () => {
  it('rejects empty vessel transform when the well is drained', () => {
    const base = makeInitialState(content)
    const bagId = 'i_bag_dry' as ItemId
    const state = {
      ...base,
      floor: {
        ...base.floor,
        pois: [{ id: 'poi_well', kind: 'Well' as const, pos: { x: 4, y: 4 }, drained: true }],
      },
      party: {
        ...base.party,
        items: {
          ...base.party.items,
          [bagId]: { id: bagId, defId: 'WaterbagEmpty', qty: 1 },
        },
      },
    }
    const next = applyItemOnPoi(state, content, bagId, 'poi_well')
    expect(next.party.items[bagId]?.defId).toBe('WaterbagEmpty')
    expect(next.floor.pois.find((p) => p.id === 'poi_well')?.drained).toBe(true)
    const last = next.ui.activityLog?.[next.ui.activityLog.length - 1]
    expect(last?.text).toBe('The well is dry.')
  })
})
