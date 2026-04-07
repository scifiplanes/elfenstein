import type { ContentDB } from './content/contentDb'
import type { DragPayload, DragTarget, EquipmentSlot, GameState, ItemId, RenderTuning } from './types'
import { makeInitialState } from './state/initialState'
import { applyStatusDecay } from './state/status'
import { consumeItem, dropItemToFloor, moveItemToInventorySlot, swapInventorySlots } from './state/inventory'
import { feedCharacter, inspectCharacter } from './state/interactions'
import { useItemOnPoi, usePoi } from './state/poi'
import { equipItem, unequipItem } from './state/equipment'
import { generateDungeon } from '../procgen/generateDungeon'
import { pickupFloorItem } from './state/floorItems'
import { findRecipe, maybeFinishCrafting, startCrafting } from './state/crafting'

export type Action =
  | { type: 'ui/toggleDebug' }
  | { type: 'ui/openPaperdoll'; characterId: string }
  | { type: 'ui/closePaperdoll' }
  | { type: 'ui/openNpcDialog'; npcId: string }
  | { type: 'ui/closeNpcDialog' }
  | { type: 'ui/toast'; text: string; ms?: number }
  | { type: 'ui/shake'; magnitude: number; ms?: number }
  | { type: 'ui/sfx'; kind: 'ui' | 'hit' | 'reject' | 'pickup' | 'munch' | 'step' | 'bump' }
  | { type: 'audio/set'; key: keyof GameState['audio']; value: number }
  | { type: 'time/tick'; nowMs: number }
  | { type: 'player/turn'; dir: -1 | 1 }
  | { type: 'player/step'; forward: 1 | -1 }
  | { type: 'player/strafe'; side: -1 | 1 }
  | { type: 'poi/use'; poiId: string }
  | { type: 'floor/pickup'; itemId: ItemId }
  | { type: 'drag/drop'; payload: DragPayload; target: DragTarget }
  | { type: 'equip/unequip'; characterId: string; slot: EquipmentSlot }
  | { type: 'floor/regen'; seed?: number }
  | { type: 'render/set'; key: keyof GameState['render']; value: number }
  | { type: 'debug/loadTuning'; render?: Partial<RenderTuning>; audio?: Partial<GameState['audio']> }
  | { type: 'floor/toggleChest'; poiId: string }
  | { type: 'npc/attack'; npcId: string; itemId: ItemId }
  | { type: 'npc/give'; npcId: string; itemId: ItemId }

export function initialState(content: ContentDB): GameState {
  return makeInitialState(content)
}

export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'ui/toggleDebug':
      return { ...state, ui: { ...state.ui, debugOpen: !state.ui.debugOpen } }
    case 'ui/openPaperdoll':
      return { ...state, ui: { ...state.ui, paperdollFor: action.characterId } }
    case 'ui/closePaperdoll':
      return { ...state, ui: { ...state.ui, paperdollFor: undefined } }
    case 'ui/openNpcDialog':
      return {
        ...state,
        ui: {
          ...state.ui,
          npcDialogFor: action.npcId,
          shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 110, magnitude: 0.16 },
        },
      }
    case 'ui/closeNpcDialog':
      return { ...state, ui: { ...state.ui, npcDialogFor: undefined } }
    case 'ui/toast': {
      const untilMs = state.nowMs + (action.ms ?? 1800)
      return { ...state, ui: { ...state.ui, toast: { id: `t_${state.nowMs}`, text: action.text, untilMs } } }
    }
    case 'ui/shake': {
      const untilMs = state.nowMs + (action.ms ?? 140)
      return { ...state, ui: { ...state.ui, shake: { startedAtMs: state.nowMs, untilMs, magnitude: action.magnitude } } }
    }
    case 'ui/sfx': {
      const q = state.ui.sfxQueue ?? []
      return { ...state, ui: { ...state.ui, sfxQueue: q.concat([{ id: `s_${state.nowMs}_${q.length}`, kind: action.kind }]) } }
    }
    case 'audio/set':
      return { ...state, audio: { ...state.audio, [action.key]: action.value } }
    case 'time/tick': {
      const next: GameState = { ...state, nowMs: action.nowMs }
      const withDecay = applyStatusDecay(next)
      const withCrafting = maybeFinishCrafting(withDecay)
      const withAnim = tickViewAnimation(withCrafting)
      const toast = withCrafting.ui.toast && withCrafting.ui.toast.untilMs <= action.nowMs ? undefined : withCrafting.ui.toast
      const shake = withCrafting.ui.shake && withCrafting.ui.shake.untilMs <= action.nowMs ? undefined : withCrafting.ui.shake
      const portraitMouth =
        withCrafting.ui.portraitMouth && withCrafting.ui.portraitMouth.untilMs <= action.nowMs ? undefined : withCrafting.ui.portraitMouth
      const portraitShake =
        withCrafting.ui.portraitShake && withCrafting.ui.portraitShake.untilMs <= action.nowMs ? undefined : withCrafting.ui.portraitShake
      const sfxQueue = withCrafting.ui.sfxQueue ?? []
      const clearedQueue = sfxQueue.length ? [] : sfxQueue
      if (
        toast !== withAnim.ui.toast ||
        shake !== withAnim.ui.shake ||
        portraitMouth !== withAnim.ui.portraitMouth ||
        portraitShake !== withAnim.ui.portraitShake ||
        clearedQueue !== sfxQueue ||
        withAnim.view !== withCrafting.view
      ) {
        return { ...withAnim, ui: { ...withAnim.ui, toast, shake, portraitMouth, portraitShake, sfxQueue: clearedQueue } }
      }
      return withAnim
    }
    case 'render/set': {
      const raw = { ...state.render, [action.key]: action.value }
      const render = clampRenderTuning(raw)
      let next: GameState = { ...state, render }
      if (action.key === 'camEyeHeight') {
        return applyCamEyeHeight(next, render.camEyeHeight)
      }
      return next
    }
    case 'debug/loadTuning': {
      let render = state.render
      let audio = state.audio
      if (action.render) {
        render = clampRenderTuning({ ...state.render, ...action.render })
      }
      if (action.audio) {
        audio = { ...state.audio, ...action.audio }
      }
      let next: GameState = { ...state, render, audio }
      if (render.camEyeHeight !== state.render.camEyeHeight) {
        next = applyCamEyeHeight(next, render.camEyeHeight)
      }
      return next
    }
    case 'floor/toggleChest': {
      const poi = state.floor.pois.find((p) => p.id === action.poiId)
      if (!poi || poi.kind !== 'Chest') return state
      const nextPois = state.floor.pois.map((p) => (p.id === action.poiId ? { ...p, opened: !p.opened } : p))
      return { ...state, floor: { ...state.floor, pois: nextPois } }
    }
    case 'floor/regen': {
      const nextSeed = (action.seed ?? (Math.floor(state.nowMs) >>> 0)) >>> 0
      const w = state.floor.w
      const h = state.floor.h
      const gen = generateDungeon({ seed: nextSeed, w, h })
      const playerPos = { x: Math.floor(w / 2), y: h - 2 }
      const playerDir = 0 as const
      return {
        ...state,
        floor: {
          ...state.floor,
          seed: nextSeed,
          tiles: gen.tiles,
          pois: gen.pois,
          itemsOnFloor: [],
          npcs: state.floor.npcs,
          playerPos,
          playerDir,
        },
        view: viewSnapToGrid(state, playerPos, playerDir),
        ui: { ...state.ui, toast: { id: `t_${state.nowMs}`, text: `Regenerated (seed ${nextSeed}).`, untilMs: state.nowMs + 1200 } },
      }
    }
    case 'player/turn': {
      if (state.view.anim) return state
      const dir = (((state.floor.playerDir + action.dir) % 4) + 4) % 4
      const fromYaw = state.view.camYaw
      const toYaw = (dir * Math.PI) / 2
      const startedAtMs = state.nowMs
      const endsAtMs = startedAtMs + 90
      return {
        ...state,
        floor: { ...state.floor, playerDir: dir as any },
        view: {
          ...state.view,
          anim: {
            kind: 'turn',
            fromPos: state.view.camPos,
            toPos: state.view.camPos,
            fromYaw,
            toYaw,
            startedAtMs,
            endsAtMs,
          },
        },
      }
    }
    case 'player/step': {
      if (state.view.anim) return state
      const { playerDir, playerPos } = state.floor
      const step = action.forward
      const v = dirVec(playerDir)
      const nx = playerPos.x + v.x * step
      const ny = playerPos.y + v.y * step
      return attemptMoveTo(state, nx, ny)
    }
    case 'player/strafe': {
      if (state.view.anim) return state
      const { playerDir, playerPos } = state.floor
      const v = strafeVec(playerDir, action.side)
      const nx = playerPos.x + v.x
      const ny = playerPos.y + v.y
      return attemptMoveTo(state, nx, ny)
    }
    case 'poi/use': {
      return usePoi(state, action.poiId)
    }
    case 'floor/pickup':
      return pickupFloorItem(state, action.itemId)
    case 'drag/drop': {
      const { payload, target } = action
      const itemId: ItemId = payload.itemId

      if (target.kind === 'inventorySlot') {
        const dst = target.slotIndex
        if (payload.source.kind === 'inventorySlot') {
          const src = payload.source.slotIndex
          const srcItemId = state.party.inventory.slots[src]
          const dstItemId = state.party.inventory.slots[dst]
          const srcItem = srcItemId ? state.party.items[srcItemId] : null
          const dstItem = dstItemId ? state.party.items[dstItemId] : null
          if (srcItem && dstItem) {
            const recipe = findRecipe(srcItem.defId, dstItem.defId)
            if (recipe) {
              const withStart = startCrafting(state, srcItem.id, dstItem.id, recipe)
              return reduce(reduce(withStart, { type: 'ui/sfx', kind: 'ui' }), { type: 'ui/shake', magnitude: 0.2, ms: 90 })
            }
          }
          return swapInventorySlots(state, src, dst)
        }
        return moveItemToInventorySlot(state, itemId, dst)
      }

      if (target.kind === 'floorDrop') {
        return dropItemToFloor(state, itemId)
      }

      if (target.kind === 'floorItem') {
        // When dragging onto a floor item, interpret as pickup.
        return pickupFloorItem(state, target.itemId)
      }

      if (target.kind === 'portrait') {
        if (target.target === 'eyes') return inspectCharacter(state, target.characterId, itemId)
        return feedCharacter(state, target.characterId, itemId)
      }

      if (target.kind === 'poi') {
        return useItemOnPoi(state, itemId, target.poiId)
      }

      if (target.kind === 'equipmentSlot') {
        return equipItem(state, target.characterId, target.slot, itemId)
      }

      if (target.kind === 'npc') {
        const item = state.party.items[itemId]
        const isWeapon = item?.defId === 'Club' || item?.defId === 'Stick' || item?.defId === 'Stone' || item?.defId === 'Spear'
        return isWeapon
          ? reduce(state, { type: 'npc/attack', npcId: target.npcId, itemId })
          : reduce(state, { type: 'npc/give', npcId: target.npcId, itemId })
      }

      return state
    }
    case 'npc/attack': {
      const npcIdx = state.floor.npcs.findIndex((n) => n.id === action.npcId)
      const item = state.party.items[action.itemId]
      if (npcIdx < 0 || !item) return state
      const isWeapon = item.defId === 'Club' || item.defId === 'Stick' || item.defId === 'Stone' || item.defId === 'Spear' || item.defId === 'Firebolt'
      if (!isWeapon) {
        return reduce(
          { ...state, ui: { ...state.ui, toast: { id: `t_${state.nowMs}`, text: 'That does not work as a weapon.', untilMs: state.nowMs + 1400 } } },
          { type: 'ui/sfx', kind: 'reject' },
        )
      }
      const npcs = state.floor.npcs.slice()
      const npc = npcs[npcIdx]
      const dmg =
        item.defId === 'Club' ? 7
        : item.defId === 'Spear' ? 8
        : item.defId === 'Firebolt' ? 10
        : item.defId === 'Stone' ? 5
        : 4
      const hp = Math.max(0, npc.hp - dmg)
      npcs[npcIdx] = { ...npc, hp }
      const died = hp === 0
      let nextState: GameState = { ...state, floor: { ...state.floor, npcs: died ? npcs.filter((n) => n.id !== npc.id) : npcs } }

      // Spell-like items are consumed on use.
      if (item.defId === 'Firebolt') nextState = consumeItem(nextState, action.itemId)

      // On death, sometimes drop loot to the floor.
      if (died) {
        const lootDef = pickNpcLootDefId(nextState, npc.id)
        if (lootDef) {
          const lootId = `i_${lootDef}_${Math.floor(nextState.nowMs)}`
          nextState = {
            ...nextState,
            party: { ...nextState.party, items: { ...nextState.party.items, [lootId]: { id: lootId, defId: lootDef, qty: 1 } } },
            floor: { ...nextState.floor, itemsOnFloor: nextState.floor.itemsOnFloor.concat([{ id: lootId, pos: { ...npc.pos } }]) },
          }
        }
      }
      const withToast = {
        ...nextState,
        ui: { ...nextState.ui, toast: { id: `t_${state.nowMs}`, text: died ? `${npc.name} dies.` : `${npc.name} takes ${dmg} dmg.`, untilMs: state.nowMs + 1200 } },
      }
      const withHit = reduce(withToast, { type: 'ui/sfx', kind: 'hit' })
      return reduce(withHit, { type: 'ui/shake', magnitude: died ? 0.7 : 0.4, ms: died ? 220 : 140 })
    }
    case 'npc/give': {
      const npcIdx = state.floor.npcs.findIndex((n) => n.id === action.npcId)
      const item = state.party.items[action.itemId]
      if (npcIdx < 0 || !item) return state
      const npc = state.floor.npcs[npcIdx]
      const quest = npc.quest
      if (!quest) {
        return reduce(
          { ...state, ui: { ...state.ui, toast: { id: `t_${state.nowMs}`, text: `${npc.name} ignores it.`, untilMs: state.nowMs + 1200 } } },
          { type: 'ui/sfx', kind: 'reject' },
        )
      }
      if (quest.hated.includes(item.defId)) {
        const npcs = state.floor.npcs.slice()
        npcs[npcIdx] = { ...npc, status: 'hostile' }
        const withNpc = { ...state, floor: { ...state.floor, npcs } }
        return reduce(
          { ...withNpc, ui: { ...withNpc.ui, toast: { id: `t_${state.nowMs}`, text: `${npc.name} becomes hostile!`, untilMs: state.nowMs + 1400 } } },
          { type: 'ui/sfx', kind: 'reject' },
        )
      }
      if (quest.wants === item.defId) {
        // Consume item and improve status.
        const npcs = state.floor.npcs.slice()
        const nextStatus = npc.status === 'hostile' ? 'neutral' : 'friendly'
        npcs[npcIdx] = { ...npc, status: nextStatus }
        const withNpc = { ...state, floor: { ...state.floor, npcs } }
        const withConsume = consumeItem(withNpc, action.itemId)
        const withToast = {
          ...withConsume,
          ui: { ...withConsume.ui, toast: { id: `t_${state.nowMs}`, text: `${npc.name} accepts it.`, untilMs: state.nowMs + 1200 } },
        }
        return reduce(withToast, { type: 'ui/sfx', kind: 'pickup' })
      }
      return reduce(
        { ...state, ui: { ...state.ui, toast: { id: `t_${state.nowMs}`, text: `${npc.name} rejects it.`, untilMs: state.nowMs + 1200 } } },
        { type: 'ui/sfx', kind: 'reject' },
      )
    }
    case 'equip/unequip':
      return unequipItem(state, action.characterId, action.slot)
    default:
      return state
  }
}

function pickNpcLootDefId(state: GameState, npcId: string): null | string {
  // MVP deterministic “sometimes” drop.
  const seed = (Math.floor(state.nowMs) ^ hashStr(npcId) ^ (state.floor.seed * 131)) >>> 0
  const dropRoll = (seed % 100) + 1
  if (dropRoll > 45) return null
  const table = ['Stone', 'Stick', 'Mushrooms', 'Foodroot', 'Ash', 'Sulfur'] as const
  return table[(seed >>> 8) % table.length]
}

function clampRenderTuning(r: RenderTuning): RenderTuning {
  const m = Math.round(r.ditherMatrixSize)
  const ditherMatrixSize: RenderTuning['ditherMatrixSize'] = m <= 3 ? 2 : m <= 6 ? 4 : 8
  const p = Math.max(0, Math.min(4, Math.round(r.ditherPalette)))
  const lanternBeamPenumbra = Math.max(0, Math.min(1, r.lanternBeamPenumbra))
  const lanternBeamAngleDeg = Math.max(1, Math.min(80, r.lanternBeamAngleDeg))
  const lanternBeamDistanceScale = Math.max(0.1, Math.min(6, r.lanternBeamDistanceScale))
  const lanternBeamIntensityScale = Math.max(0, Math.min(10, r.lanternBeamIntensityScale))
  const lanternForwardOffset = Math.max(0, Math.min(2, r.lanternForwardOffset))
  const lanternVerticalOffset = Math.max(-1, Math.min(1, r.lanternVerticalOffset))
  const lanternFlickerAmp = Math.max(0, Math.min(1, r.lanternFlickerAmp))
  const lanternFlickerHz = Math.max(0, Math.min(30, r.lanternFlickerHz))
  const baseEmissive = Math.max(0, Math.min(2, r.baseEmissive))
  const camShakePosAmp = Math.max(0, Math.min(0.25, r.camShakePosAmp))
  const camShakeRollDeg = Math.max(0, Math.min(12, r.camShakeRollDeg))
  const camShakeHz = Math.max(0, Math.min(40, r.camShakeHz))
  const camShakeLengthMs = Math.max(0, Math.min(12_000, Math.round(Number(r.camShakeLengthMs ?? 0))))
  const camShakeDecayMs = Math.max(0, Math.min(3000, Math.round(Number(r.camShakeDecayMs ?? 220))))
  const camShakeUiMix = Math.max(0, Math.min(3, r.camShakeUiMix))
  const portraitShakeLengthMs = Math.max(0, Math.min(12_000, Math.round(Number(r.portraitShakeLengthMs ?? camShakeLengthMs))))
  const portraitShakeDecayMs = Math.max(0, Math.min(3000, Math.round(Number(r.portraitShakeDecayMs ?? camShakeDecayMs))))
  const portraitShakeMagnitudeScale = Math.max(0, Math.min(6, Number(r.portraitShakeMagnitudeScale ?? 1)))
  let portraitIdleGapMinMs = Math.max(0, Math.min(120_000, Math.round(Number(r.portraitIdleGapMinMs ?? 8000))))
  let portraitIdleGapMaxMs = Math.max(0, Math.min(120_000, Math.round(Number(r.portraitIdleGapMaxMs ?? 18_000))))
  if (portraitIdleGapMaxMs < portraitIdleGapMinMs) portraitIdleGapMaxMs = portraitIdleGapMinMs
  let portraitIdleFlashMinMs = Math.max(0, Math.min(5000, Math.round(Number(r.portraitIdleFlashMinMs ?? 120))))
  let portraitIdleFlashMaxMs = Math.max(0, Math.min(5000, Math.round(Number(r.portraitIdleFlashMaxMs ?? 350))))
  if (portraitIdleFlashMaxMs < portraitIdleFlashMinMs) portraitIdleFlashMaxMs = portraitIdleFlashMinMs
  return {
    ...r,
    ditherMatrixSize,
    ditherPalette: p as RenderTuning['ditherPalette'],
    lanternBeamPenumbra,
    lanternBeamAngleDeg,
    lanternBeamDistanceScale,
    lanternBeamIntensityScale,
    lanternForwardOffset,
    lanternVerticalOffset,
    lanternFlickerAmp,
    lanternFlickerHz,
    baseEmissive,
    camShakePosAmp,
    camShakeRollDeg,
    camShakeHz,
    camShakeLengthMs,
    camShakeDecayMs,
    camShakeUiMix,
    portraitShakeLengthMs,
    portraitShakeDecayMs,
    portraitShakeMagnitudeScale,
    portraitIdleGapMinMs,
    portraitIdleGapMaxMs,
    portraitIdleFlashMinMs,
    portraitIdleFlashMaxMs,
  }
}

function applyCamEyeHeight(state: GameState, y: number): GameState {
  const v = state.view
  if (v.anim) {
    return {
      ...state,
      view: {
        ...v,
        camPos: { ...v.camPos, y },
        anim: {
          ...v.anim,
          fromPos: { ...v.anim.fromPos, y },
          toPos: { ...v.anim.toPos, y },
        },
      },
    }
  }
  return { ...state, view: { ...v, camPos: { ...v.camPos, y } } }
}

function hashStr(s: string) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function viewSnapToGrid(state: GameState, playerPos: { x: number; y: number }, playerDir: 0 | 1 | 2 | 3): GameState['view'] {
  const { w, h } = state.floor
  return {
    camPos: {
      x: playerPos.x - w / 2,
      y: state.render.camEyeHeight,
      z: playerPos.y - h / 2,
    },
    camYaw: (playerDir * Math.PI) / 2,
    anim: undefined,
  }
}

function dirVec(dir: 0 | 1 | 2 | 3) {
  // 0=N, 1=E, 2=S, 3=W (grid y+ is south)
  if (dir === 0) return { x: 0, y: -1 }
  if (dir === 1) return { x: 1, y: 0 }
  if (dir === 2) return { x: 0, y: 1 }
  return { x: -1, y: 0 }
}

/** One cell left (-1) or right (+1) relative to current facing (no rotation). */
function strafeVec(playerDir: 0 | 1 | 2 | 3, side: -1 | 1) {
  const d = ((((playerDir + (side === -1 ? 3 : 1)) % 4) + 4) % 4) as 0 | 1 | 2 | 3
  return dirVec(d)
}

function attemptMoveTo(state: GameState, nx: number, ny: number): GameState {
  if (state.view.anim) return state
  const { w, tiles } = state.floor
  const idx = nx + ny * w
  if (idx < 0 || idx >= tiles.length) return bump(state)
  const tile = tiles[idx]
  if (tile === 'door' || tile === 'lockedDoor') {
    return tryOpenDoor(state, idx, tile)
  }
  if (tile !== 'floor') return bump(state)

  const poi = state.floor.pois.find((p) => p.pos.x === nx && p.pos.y === ny)
  if (poi) return reduce(state, { type: 'poi/use', poiId: poi.id })

  const npc = state.floor.npcs.find((n) => n.pos.x === nx && n.pos.y === ny)
  if (npc) {
    if (npc.status === 'hostile') {
      const withToast = reduce(state, { type: 'ui/toast', text: `${npc.name} blocks your way!`, ms: 900 })
      return reduce(withToast, { type: 'ui/sfx', kind: 'reject' })
    }
    return reduce(state, { type: 'ui/openNpcDialog', npcId: npc.id })
  }

  const startedAtMs = state.nowMs
  const endsAtMs = startedAtMs + 140
  const toPos = { x: nx - state.floor.w / 2, y: state.render.camEyeHeight, z: ny - state.floor.h / 2 }

  return reduce(
    {
      ...state,
      floor: { ...state.floor, playerPos: { x: nx, y: ny } },
      view: {
        ...state.view,
        anim: {
          kind: 'move',
          fromPos: state.view.camPos,
          toPos,
          fromYaw: state.view.camYaw,
          toYaw: state.view.camYaw,
          startedAtMs,
          endsAtMs,
        },
      },
    },
    { type: 'ui/sfx', kind: 'step' },
  )
}

function bump(state: GameState): GameState {
  const withToast = { ...state, ui: { ...state.ui, toast: { id: `t_${state.nowMs}`, text: 'Solid stone.', untilMs: state.nowMs + 700 } } }
  const withSfx = reduce(withToast, { type: 'ui/sfx', kind: 'bump' })
  return reduce(withSfx, { type: 'ui/shake', magnitude: 0.25, ms: 90 })
}

function tickViewAnimation(state: GameState): GameState {
  const a = state.view.anim
  if (!a) return state
  if (state.nowMs >= a.endsAtMs) {
    return { ...state, view: { ...state.view, camPos: a.toPos, camYaw: a.toYaw, anim: undefined } }
  }
  const t = (state.nowMs - a.startedAtMs) / Math.max(1, a.endsAtMs - a.startedAtMs)
  const sm = t * t * (3 - 2 * t)
  const lerp = (x: number, y: number) => x + (y - x) * sm
  const camPos = { x: lerp(a.fromPos.x, a.toPos.x), y: lerp(a.fromPos.y, a.toPos.y), z: lerp(a.fromPos.z, a.toPos.z) }
  const camYaw = lerp(a.fromYaw, a.toYaw)
  return { ...state, view: { ...state.view, camPos, camYaw } }
}

function tryOpenDoor(state: GameState, idx: number, tile: 'door' | 'lockedDoor'): GameState {
  if (tile === 'door') {
    const tiles = state.floor.tiles.slice()
    tiles[idx] = 'floor'
    const next = { ...state, floor: { ...state.floor, tiles } }
    return reduce(next, { type: 'ui/toast', text: 'The door creaks open.', ms: 900 })
  }

  const hasKey = Object.values(state.party.items).some((it) => it.defId === 'IronKey' && it.qty > 0)
  if (!hasKey) {
    const withToast = reduce(state, { type: 'ui/toast', text: 'Locked. Need an iron key.', ms: 1100 })
    return reduce(withToast, { type: 'ui/sfx', kind: 'reject' })
  }

  // Consume one key stack (prefer first found).
  const keyId = Object.values(state.party.items).find((it) => it.defId === 'IronKey' && it.qty > 0)?.id
  const consumed = keyId ? consumeItem(state, keyId) : state
  const tiles = consumed.floor.tiles.slice()
  tiles[idx] = 'floor'
  const opened = { ...consumed, floor: { ...consumed.floor, tiles } }
  const withToast = reduce(opened, { type: 'ui/toast', text: 'Unlocked the door.', ms: 1100 })
  return reduce(withToast, { type: 'ui/sfx', kind: 'ui' })
}

