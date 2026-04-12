import type { ContentDB } from '../content/contentDb'
import { STORAGE_POI_LOOT_DEF_IDS_BY_FLOOR } from '../content/poiLootTables'
import type { CharacterId, GameState, ItemDefId, ItemId } from '../types'
import { addStatus, removeStatus } from './status'
import { consumeItem } from './inventory'
import { makeDropJitter } from './dropJitter'
import { pushActivityLog } from './activityLog'
import { descendToNextFloor } from './floorProgression'
import {
  applyXpWithActivityLog,
  hpMax,
  staminaMax,
  XP_CONTAINER_OPEN,
  XP_COOK_SUCCESS,
  XP_NEST_EGG,
  XP_SECRET_OPEN,
  XP_SHRINE_PURIFY,
} from './runProgression'
import { applyItemDurabilityWear, inventoryItemFromDef } from './itemDurability'
import { canItemBreakKuratkoNest } from './openDoorDestroy'

/** Raw → roast output for `Campfire` POI (drag ingredient onto fire). */
const CAMPFIRE_ROAST: Partial<Record<ItemDefId, ItemDefId>> = {
  Mushrooms: 'RoastMushrooms',
  Foodroot: 'RoastFoodroot',
  Grubling: 'RoastGrub',
  Snailing: 'RoastSnailing',
  Fungus: 'RoastFungus',
  KuratkoEgg: 'RoastKuratkoEgg',
}

const CAMPFIRE_COOK_DC = 9

export function applyPoiUse(state: GameState, _content: ContentDB, poiId: string): GameState {
  const poi = state.floor.pois.find((p) => p.id === poiId)
  if (!poi) return state

  if (poi.kind === 'Barrel' || poi.kind === 'Crate') {
    if (poi.opened) {
      const pois = state.floor.pois.filter((p) => p.id !== poiId)
      const q = state.ui.sfxQueue ?? []
      const sfxQueue = q.concat([{ id: `s_${state.nowMs}_${q.length}`, kind: 'pickup' as const }])
      const msg = poi.kind === 'Barrel' ? 'The barrel splinters apart.' : 'The crate breaks to splinters.'
      return pushActivityLog(
        {
          ...state,
          floor: { ...state.floor, pois, floorGeomRevision: state.floor.floorGeomRevision + 1 },
          ui: {
            ...state.ui,
            shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 160, magnitude: 0.3 },
            sfxQueue,
          },
        },
        msg,
      )
    }

    const loot = pickContainerLootDefId(state, poiId)
    const newId = (`i_${loot}_${state.floor.seed}_${poiId}` as unknown) as ItemId

    const items = { ...state.party.items, [newId]: inventoryItemFromDef(_content, loot, newId, 1) }
    const jitter = makeDropJitter({
      floorSeed: state.floor.seed,
      itemId: newId,
      nonce: Math.floor(state.nowMs),
      radius: state.render.dropJitterRadius ?? 0.28,
    })
    const itemsOnFloor = state.floor.itemsOnFloor.concat([{ id: newId, pos: { ...poi.pos }, jitter }])
    const pois = state.floor.pois.map((p) => (p.id === poiId ? { ...p, opened: true } : p))
    const sfxQueue = (state.ui.sfxQueue ?? []).concat([{ id: `s_${state.nowMs}_${(state.ui.sfxQueue ?? []).length}`, kind: 'pickup' }])

    const openedState: GameState = {
      ...state,
      party: { ...state.party, items },
      floor: { ...state.floor, pois, itemsOnFloor, floorGeomRevision: state.floor.floorGeomRevision + 1 },
      ui: {
        ...state.ui,
        shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 150, magnitude: 0.26 },
        sfxQueue,
      },
    }
    return applyXpWithActivityLog(
      openedState,
      XP_CONTAINER_OPEN,
      `${poi.kind} opened. (+${XP_CONTAINER_OPEN} XP)`,
    )
  }

  if (poi.kind === 'Well') {
    const { checkpoint: _checkpoint, ...runWithoutCheckpoint } = state.run
    const snapshot: import('../types').CheckpointSnapshot = {
      atMs: state.nowMs,
      run: runWithoutCheckpoint,
      floor: state.floor,
      party: state.party,
      view: state.view,
      ui: {
        screen: state.ui.screen,
        debugOpen: state.ui.debugOpen,
        procgenDebugOverlay: state.ui.procgenDebugOverlay,
        activityLog: state.ui.activityLog,
        knownRecipes: state.ui.knownRecipes,
      },
    }
    const wellSfxQueue = (state.ui.sfxQueue ?? []).concat([{ id: `s_${state.nowMs}_well`, kind: 'well' as const }])
    return pushActivityLog(
      {
        ...state,
        run: { ...state.run, checkpoint: { kind: 'well', savedAtMs: state.nowMs, snapshot } },
        ui: {
          ...state.ui,
          shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 120, magnitude: 0.18 },
          sfxQueue: wellSfxQueue,
        },
      },
      'Game saved at the well.',
    )
  }
  if (poi.kind === 'Bed') {
    if (poi.opened) {
      return pushActivityLog(
        {
          ...state,
          ui: {
            ...state.ui,
            shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 110, magnitude: 0.16 },
          },
        },
        'Already used.',
      )
    }
    const hm = hpMax(state)
    const sm = staminaMax(state)
    const chars = state.party.chars.map((c) => ({ ...c, hp: Math.min(hm, c.hp + 30), stamina: Math.min(sm, c.stamina + 30) }))
    const pois = state.floor.pois.map((p) => (p.id === poiId ? { ...p, opened: true } : p))
    return pushActivityLog(
      {
        ...state,
        party: { ...state.party, chars },
        floor: { ...state.floor, pois, floorGeomRevision: state.floor.floorGeomRevision + 1 },
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

    const items = { ...state.party.items, [newId]: inventoryItemFromDef(_content, loot, newId, 1) }
    const jitter = makeDropJitter({
      floorSeed: state.floor.seed,
      itemId: newId,
      nonce: Math.floor(state.nowMs),
      radius: state.render.dropJitterRadius ?? 0.28,
    })
    const itemsOnFloor = state.floor.itemsOnFloor.concat([{ id: newId, pos: { ...poi.pos }, jitter }])
    const pois = state.floor.pois.map((p) => (p.id === poiId ? { ...p, opened: true } : p))
    const sfxQueue = (state.ui.sfxQueue ?? []).concat([{ id: `s_${state.nowMs}_${(state.ui.sfxQueue ?? []).length}`, kind: 'pickup' }])

    const chestOpened: GameState = {
      ...state,
      party: { ...state.party, items },
      floor: { ...state.floor, pois, itemsOnFloor, floorGeomRevision: state.floor.floorGeomRevision + 1 },
      ui: {
        ...state.ui,
        shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 160, magnitude: 0.28 },
        sfxQueue,
      },
    }
    return applyXpWithActivityLog(chestOpened, XP_CONTAINER_OPEN, `Chest opened. (+${XP_CONTAINER_OPEN} XP)`)
  }
  if (poi.kind === 'Shrine') {
    let next = state
    for (const c of state.party.chars) next = removeStatus(next, c.id, 'Cursed')
    const removedAny = next !== state
    const pois = next.floor.pois.map((p) => (p.id === poiId ? { ...p, opened: true } : p))
    const shrineState: GameState = {
      ...next,
      floor: { ...next.floor, pois, floorGeomRevision: next.floor.floorGeomRevision + 1 },
      ui: {
        ...next.ui,
        shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 140, magnitude: removedAny ? 0.26 : 0.18 },
      },
    }
    if (removedAny) {
      return applyXpWithActivityLog(
        shrineState,
        XP_SHRINE_PURIFY,
        `A weight lifts from the party. (+${XP_SHRINE_PURIFY} XP)`,
      )
    }
    return pushActivityLog(shrineState, 'The shrine is silent.')
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
  if (poi.kind === 'Campfire') {
    return pushActivityLog(
      {
        ...state,
        ui: {
          ...state.ui,
          shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 110, magnitude: 0.14 },
        },
      },
      'The fire crackles.',
    )
  }
  if (poi.kind === 'KuratkoNest') {
    if (poi.opened || (poi.eggsLeft ?? 0) <= 0) {
      return pushActivityLog(
        {
          ...state,
          ui: {
            ...state.ui,
            shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 110, magnitude: 0.16 },
          },
        },
        'The nest is empty.',
      )
    }
    return pushActivityLog(
      {
        ...state,
        ui: {
          ...state.ui,
          shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 110, magnitude: 0.16 },
        },
      },
      'The eggs sit too deep to grab bare-handed—drag a stick, blade, or chisel onto the nest.',
    )
  }
  if (poi.kind === 'Exit') {
    return descendToNextFloor(state)
  }

  return state
}

export function applyItemOnPoi(
  state: GameState,
  content: ContentDB,
  itemId: ItemId,
  poiId: string,
  opts?: { durabilityCharacterHint?: CharacterId },
): GameState {
  const poi = state.floor.pois.find((p) => p.id === poiId)
  const item = state.party.items[itemId]
  if (!poi || !item) return state

  if (poi.kind === 'Well') {
    const def = content.item(item.defId)
    const hook = def.useOnPoi?.Well
    if (hook?.transformTo && poi.drained) {
      return pushActivityLog(
        {
          ...state,
          ui: {
            ...state.ui,
            shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 110, magnitude: 0.14 },
          },
        },
        'The well is dry.',
      )
    }
    if (hook?.transformTo) {
      const nextItem = { ...item, defId: hook.transformTo }
      const pois = state.floor.pois.map((x) => (x.id === poiId && x.kind === 'Well' ? { ...x, drained: true } : x))
      return pushActivityLog(
        {
          ...state,
          floor: { ...state.floor, pois, floorGeomRevision: state.floor.floorGeomRevision + 1 },
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

  if (poi.kind === 'KuratkoNest') {
    const itemOk = canItemBreakKuratkoNest(content, item.defId)
    if (!itemOk) {
      return pushActivityLog(
        {
          ...state,
          ui: {
            ...state.ui,
            shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 110, magnitude: 0.16 },
            sfxQueue: (state.ui.sfxQueue ?? []).concat([{ id: `s_${state.nowMs}_${(state.ui.sfxQueue ?? []).length}`, kind: 'reject' as const }]),
          },
        },
        'That will not reach into the nest.',
      )
    }

    if (poi.opened || (poi.eggsLeft ?? 0) <= 0) {
      const pois = state.floor.pois.filter((p) => p.id !== poiId)
      const q = state.ui.sfxQueue ?? []
      const sfxQueue = q.concat([{ id: `s_${state.nowMs}_${q.length}`, kind: 'pickup' as const }])
      const scattered = pushActivityLog(
        {
          ...state,
          floor: { ...state.floor, pois, floorGeomRevision: state.floor.floorGeomRevision + 1 },
          ui: {
            ...state.ui,
            shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 150, magnitude: 0.26 },
            sfxQueue,
          },
        },
        'You scatter the empty nest.',
      )
      return applyItemDurabilityWear(scattered, content, itemId, 'toolUse', opts?.durabilityCharacterHint)
    }

    const leftBefore = poi.eggsLeft ?? 0
    const newId = (`i_KuratkoEgg_${state.floor.seed}_${poiId}_${state.nowMs}` as unknown) as ItemId
    const items = { ...state.party.items, [newId]: inventoryItemFromDef(content, 'KuratkoEgg' as ItemDefId, newId, 1) }
    const jitter = makeDropJitter({
      floorSeed: state.floor.seed,
      itemId: newId,
      nonce: Math.floor(state.nowMs),
      radius: state.render.dropJitterRadius ?? 0.28,
    })
    const itemsOnFloor = state.floor.itemsOnFloor.concat([{ id: newId, pos: { ...poi.pos }, jitter }])
    const leftAfter = leftBefore - 1
    const pois = state.floor.pois.map((p) =>
      p.id === poiId
        ? { ...p, eggsLeft: leftAfter, opened: leftAfter <= 0 ? true : p.opened }
        : p,
    )
    const sfxQueue = (state.ui.sfxQueue ?? []).concat([{ id: `s_${state.nowMs}_${(state.ui.sfxQueue ?? []).length}`, kind: 'pickup' }])
    const afterPry: GameState = {
      ...state,
      party: { ...state.party, items },
      floor: { ...state.floor, pois, itemsOnFloor, floorGeomRevision: state.floor.floorGeomRevision + 1 },
      ui: {
        ...state.ui,
        shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 150, magnitude: 0.24 },
        sfxQueue,
      },
    }
    const withWear = applyItemDurabilityWear(afterPry, content, itemId, 'toolUse', opts?.durabilityCharacterHint)
    return applyXpWithActivityLog(
      withWear,
      XP_NEST_EGG,
      `You pry a Kuratko egg loose. (+${XP_NEST_EGG} XP)`,
    )
  }

  if (poi.kind === 'Barrel' || poi.kind === 'Crate') {
    // Treat “item on container” as “use container”.
    return applyPoiUse(state, content, poiId)
  }

  if (poi.kind === 'Shrine') {
    const def = content.item(item.defId)
    const hook = def.useOnPoi?.Shrine
    if (hook && (hook.consumeOffering || (hook.blessPartyMs != null && hook.blessPartyMs > 0))) {
      let next = state
      if (hook.consumeOffering) next = consumeItem(next, itemId)
      if (hook.blessPartyMs != null && hook.blessPartyMs > 0) {
        const untilMs = next.nowMs + hook.blessPartyMs
        for (const c of next.party.chars) {
          if (c.hp > 0) next = addStatus(next, c.id, 'Blessed', untilMs)
        }
      }
      return pushActivityLog(
        {
          ...next,
          ui: {
            ...next.ui,
            shake: { startedAtMs: next.nowMs, untilMs: next.nowMs + 140, magnitude: 0.22 },
            sfxQueue: (next.ui.sfxQueue ?? []).concat([{ id: `s_${next.nowMs}_${(next.ui.sfxQueue ?? []).length}`, kind: 'ui' as const }]),
          },
        },
        hook.toast ?? 'The shrine accepts your offering.',
      )
    }
    return applyPoiUse(state, content, poiId)
  }

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
    const wallOpen: GameState = {
      ...state,
      floor: { ...state.floor, tiles, pois, floorGeomRevision: state.floor.floorGeomRevision + 1 },
      ui: {
        ...state.ui,
        shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 160, magnitude: 0.35 },
        sfxQueue: (state.ui.sfxQueue ?? []).concat([{ id: `s_${state.nowMs}_${(state.ui.sfxQueue ?? []).length}`, kind: 'pickup' }]),
      },
    }
    return applyXpWithActivityLog(
      wallOpen,
      XP_SECRET_OPEN,
      `The cracked wall gives way. (+${XP_SECRET_OPEN} XP)`,
    )
  }

  if (poi.kind === 'Campfire') {
    const outDef = CAMPFIRE_ROAST[item.defId]
    if (!outDef) {
      return pushActivityLog(
        {
          ...state,
          ui: {
            ...state.ui,
            shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 110, magnitude: 0.14 },
          },
        },
        'That will not cook here.',
      )
    }
    const usesNow = poi.cookUsesLeft ?? 6
    if (usesNow <= 0) {
      return pushActivityLog(
        {
          ...state,
          ui: {
            ...state.ui,
            shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 110, magnitude: 0.12 },
          },
        },
        'The fire is cold.',
      )
    }

    const bestCook = state.party.chars.reduce((best, ch) => Math.max(best, Number(ch.skills?.cooking ?? 0)), 0)
    const cookSeed = hashStr(`${state.floor.seed}:campfireCook:${poi.id}:${item.id}:${item.defId}`)
    const d20 = (cookSeed % 20) + 1
    const success = d20 + bestCook >= CAMPFIRE_COOK_DC

    let next = consumeItem(state, itemId)
    if (!success) {
      const leftFail = usesNow - 1
      const poisFail =
        leftFail <= 0
          ? next.floor.pois.filter((p) => p.id !== poi.id)
          : next.floor.pois.map((p) => (p.id === poi.id && p.kind === 'Campfire' ? { ...p, cookUsesLeft: leftFail } : p))
      return pushActivityLog(
        {
          ...next,
          floor: { ...next.floor, pois: poisFail, floorGeomRevision: next.floor.floorGeomRevision + 1 },
          ui: {
            ...next.ui,
            shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 130, magnitude: 0.22 },
            sfxQueue: (next.ui.sfxQueue ?? []).concat([{ id: `s_${state.nowMs}_${(next.ui.sfxQueue ?? []).length}`, kind: 'reject' }]),
          },
        },
        'Burnt.',
      )
    }

    const newId = (`i_${outDef}_${state.floor.seed}_${(cookSeed >>> 8).toString(16)}` as unknown) as ItemId
    const jitter = makeDropJitter({
      floorSeed: next.floor.seed,
      itemId: newId,
      nonce: Math.floor(state.nowMs),
      radius: state.render.dropJitterRadius ?? 0.28,
    })
    const items = { ...next.party.items, [newId]: inventoryItemFromDef(content, outDef, newId, 1) }
    const itemsOnFloor = next.floor.itemsOnFloor.concat([{ id: newId, pos: { ...poi.pos }, jitter }])
    const leftOk = usesNow - 1
    const poisOk =
      leftOk <= 0
        ? next.floor.pois.filter((p) => p.id !== poi.id)
        : next.floor.pois.map((p) => (p.id === poi.id && p.kind === 'Campfire' ? { ...p, cookUsesLeft: leftOk } : p))

    const roasted: GameState = {
      ...next,
      party: { ...next.party, items },
      floor: {
        ...next.floor,
        pois: poisOk,
        itemsOnFloor,
        floorGeomRevision: next.floor.floorGeomRevision + 1,
      },
      ui: {
        ...next.ui,
        shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 120, magnitude: 0.2 },
        sfxQueue: (next.ui.sfxQueue ?? []).concat([{ id: `s_${state.nowMs}_${(next.ui.sfxQueue ?? []).length}`, kind: 'pickup' }]),
      },
    }
    return applyXpWithActivityLog(roasted, XP_COOK_SUCCESS, `Roasted. (+${XP_COOK_SUCCESS} XP)`)
  }

  return state
}

function storageLootPoolForFloor(state: GameState): readonly string[] {
  const pool = STORAGE_POI_LOOT_DEF_IDS_BY_FLOOR[state.floor.floorType]
  return pool.length ? pool : STORAGE_POI_LOOT_DEF_IDS_BY_FLOOR.Dungeon
}

function pickChestLootDefId(state: GameState, poiId: string): string {
  const pool = storageLootPoolForFloor(state)
  const seed = hashStr(`${state.floor.seed}:chest:${poiId}`)
  return pool[seed % pool.length]!
}

function pickContainerLootDefId(state: GameState, poiId: string): string {
  const pool = storageLootPoolForFloor(state)
  const seed = hashStr(`${state.floor.seed}:container:${poiId}`)
  return pool[seed % pool.length]!
}

function hashStr(s: string) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

