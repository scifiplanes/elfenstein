import type { ContentDB } from '../content/contentDb'
import type { GameState, ItemId } from '../types'
import { removeStatus } from './status'
import { consumeItem } from './inventory'
import { makeDropJitter } from './dropJitter'
import { pushActivityLog } from './activityLog'
import { descendToNextFloor } from './floorProgression'

export function applyPoiUse(state: GameState, _content: ContentDB, poiId: string): GameState {
  const poi = state.floor.pois.find((p) => p.id === poiId)
  if (!poi) return state

  if (poi.kind === 'Well') {
    return pushActivityLog(
      {
        ...state,
        ui: {
          ...state.ui,
          shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 120, magnitude: 0.18 },
        },
      },
      'Game saved at the well.',
    )
  }
  if (poi.kind === 'Bed') {
    const chars = state.party.chars.map((c) => ({ ...c, hp: Math.min(100, c.hp + 30), stamina: Math.min(100, c.stamina + 30) }))
    return pushActivityLog(
      {
        ...state,
        party: { ...state.party, chars },
        ui: {
          ...state.ui,
          shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 130, magnitude: 0.2 },
        },
      },
      'Rested.',
    )
  }
  if (poi.kind === 'Chest') {
    if (poi.opened) {
      return pushActivityLog(
        {
          ...state,
          ui: {
            ...state.ui,
            shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 110, magnitude: 0.16 },
          },
        },
        'The chest is empty.',
      )
    }

    const loot = pickChestLootDefId(state, poiId)
    const newId = (`i_${loot}_${state.floor.seed}_${poiId}` as unknown) as ItemId

    const items = { ...state.party.items, [newId]: { id: newId, defId: loot, qty: 1 } }
    const jitter = makeDropJitter({
      floorSeed: state.floor.seed,
      itemId: newId,
      nonce: Math.floor(state.nowMs),
      radius: state.render.dropJitterRadius ?? 0.28,
    })
    const itemsOnFloor = state.floor.itemsOnFloor.concat([{ id: newId, pos: { ...poi.pos }, jitter }])
    const pois = state.floor.pois.map((p) => (p.id === poiId ? { ...p, opened: true } : p))
    const sfxQueue = (state.ui.sfxQueue ?? []).concat([{ id: `s_${state.nowMs}_${(state.ui.sfxQueue ?? []).length}`, kind: 'pickup' }])

    return pushActivityLog(
      {
        ...state,
        party: { ...state.party, items },
        floor: { ...state.floor, pois, itemsOnFloor },
        ui: {
          ...state.ui,
          shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 160, magnitude: 0.28 },
          sfxQueue,
        },
      },
      'Chest opened.',
    )
  }
  if (poi.kind === 'Shrine') {
    let next = state
    for (const c of state.party.chars) next = removeStatus(next, c.id, 'Cursed')
    const removedAny = next !== state
    return pushActivityLog(
      {
        ...next,
        ui: {
          ...next.ui,
          shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 140, magnitude: removedAny ? 0.26 : 0.18 },
        },
      },
      removedAny ? 'A weight lifts from the party.' : 'The shrine is silent.',
    )
  }
  if (poi.kind === 'CrackedWall') {
    return pushActivityLog(
      {
        ...state,
        ui: {
          ...state.ui,
          shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 110, magnitude: 0.16 },
        },
      },
      'A cracked wall. Maybe a tool could pry it open.',
    )
  }
  if (poi.kind === 'Exit') {
    return descendToNextFloor(state)
  }

  return state
}

export function applyItemOnPoi(state: GameState, content: ContentDB, itemId: ItemId, poiId: string): GameState {
  const poi = state.floor.pois.find((p) => p.id === poiId)
  const item = state.party.items[itemId]
  if (!poi || !item) return state

  if (poi.kind === 'Well') {
    const def = content.item(item.defId)
    const hook = def.useOnPoi?.Well
    if (hook?.transformTo) {
      const nextItem = { ...item, defId: hook.transformTo }
      const pois = state.floor.pois.map((x) => (x.id === poiId && x.kind === 'Well' ? { ...x, drained: true } : x))
      return pushActivityLog(
        {
          ...state,
          floor: { ...state.floor, pois },
          party: { ...state.party, items: { ...state.party.items, [itemId]: nextItem } },
          ui: {
            ...state.ui,
            shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 140, magnitude: 0.22 },
          },
        },
        hook.toast ?? 'Done.',
      )
    }
    return pushActivityLog(
      {
        ...state,
        ui: {
          ...state.ui,
          shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 110, magnitude: 0.14 },
        },
      },
      'The well is cool and still.',
    )
  }

  if (poi.kind === 'Bed') return applyPoiUse(state, content, poiId)

  if (poi.kind === 'Chest') {
    // Treat “item on chest” as “use chest”.
    return applyPoiUse(state, content, poiId)
  }

  if (poi.kind === 'Shrine') return applyPoiUse(state, content, poiId)

  if (poi.kind === 'CrackedWall') {
    const okTool = item.defId === 'Chisel' || item.defId === 'StoneShard'
    if (!okTool) {
      return pushActivityLog(
        {
          ...state,
          ui: {
            ...state.ui,
            shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 110, magnitude: 0.16 },
          },
        },
        'That will not chip stone.',
      )
    }

    const seed = hashStr(`${state.floor.seed}:crackedWall:${poi.id}:${poi.pos.x},${poi.pos.y}:${item.defId}:${item.id}`)
    const roll = (seed % 100) + 1 // 1..100
    const success = roll > 35 // MVP: 65% base success

    if (!success) {
      const breakRoll = ((seed >>> 9) % 100) + 1
      const breakChance = item.defId === 'Chisel' ? 18 : 8
      let next = state
      if (breakRoll <= breakChance) next = consumeItem(next, itemId)
      return pushActivityLog(
        {
          ...next,
          ui: {
            ...next.ui,
            shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 140, magnitude: 0.28 },
            sfxQueue: (next.ui.sfxQueue ?? []).concat([{ id: `s_${state.nowMs}_${(next.ui.sfxQueue ?? []).length}`, kind: 'reject' }]),
          },
        },
        breakRoll <= breakChance ? 'You slip—your tool breaks.' : 'You chip at it, but it holds.',
      )
    }

    // Success: open the wall into a floor tile and remove the POI marker.
    const { x, y } = poi.pos
    const idx = x + y * state.floor.w
    const tiles = state.floor.tiles.slice()
    tiles[idx] = 'floor'
    const pois = state.floor.pois.filter((p) => p.id !== poi.id)
    return pushActivityLog(
      {
        ...state,
        floor: { ...state.floor, tiles, pois },
        ui: {
          ...state.ui,
          shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 160, magnitude: 0.35 },
          sfxQueue: (state.ui.sfxQueue ?? []).concat([{ id: `s_${state.nowMs}_${(state.ui.sfxQueue ?? []).length}`, kind: 'pickup' }]),
        },
      },
      'The cracked wall gives way.',
    )
  }

  return state
}

function pickChestLootDefId(state: GameState, poiId: string): string {
  // MVP deterministic loot table; replace with content-driven tables later.
  const table = [
    'Stick',
    'Stone',
    'Mushrooms',
    'Foodroot',
    'BandageStrip',
    'AntitoxinVial',
    'HerbPoultice',
    'Chisel',
  ] as const
  const seed = hashStr(`${state.floor.seed}:chest:${poiId}`)
  return table[seed % table.length]
}

function hashStr(s: string) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

