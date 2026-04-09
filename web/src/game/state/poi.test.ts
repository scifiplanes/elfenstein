import { describe, expect, it } from 'vitest'
import { ContentDB } from '../content/contentDb'
import { applyPoiUse } from './poi'
import { makeInitialState } from './initialState'

const content = ContentDB.createDefault()

describe('applyPoiUse', () => {
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
