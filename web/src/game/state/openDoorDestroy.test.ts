import { describe, expect, it } from 'vitest'
import { ContentDB } from '../content/contentDb'
import { reduce } from '../reducer'
import type { GameState, ItemId } from '../types'
import { makeInitialState } from './initialState'
import { canItemBreakOpenDoor } from './openDoorDestroy'

const content = ContentDB.createDefault()

describe('canItemBreakOpenDoor', () => {
  it('allows Chisel', () => {
    expect(canItemBreakOpenDoor(content, 'Chisel')).toBe(true)
  })
  it('allows non-consuming weapons', () => {
    expect(canItemBreakOpenDoor(content, 'Club')).toBe(true)
    expect(canItemBreakOpenDoor(content, 'Staff')).toBe(true)
  })
  it('rejects non-weapons except Chisel', () => {
    expect(canItemBreakOpenDoor(content, 'Mushrooms')).toBe(false)
    expect(canItemBreakOpenDoor(content, 'Twine')).toBe(false)
  })
  it('rejects weapons that consume on use', () => {
    expect(canItemBreakOpenDoor(content, 'Firebolt')).toBe(false)
  })
})

describe('drag/drop openDoor', () => {
  function withOpenDoorEastOfPlayer(overrides?: Partial<GameState>): GameState {
    let s = makeInitialState(content)
    s = { ...s, ...overrides }
    const { w } = s.floor
    const px = 5
    const py = 5
    const doorX = px + 1
    const doorY = py
    const doorIdx = doorX + doorY * w
    const tiles = s.floor.tiles.slice()
    if (tiles[doorIdx] === 'wall') tiles[doorIdx] = 'floor'
    tiles[doorIdx] = 'doorOpen'
    const clubId = 'i_od_club' as ItemId
    const slots = s.party.inventory.slots.slice()
    slots[0] = clubId
    return {
      ...s,
      ui: { ...s.ui, screen: 'game' },
      floor: {
        ...s.floor,
        tiles,
        playerPos: { x: px, y: py },
        playerDir: 1,
      },
      party: {
        ...s.party,
        items: { ...s.party.items, [clubId]: { id: clubId, defId: 'Club', qty: 1 } },
        inventory: { ...s.party.inventory, slots },
      },
    }
  }

  it('turns doorOpen into floor and bumps floorGeomRevision', () => {
    let s = withOpenDoorEastOfPlayer()
    const doorIdx = 6 + 5 * s.floor.w
    const rev0 = s.floor.floorGeomRevision
    const clubId = 'i_od_club' as ItemId
    s = reduce(s, {
      type: 'drag/drop',
      payload: { itemId: clubId, source: { kind: 'inventorySlot', slotIndex: 0, itemId: clubId } },
      target: { kind: 'openDoor', x: 6, y: 5 },
    })
    expect(s.floor.tiles[doorIdx]).toBe('floor')
    expect(s.floor.floorGeomRevision).toBe(rev0 + 1)
    expect(s.ui.activityLog.some((e) => e.text.includes('splinters'))).toBe(true)
  })

  it('removes gen.doors entry at that cell when present', () => {
    let s = withOpenDoorEastOfPlayer()
    const g = s.floor.gen
    if (!g) throw new Error('expected gen')
    s = {
      ...s,
      floor: {
        ...s.floor,
        gen: {
          ...g,
          doors: [
            ...g.doors,
            { pos: { x: 6, y: 5 }, locked: true, lockId: 'Z', keyDefId: 'IronKey' as const },
          ],
        },
      },
    }
    const before = s.floor.gen!.doors.length
    const clubId = 'i_od_club' as ItemId
    s = reduce(s, {
      type: 'drag/drop',
      payload: { itemId: clubId, source: { kind: 'inventorySlot', slotIndex: 0, itemId: clubId } },
      target: { kind: 'openDoor', x: 6, y: 5 },
    })
    expect(s.floor.gen!.doors.length).toBe(before - 1)
    expect(s.floor.gen!.doors.some((d) => d.pos.x === 6 && d.pos.y === 5)).toBe(false)
  })

  it('rejects wrong item', () => {
    let s = withOpenDoorEastOfPlayer()
    const mushId = 'i_od_m' as ItemId
    const slots = s.party.inventory.slots.slice()
    slots[0] = mushId
    s = {
      ...s,
      party: {
        ...s.party,
        items: { ...s.party.items, [mushId]: { id: mushId, defId: 'Mushrooms', qty: 1 } },
        inventory: { ...s.party.inventory, slots },
      },
    }
    const doorIdx = 6 + 5 * s.floor.w
    const tileBefore = s.floor.tiles[doorIdx]
    s = reduce(s, {
      type: 'drag/drop',
      payload: { itemId: mushId, source: { kind: 'inventorySlot', slotIndex: 0, itemId: mushId } },
      target: { kind: 'openDoor', x: 6, y: 5 },
    })
    expect(s.floor.tiles[doorIdx]).toBe(tileBefore)
    expect(s.ui.activityLog.some((e) => e.text.includes('right tool'))).toBe(true)
  })

  it('rejects when Manhattan range exceeded', () => {
    let s = withOpenDoorEastOfPlayer({
      render: { ...makeInitialState(content).render, dropRangeCells: 0 },
    })
    const clubId = 'i_od_club' as ItemId
    s = reduce(s, {
      type: 'drag/drop',
      payload: { itemId: clubId, source: { kind: 'inventorySlot', slotIndex: 0, itemId: clubId } },
      target: { kind: 'openDoor', x: 6, y: 5 },
    })
    expect(s.ui.activityLog.some((e) => e.text.includes('Too far'))).toBe(true)
  })

  it('splintering removes item when tool durability hits 0 (portrait toast)', () => {
    let s = withOpenDoorEastOfPlayer()
    const clubId = 'i_od_club' as ItemId
    s = {
      ...s,
      party: {
        ...s.party,
        items: { ...s.party.items, [clubId]: { id: clubId, defId: 'Club', qty: 1, durability: 1 } },
      },
    }
    s = reduce(s, {
      type: 'drag/drop',
      payload: { itemId: clubId, source: { kind: 'inventorySlot', slotIndex: 0, itemId: clubId } },
      target: { kind: 'openDoor', x: 6, y: 5 },
    })
    expect(s.party.items[clubId]).toBeUndefined()
    expect(s.ui.portraitToasts?.some((t) => t.kind === 'status' && t.text.includes('broke'))).toBe(true)
  })

  it('rejects in combat', () => {
    let s = withOpenDoorEastOfPlayer()
    s = {
      ...s,
      combat: {
        encounterId: 'e1',
        turnIndex: 0,
        participants: { pcs: [s.party.chars[0]!.id], npcs: ['n1'] },
      } as GameState['combat'],
    }
    const clubId = 'i_od_club' as ItemId
    s = reduce(s, {
      type: 'drag/drop',
      payload: { itemId: clubId, source: { kind: 'inventorySlot', slotIndex: 0, itemId: clubId } },
      target: { kind: 'openDoor', x: 6, y: 5 },
    })
    expect(s.ui.activityLog.some((e) => e.text.includes('Not while in combat'))).toBe(true)
  })
})
