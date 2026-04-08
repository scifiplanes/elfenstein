import { ContentDB } from './content/contentDb'
import type {
  DragPayload,
  DragTarget,
  EquipmentSlot,
  GameState,
  ItemId,
  NpcKind,
  PoiKind,
  ProcgenDebugOverlayMode,
  RenderTuning,
} from './types'
import { makeInitialState } from './state/initialState'
import { applyStatusDecay } from './state/status'
import { consumeItem, dropItemToFloor, moveItemToInventorySlot, swapInventorySlots } from './state/inventory'
import { feedCharacter, inspectCharacter } from './state/interactions'
import { applyItemOnPoi, applyPoiUse } from './state/poi'
import { equipItem, unequipItem } from './state/equipment'
import { generateDungeon } from '../procgen/generateDungeon'
import type { FloorProperty, FloorType } from '../procgen/types'
import { normalizeFloorGenDifficulty } from '../procgen/types'
import { makeDropJitter } from './state/dropJitter'
import { hydrateGenFloorItems, snapViewToGrid } from './state/procgenHydrate'
import { pickupFloorItem } from './state/floorItems'
import { findRecipe } from './content/recipes'
import { maybeFinishCrafting, startCrafting } from './state/crafting'
import { pushActivityLog } from './state/activityLog'
import { descendToNextFloor } from './state/floorProgression'
import { applyXp } from './state/runProgression'

const CONTENT = ContentDB.createDefault()

const TAU = Math.PI * 2

function wrapTau(a: number) {
  // Normalize into [0, 2π) for stable camera application/debugging.
  const r = a % TAU
  return r < 0 ? r + TAU : r
}

function canonicalYawForDir(dir: 0 | 1 | 2 | 3) {
  return wrapTau((dir * Math.PI) / 2)
}

function nearestEquivalentAngle(from: number, to: number) {
  // Pick to + k*2π (k any integer) closest to `from`, so turn anim always takes the short way
  // even if `from` has drifted outside [0, 2π) due to earlier interpolation.
  const k = Math.round((from - to) / TAU)
  return to + k * TAU
}

export type Action =
  | { type: 'ui/toggleDebug' }
  | { type: 'ui/goTitle' }
  | { type: 'ui/openPaperdoll'; characterId: string }
  /** Opens paperdoll and schedules idle overlay pulse (HUD capture path; avoids lost clicks). */
  | { type: 'ui/portraitFrameTap'; characterId: string }
  | { type: 'ui/closePaperdoll' }
  | { type: 'ui/openNpcDialog'; npcId: string }
  | { type: 'ui/closeNpcDialog' }
  | { type: 'ui/toast'; text: string; ms?: number }
  | { type: 'ui/shake'; magnitude: number; ms?: number }
  | { type: 'ui/sfx'; kind: 'ui' | 'hit' | 'reject' | 'pickup' | 'munch' | 'step' | 'bump' | 'nav' | 'bones' }
  | { type: 'audio/set'; key: keyof GameState['audio']; value: number }
  | { type: 'time/tick'; nowMs: number }
  | { type: 'player/turn'; dir: -1 | 1 }
  | { type: 'player/step'; forward: 1 | -1 }
  | { type: 'player/strafe'; side: -1 | 1 }
  | { type: 'poi/use'; poiId: string }
  | { type: 'floor/pickup'; itemId: ItemId }
  | { type: 'drag/drop'; payload: DragPayload; target: DragTarget; nowMs?: number }
  | { type: 'equip/unequip'; characterId: string; slot: EquipmentSlot }
  | { type: 'floor/regen'; seed?: number }
  | { type: 'floor/descend' }
  /** Debug: spawn an NPC of the given kind one cell in front of the player. */
  | { type: 'debug/spawnNpc'; kind: NpcKind }
  /** Debug: spawn a POI of the given kind one cell in front of the player. */
  | { type: 'debug/spawnPoi'; kind: PoiKind }
  /** Debug: cycle `floor.floorType` (Dungeon → Cave → Ruins). Regen separately to apply. */
  | { type: 'floor/debugCycleRealizer' }
  /** Debug: cycle `floor.difficulty` (0 → 1 → 2). Regen separately to apply. */
  | { type: 'floor/debugCycleDifficulty' }
  /** Debug: set floor index (0-based). Regen/descend separately to materialize. */
  | { type: 'floor/debugSetFloorIndex'; floorIndex: number }
  /** Debug: toggle a procgen floor property. Regen/descend separately to materialize. */
  | { type: 'floor/debugToggleFloorProperty'; property: FloorProperty }
  | { type: 'ui/setProcgenDebugOverlay'; mode: ProcgenDebugOverlayMode | undefined }
  | { type: 'render/set'; key: keyof GameState['render']; value: number }
  | { type: 'debug/loadTuning'; render?: Partial<RenderTuning>; audio?: Partial<GameState['audio']> }
  | { type: 'floor/toggleChest'; poiId: string }
  | { type: 'npc/attack'; npcId: string; itemId: ItemId }
  | { type: 'npc/give'; npcId: string; itemId: ItemId }
  | { type: 'npc/pet'; npcId: string }
  | { type: 'run/new' }
  | { type: 'run/reloadCheckpoint' }

export function initialState(content: ContentDB): GameState {
  return makeInitialState(content)
}

export function reduce(state: GameState, action: Action): GameState {
  // Title blocks gameplay until the player starts/continues a run.
  if (state.ui.screen === 'title' && !state.ui.death) {
    switch (action.type) {
      case 'run/new':
      case 'run/reloadCheckpoint':
      case 'ui/goTitle':
      case 'time/tick':
      case 'ui/toggleDebug':
      case 'ui/setProcgenDebugOverlay':
      case 'render/set':
      case 'debug/loadTuning':
      case 'audio/set':
        break
      default:
        return state
    }
  }

  // When dead, ignore gameplay actions until a new run starts.
  if (state.ui.death) {
    switch (action.type) {
      case 'run/new':
      case 'run/reloadCheckpoint':
      case 'ui/goTitle':
      case 'time/tick':
      case 'ui/toggleDebug':
      case 'ui/setProcgenDebugOverlay':
      case 'render/set':
      case 'debug/loadTuning':
      case 'audio/set':
        break
      default:
        return state
    }
  }

  switch (action.type) {
    case 'ui/goTitle': {
      return { ...state, ui: { ...state.ui, screen: 'title', paperdollFor: undefined, npcDialogFor: undefined } }
    }
    case 'run/new': {
      const fresh = makeInitialState(CONTENT)
      // Preserve tuning across runs; keep debug panel state too.
      const preserved: GameState = {
        ...fresh,
        render: state.render,
        audio: state.audio,
        ui: { ...fresh.ui, screen: 'game', debugOpen: state.ui.debugOpen },
      }
      return pushActivityLog(preserved, 'New run.')
    }
    case 'run/reloadCheckpoint': {
      const cp = state.run.checkpoint
      if (!cp) return reduce(pushActivityLog(state, 'No checkpoint.'), { type: 'ui/sfx', kind: 'reject' })
      const snap = cp.snapshot
      const next: GameState = {
        ...state,
        // Preserve tuning across restore (same as `run/new`).
        render: state.render,
        audio: state.audio,
        run: { ...(snap.run as any), checkpoint: cp },
        floor: snap.floor,
        party: snap.party,
        view: snap.view,
        ui: {
          ...state.ui,
          screen: snap.ui.screen,
          debugOpen: snap.ui.debugOpen,
          procgenDebugOverlay: snap.ui.procgenDebugOverlay,
          activityLog: snap.ui.activityLog ?? [],
          knownRecipes: snap.ui.knownRecipes,
          // Clear transient/blocking UI bits.
          death: undefined,
          paperdollFor: undefined,
          npcDialogFor: undefined,
          shake: undefined,
          doorOpenFx: undefined,
          portraitMouth: undefined,
          portraitShake: undefined,
          portraitIdlePulse: undefined,
          crafting: undefined,
          sfxQueue: [],
        },
      }
      return pushActivityLog(next, 'Reloaded checkpoint.')
    }
    case 'ui/toggleDebug':
      return { ...state, ui: { ...state.ui, debugOpen: !state.ui.debugOpen } }
    case 'ui/setProcgenDebugOverlay':
      return { ...state, ui: { ...state.ui, procgenDebugOverlay: action.mode } }
    case 'ui/openPaperdoll':
      // Paperdoll popup disabled (global).
      return state
    case 'ui/portraitFrameTap': {
      if (!state.party.chars.some((c) => c.id === action.characterId)) return state
      const min = state.render.portraitIdleFlashMinMs
      const max = state.render.portraitIdleFlashMaxMs
      const span = Math.max(0, max - min)
      const ms = Math.round(min + Math.random() * span)
      const nowMs = performance.now()
      return {
        ...state,
        ui: {
          ...state.ui,
          portraitIdlePulse: { characterId: action.characterId, untilMs: nowMs + ms },
        },
      }
    }
    case 'ui/closePaperdoll':
      return { ...state, ui: { ...state.ui, paperdollFor: undefined } }
    case 'ui/openNpcDialog': {
      const npc = state.floor.npcs.find((n) => n.id === action.npcId)
      const q = state.ui.sfxQueue ?? []
      const sfxQueue =
        npc?.kind === 'Skeleton'
          ? q.concat([{ id: `s_${state.nowMs}_bones`, kind: 'bones' as const }])
          : q
      return {
        ...state,
        ui: {
          ...state.ui,
          npcDialogFor: action.npcId,
          shake: { startedAtMs: state.nowMs, untilMs: state.nowMs + 110, magnitude: 0.16 },
          sfxQueue,
        },
      }
    }
    case 'ui/closeNpcDialog':
      return { ...state, ui: { ...state.ui, npcDialogFor: undefined } }
    case 'ui/toast':
      return pushActivityLog(state, action.text)
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
      let withAnim = tickViewAnimation(withCrafting)

      // Invariant: when not turning, camera yaw must match the canonical facing.
      // This prevents rare desyncs where movement/minimap are correct but the 3D camera ends up reversed.
      const a = withAnim.view.anim
      if (!a || a.kind !== 'turn') {
        const want = canonicalYawForDir(withAnim.floor.playerDir)
        if (wrapTau(withAnim.view.camYaw) !== want) {
          withAnim = { ...withAnim, view: { ...withAnim.view, camYaw: want } }
        }
      }
      const shake = withCrafting.ui.shake && withCrafting.ui.shake.untilMs <= action.nowMs ? undefined : withCrafting.ui.shake
      const portraitMouth =
        withCrafting.ui.portraitMouth && withCrafting.ui.portraitMouth.untilMs <= action.nowMs ? undefined : withCrafting.ui.portraitMouth
      const portraitShake =
        withCrafting.ui.portraitShake && withCrafting.ui.portraitShake.untilMs <= action.nowMs ? undefined : withCrafting.ui.portraitShake
      const portraitIdlePulse =
        withCrafting.ui.portraitIdlePulse && withCrafting.ui.portraitIdlePulse.untilMs <= action.nowMs
          ? undefined
          : withCrafting.ui.portraitIdlePulse
      const sfxQueue = withCrafting.ui.sfxQueue ?? []
      const clearedQueue = sfxQueue.length ? [] : sfxQueue
      if (
        shake !== withAnim.ui.shake ||
        portraitMouth !== withAnim.ui.portraitMouth ||
        portraitShake !== withAnim.ui.portraitShake ||
        portraitIdlePulse !== withAnim.ui.portraitIdlePulse ||
        clearedQueue !== sfxQueue ||
        withAnim.view !== withCrafting.view
      ) {
        const updated = {
          ...withAnim,
          ui: { ...withAnim.ui, shake, portraitMouth, portraitShake, portraitIdlePulse, sfxQueue: clearedQueue },
        }
        const wiped = updated.party.chars.length > 0 && updated.party.chars.every((c) => c.hp <= 0)
        if (wiped && !updated.ui.death) {
          const dead = {
            ...updated,
            ui: { ...updated.ui, death: { atMs: updated.nowMs, runId: updated.run.runId, floorIndex: updated.floor.floorIndex, level: updated.run.level } },
          }
          return pushActivityLog(dead, 'The party has fallen.')
        }
        return updated
      }
      const wiped = withAnim.party.chars.length > 0 && withAnim.party.chars.every((c) => c.hp <= 0)
      if (wiped && !withAnim.ui.death) {
        const dead = {
          ...withAnim,
          ui: { ...withAnim.ui, death: { atMs: withAnim.nowMs, runId: withAnim.run.runId, floorIndex: withAnim.floor.floorIndex, level: withAnim.run.level } },
        }
        return pushActivityLog(dead, 'The party has fallen.')
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
      return { ...state, floor: { ...state.floor, pois: nextPois, floorGeomRevision: state.floor.floorGeomRevision + 1 } }
    }
    case 'debug/spawnNpc': {
      const dv = dirVec(state.floor.playerDir)
      const pos = { x: state.floor.playerPos.x + dv.x, y: state.floor.playerPos.y + dv.y }
      const npc = {
        id: `debug_npc_${state.nowMs}`,
        kind: action.kind,
        name: action.kind,
        pos,
        status: 'neutral' as const,
        hp: 10,
        language: 'DeepGnome' as const,
      }
      return { ...state, floor: { ...state.floor, npcs: [...state.floor.npcs, npc], floorGeomRevision: state.floor.floorGeomRevision + 1 } }
    }
    case 'debug/spawnPoi': {
      const dv = dirVec(state.floor.playerDir)
      const pos = { x: state.floor.playerPos.x + dv.x, y: state.floor.playerPos.y + dv.y }
      const poi = { id: `debug_poi_${state.nowMs}`, kind: action.kind, pos }
      return { ...state, floor: { ...state.floor, pois: [...state.floor.pois, poi], floorGeomRevision: state.floor.floorGeomRevision + 1 } }
    }
    case 'floor/debugCycleRealizer': {
      const order: FloorType[] = ['Dungeon', 'Cave', 'Ruins']
      const i = Math.max(0, order.indexOf(state.floor.floorType))
      const next = order[(i + 1) % order.length]
      return pushActivityLog(
        { ...state, floor: { ...state.floor, floorType: next } },
        `Next regen uses floor type: ${next}.`,
      )
    }
    case 'floor/debugCycleDifficulty': {
      const cur = normalizeFloorGenDifficulty(state.floor.difficulty)
      const next = ((cur + 1) % 3) as 0 | 1 | 2
      const label = next === 0 ? 'easy' : next === 1 ? 'normal' : 'hard'
      return pushActivityLog(
        { ...state, floor: { ...state.floor, difficulty: next } },
        `Next regen uses difficulty: ${label} (${next}).`,
      )
    }
    case 'floor/debugSetFloorIndex': {
      const raw = Number(action.floorIndex)
      const nextFloorIndex = Math.max(0, Math.min(9999, Math.floor(Number.isFinite(raw) ? raw : state.floor.floorIndex)))
      if (nextFloorIndex === state.floor.floorIndex) return state
      return pushActivityLog({ ...state, floor: { ...state.floor, floorIndex: nextFloorIndex } }, `Next regen uses floor index: ${nextFloorIndex}.`)
    }
    case 'floor/debugToggleFloorProperty': {
      const order: FloorProperty[] = ['Infested', 'Cursed', 'Destroyed', 'Overgrown']
      const cur = state.floor.floorProperties
      const has = cur.includes(action.property)
      const next = (has ? cur.filter((p) => p !== action.property) : cur.concat([action.property]))
        .filter((p, i, a) => a.indexOf(p) === i)
        .sort((a, b) => order.indexOf(a) - order.indexOf(b))
      const label = next.length ? next.join(', ') : '—'
      return pushActivityLog({ ...state, floor: { ...state.floor, floorProperties: next } }, `Next regen uses floor props: ${label}.`)
    }
    case 'floor/regen': {
      const nextSeed = (action.seed ?? (Math.floor(state.nowMs) >>> 0)) >>> 0
      const w = state.floor.w
      const h = state.floor.h
      const gen = generateDungeon({
        seed: nextSeed,
        w,
        h,
        floorIndex: state.floor.floorIndex,
        floorType: state.floor.floorType,
        floorProperties: state.floor.floorProperties,
        difficulty: normalizeFloorGenDifficulty(state.floor.difficulty),
      })
      const playerPos = { ...gen.entrance }
      const playerDir = 0 as const
      const { spawnedItems, spawnedOnFloor } = hydrateGenFloorItems(state.render, gen.floorItems, nextSeed)
      const next: GameState = {
        ...state,
        floor: {
          ...state.floor,
          seed: nextSeed,
          tiles: gen.tiles,
          pois: gen.pois,
          gen,
          itemsOnFloor: spawnedOnFloor,
          floorGeomRevision: state.floor.floorGeomRevision + 1,
          npcs: gen.npcs,
          playerPos,
          playerDir,
        },
        party: { ...state.party, items: { ...state.party.items, ...spawnedItems } },
        view: snapViewToGrid(w, h, state.render.camEyeHeight, playerPos, playerDir),
      }
      return pushActivityLog(next, `Regenerated (seed ${nextSeed}).`)
    }
    case 'floor/descend': {
      return descendToNextFloor(state)
    }
    case 'player/turn': {
      if (state.view.anim) return state
      const dir = (((state.floor.playerDir + action.dir) % 4) + 4) % 4
      const fromYaw = state.view.camYaw
      const baseToYaw = (dir * Math.PI) / 2
      const toYaw = nearestEquivalentAngle(fromYaw, baseToYaw)
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
      return applyPoiUse(state, CONTENT, action.poiId)
    }
    case 'floor/pickup':
      return pickupFloorItem(state, action.itemId)
    case 'drag/drop': {
      const stateAtAction = action.nowMs != null ? { ...state, nowMs: action.nowMs } : state
      const { payload, target } = action
      const itemId: ItemId = payload.itemId

      if (target.kind === 'inventorySlot') {
        const dst = target.slotIndex
        if (payload.source.kind === 'inventorySlot') {
          const src = payload.source.slotIndex
          const srcItemId = stateAtAction.party.inventory.slots[src]
          const dstItemId = stateAtAction.party.inventory.slots[dst]
          const srcItem = srcItemId ? stateAtAction.party.items[srcItemId] : null
          const dstItem = dstItemId ? stateAtAction.party.items[dstItemId] : null
          if (srcItem && dstItem) {
            const recipe = findRecipe(srcItem.defId, dstItem.defId)
            if (recipe) {
              const withStart = startCrafting(stateAtAction, srcItem.id, dstItem.id, recipe, { dstSlotIndex: dst })
              return reduce(reduce(withStart, { type: 'ui/sfx', kind: 'ui' }), { type: 'ui/shake', magnitude: 0.2, ms: 90 })
            }
          }
          return swapInventorySlots(stateAtAction, src, dst)
        }
        return moveItemToInventorySlot(stateAtAction, itemId, dst)
      }

      if (target.kind === 'floorDrop') {
        const item = stateAtAction.party.items[itemId]
        if (item?.defId === 'Hive') {
          const seed = hashStr(`${stateAtAction.floor.seed}:hive:${itemId}:${stateAtAction.nowMs >> 9}`)
          const queenRoll = (seed % 100) + 1
          const breakRoll = ((seed >>> 10) % 100) + 1
          const breaks = breakRoll <= 75

          const pos = target.dropPos ?? stateAtAction.floor.playerPos
          const hasFreeInv = stateAtAction.party.inventory.slots.some((s) => s == null)

          // 8%: produce a Swarm Queen instead of spawning a Swarm.
          if (queenRoll <= 8) {
            let next = breaks ? consumeItem(stateAtAction, itemId) : dropItemToFloor(stateAtAction, itemId, pos)
            next = mintItemToInventoryOrFloor(next, 'SwarmQueen', `hiveQueen_${itemId}_${stateAtAction.nowMs}`, pos)
            return reduce(
              pushActivityLog(next, hasFreeInv ? 'A Swarm Queen wriggles free.' : 'A Swarm Queen wriggles free and drops to the floor.'),
              { type: 'ui/sfx', kind: 'pickup' },
            )
          }

          // Otherwise: spawn a Swarm NPC at the drop cell.
          const swarmId = `npc_swarm_${stateAtAction.floor.seed}_${(seed >>> 0).toString(16)}`
          const status: 'hostile' | 'neutral' = partyHasItemDef(stateAtAction, 'SwarmQueen') ? 'neutral' : 'hostile'
          const swarm = { id: swarmId, kind: 'Swarm' as const, name: 'Swarm', pos, status, hp: 9, language: 'Zalgo' as const }

          let next = breaks ? consumeItem(stateAtAction, itemId) : dropItemToFloor(stateAtAction, itemId, pos)
          next = {
            ...next,
            floor: { ...next.floor, npcs: next.floor.npcs.concat([swarm]), floorGeomRevision: next.floor.floorGeomRevision + 1 },
          }
          next = pushActivityLog(next, status === 'neutral' ? 'A swarm spills out, but it calms at your presence.' : 'A swarm spills out!')
          next = reduce(next, { type: 'ui/sfx', kind: 'reject' })
          return reduce(next, { type: 'ui/shake', magnitude: 0.35, ms: 160 })
        }

        return dropItemToFloor(stateAtAction, itemId, target.dropPos)
      }

      if (target.kind === 'floorItem') {
        // When dragging onto a floor item, interpret as pickup.
        return pickupFloorItem(stateAtAction, target.itemId)
      }

      if (target.kind === 'portrait') {
        if (target.target === 'eyes') return inspectCharacter(stateAtAction, CONTENT, target.characterId, itemId)
        return feedCharacter(stateAtAction, CONTENT, target.characterId, itemId)
      }

      if (target.kind === 'poi') {
        return applyItemOnPoi(stateAtAction, CONTENT, itemId, target.poiId)
      }

      if (target.kind === 'equipmentSlot') {
        return equipItem(stateAtAction, target.characterId, target.slot, itemId)
      }

      if (target.kind === 'npc') {
        const item = stateAtAction.party.items[itemId]
        const npcIdx = stateAtAction.floor.npcs.findIndex((n) => n.id === target.npcId)
        if (!item || npcIdx < 0) return stateAtAction
        const npc = stateAtAction.floor.npcs[npcIdx]!

        // Special-case: Swarm Basket captures a Swarm.
        if (item.defId === 'SwarmBasket' && npc.kind === 'Swarm') {
          let next = consumeItem(stateAtAction, itemId)
          next = {
            ...next,
            floor: { ...next.floor, npcs: next.floor.npcs.filter((n) => n.id !== npc.id), floorGeomRevision: next.floor.floorGeomRevision + 1 },
          }
          next = mintItemToInventoryOrFloor(next, 'CapturedSwarm', `captured_${npc.id}`, npc.pos)
          next = pushActivityLog(next, 'Captured the swarm.')
          next = reduce(next, { type: 'ui/sfx', kind: 'pickup' })
          return reduce(next, { type: 'ui/shake', magnitude: 0.25, ms: 140 })
        }

        // If the party holds a Swarm Queen, treat Swarms as non-hostile to interaction attempts.
        if (npc.kind === 'Swarm' && partyHasItemDef(stateAtAction, 'SwarmQueen')) {
          if (npc.status !== 'neutral' && npc.status !== 'friendly') {
            const npcs = stateAtAction.floor.npcs.slice()
            npcs[npcIdx] = { ...npc, status: 'neutral' }
            return pushActivityLog(
              { ...stateAtAction, floor: { ...stateAtAction.floor, npcs, floorGeomRevision: stateAtAction.floor.floorGeomRevision + 1 } },
              'The swarm calms at your presence.',
            )
          }
        }

        // Special-case: Captured Swarm released onto an enemy for heavy damage.
        if (item.defId === 'CapturedSwarm' && npc.kind !== 'Swarm') {
          const seed = hashStr(`${stateAtAction.floor.seed}:releaseSwarm:${npc.id}:${itemId}`)
          const dmg = 18 + ((seed >>> 8) % 8) // 18..25
          const hp = Math.max(0, npc.hp - dmg)
          const npcs = stateAtAction.floor.npcs.slice()
          npcs[npcIdx] = { ...npc, hp }
          const died = hp === 0
          let next: GameState = {
            ...stateAtAction,
            floor: {
              ...stateAtAction.floor,
              npcs: died ? npcs.filter((n) => n.id !== npc.id) : npcs,
              floorGeomRevision: stateAtAction.floor.floorGeomRevision + 1,
            },
          }
          next = consumeItem(next, itemId)
          next = pushActivityLog(next, died ? `${npc.name} is torn apart.` : `${npc.name} takes ${dmg} dmg.`)
          next = reduce(next, { type: 'ui/sfx', kind: 'hit' })
          return reduce(next, { type: 'ui/shake', magnitude: died ? 0.75 : 0.5, ms: died ? 240 : 160 })
        }

        const isWeapon = CONTENT.item(item.defId).tags.includes('weapon')
        return isWeapon
          ? reduce(stateAtAction, { type: 'npc/attack', npcId: target.npcId, itemId })
          : reduce(stateAtAction, { type: 'npc/give', npcId: target.npcId, itemId })
      }

      return stateAtAction
    }
    case 'npc/attack': {
      const npcIdx = state.floor.npcs.findIndex((n) => n.id === action.npcId)
      const item = state.party.items[action.itemId]
      if (npcIdx < 0 || !item) return state
      const isWeapon = CONTENT.item(item.defId).tags.includes('weapon')
      if (!isWeapon) {
        return reduce(pushActivityLog(state, 'That does not work as a weapon.'), { type: 'ui/sfx', kind: 'reject' })
      }
      const npcs = state.floor.npcs.slice()
      const npc = npcs[npcIdx]

      // Swarms are neutral while the party holds a Swarm Queen.
      if (npc.kind === 'Swarm' && partyHasItemDef(state, 'SwarmQueen')) {
        return reduce(pushActivityLog(state, 'The swarm refuses to attack you.'), { type: 'ui/sfx', kind: 'reject' })
      }

      const dmg =
        item.defId === 'Firebolt' ? 10
        : item.defId === 'Spear' ? 8
        : item.defId === 'Club' ? 7
        : item.defId === 'Bow' ? 6
        : item.defId === 'Sling' ? 5
        : item.defId === 'Bolas' ? 5
        : item.defId === 'Stone' ? 5
        : 4
      const dmgBonus = Math.max(0, Number(state.run?.bonuses.damageBonusPct ?? 0))
      const finalDmg = Math.max(1, Math.round(dmg * (1 + dmgBonus)))
      const hp = Math.max(0, npc.hp - finalDmg)
      npcs[npcIdx] = { ...npc, hp }
      const died = hp === 0
      let nextState: GameState = { ...state, floor: { ...state.floor, npcs: died ? npcs.filter((n) => n.id !== npc.id) : npcs } }
      if (nextState !== state) {
        nextState = { ...nextState, floor: { ...nextState.floor, floorGeomRevision: nextState.floor.floorGeomRevision + 1 } }
      }

      // Spell-like items are consumed on use.
      if (item.defId === 'Firebolt') nextState = consumeItem(nextState, action.itemId)

      // On death, sometimes drop loot to the floor.
      if (died) {
        const lootDef = pickNpcLootDefId(nextState, npc.id)
        if (lootDef) {
          const lootId = `i_${lootDef}_${nextState.floor.seed}_${npc.id}`
          const jitter = makeDropJitter({
            floorSeed: nextState.floor.seed,
            itemId: lootId,
            nonce: Math.floor(nextState.nowMs),
            radius: nextState.render.dropJitterRadius ?? 0.28,
          })
          nextState = {
            ...nextState,
            party: { ...nextState.party, items: { ...nextState.party.items, [lootId]: { id: lootId, defId: lootDef, qty: 1 } } },
            floor: {
              ...nextState.floor,
              itemsOnFloor: nextState.floor.itemsOnFloor.concat([{ id: lootId, pos: { ...npc.pos }, jitter }]),
              floorGeomRevision: nextState.floor.floorGeomRevision + 1,
            },
          }
        }
      }
      const withMsg = pushActivityLog(nextState, died ? `${npc.name} dies.` : `${npc.name} takes ${finalDmg} dmg.`)
      const withHit = reduce(withMsg, { type: 'ui/sfx', kind: 'hit' })
      return reduce(withHit, { type: 'ui/shake', magnitude: died ? 0.7 : 0.4, ms: died ? 220 : 140 })
    }
    case 'npc/give': {
      const npcIdx = state.floor.npcs.findIndex((n) => n.id === action.npcId)
      const item = state.party.items[action.itemId]
      if (npcIdx < 0 || !item) return state
      const npc = state.floor.npcs[npcIdx]
      const quest = npc.quest
      if (!quest) {
        return reduce(pushActivityLog(state, `${npc.name} ignores it.`), { type: 'ui/sfx', kind: 'reject' })
      }
      if (quest.hated.includes(item.defId)) {
        const npcs = state.floor.npcs.slice()
        npcs[npcIdx] = { ...npc, status: 'hostile' }
        const withNpc = { ...state, floor: { ...state.floor, npcs, floorGeomRevision: state.floor.floorGeomRevision + 1 } }
        return reduce(pushActivityLog(withNpc, `${npc.name} becomes hostile!`), { type: 'ui/sfx', kind: 'reject' })
      }
      if (quest.wants === item.defId) {
        // Consume item and improve status.
        const npcs = state.floor.npcs.slice()
        const nextStatus = npc.status === 'hostile' ? 'neutral' : 'friendly'
        npcs[npcIdx] = { ...npc, status: nextStatus }
        const withNpc = { ...state, floor: { ...state.floor, npcs, floorGeomRevision: state.floor.floorGeomRevision + 1 } }
        const withConsume = consumeItem(withNpc, action.itemId)
        return reduce(pushActivityLog(withConsume, `${npc.name} accepts it.`), { type: 'ui/sfx', kind: 'pickup' })
      }
      return reduce(pushActivityLog(state, `${npc.name} rejects it.`), { type: 'ui/sfx', kind: 'reject' })
    }
    case 'npc/pet': {
      const npc = state.floor.npcs.find((n) => n.id === action.npcId)
      if (!npc) return state
      return pushActivityLog(state, `You pet ${npc.name}.`)
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

function partyHasItemDef(state: GameState, defId: string) {
  for (const slot of state.party.inventory.slots) {
    if (!slot) continue
    const item = state.party.items[slot]
    if (item?.defId === defId) return true
  }
  return false
}

function mintItemToInventoryOrFloor(state: GameState, defId: import('./types').ItemDefId, stableId: string, pos: { x: number; y: number }): GameState {
  const newId = (`i_${defId}_${state.floor.seed}_${stableId}` as unknown) as import('./types').ItemId
  const items = { ...state.party.items, [newId]: { id: newId, defId, qty: 1 } }
  const inv = state.party.inventory
  const free = inv.slots.findIndex((s) => s == null)
  if (free >= 0) {
    const nextSlots = inv.slots.slice()
    nextSlots[free] = newId
    return { ...state, party: { ...state.party, items, inventory: { ...inv, slots: nextSlots } } }
  }
  const jitter = makeDropJitter({
    floorSeed: state.floor.seed,
    itemId: newId,
    nonce: Math.floor(state.nowMs),
    radius: state.render.dropJitterRadius ?? 0.28,
  })
  return {
    ...state,
    party: { ...state.party, items },
    floor: {
      ...state.floor,
      itemsOnFloor: state.floor.itemsOnFloor.concat([{ id: newId, pos: { ...pos }, jitter }]),
      floorGeomRevision: state.floor.floorGeomRevision + 1,
    },
  }
}

function clampShadowMapSize(n: number): RenderTuning['shadowMapSize'] {
  const s = Math.round(Number(n))
  if (s <= 192) return 128
  if (s <= 384) return 256
  return 512
}

function clampRenderTuning(r: RenderTuning): RenderTuning {
  const globalIntensity = Math.max(0, Math.min(3, Number(r.globalIntensity ?? 1.0)))
  const clampHue = (v: number) => Math.max(-180, Math.min(180, Number(v)))
  const clampSat = (v: number) => Math.max(0, Math.min(3, Number(v)))
  const themeHueShiftDeg_dungeon_warm = clampHue(r.themeHueShiftDeg_dungeon_warm ?? 0)
  const themeHueShiftDeg_dungeon_cool = clampHue(r.themeHueShiftDeg_dungeon_cool ?? 0)
  const themeHueShiftDeg_cave_damp = clampHue(r.themeHueShiftDeg_cave_damp ?? 0)
  const themeHueShiftDeg_cave_deep = clampHue(r.themeHueShiftDeg_cave_deep ?? 0)
  const themeHueShiftDeg_ruins_bleach = clampHue(r.themeHueShiftDeg_ruins_bleach ?? 0)
  const themeHueShiftDeg_ruins_umber = clampHue(r.themeHueShiftDeg_ruins_umber ?? 0)
  const themeSaturation_dungeon_warm = clampSat(r.themeSaturation_dungeon_warm ?? 1.0)
  const themeSaturation_dungeon_cool = clampSat(r.themeSaturation_dungeon_cool ?? 1.0)
  const themeSaturation_cave_damp = clampSat(r.themeSaturation_cave_damp ?? 1.0)
  const themeSaturation_cave_deep = clampSat(r.themeSaturation_cave_deep ?? 1.0)
  const themeSaturation_ruins_bleach = clampSat(r.themeSaturation_ruins_bleach ?? 1.0)
  const themeSaturation_ruins_umber = clampSat(r.themeSaturation_ruins_umber ?? 1.0)
  const m = Math.round(r.ditherMatrixSize)
  const ditherMatrixSize: RenderTuning['ditherMatrixSize'] = m <= 3 ? 2 : m <= 6 ? 4 : 8
  const p = Math.max(0, Math.min(4, Math.round(r.ditherPalette)))
  const ditherPalette0Mix = Math.max(0, Math.min(1, Number(r.ditherPalette0Mix ?? 1)))
  const postDitherLevels = Math.max(0, Math.min(3, Number(r.postDitherLevels ?? 1.0)))
  const postDitherLift = Math.max(-1, Math.min(1, Number(r.postDitherLift ?? 0.0)))
  const postDitherGamma = Math.max(0.2, Math.min(3, Number(r.postDitherGamma ?? 1.0)))
  const fogEnabled = Number(r.fogEnabled ?? 0) > 0 ? 1 : 0
  const fogDensity = Math.max(0, Math.min(0.3, Number(r.fogDensity ?? 0)))
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
  const portraitShakeMagnitudeScale = Math.max(0, Math.min(10, Number(r.portraitShakeMagnitudeScale ?? 1)))
  const portraitShakeHz = Math.max(0, Math.min(60, Number(r.portraitShakeHz ?? camShakeHz)))
  let portraitIdleGapMinMs = Math.max(0, Math.min(120_000, Math.round(Number(r.portraitIdleGapMinMs ?? 8000))))
  let portraitIdleGapMaxMs = Math.max(0, Math.min(120_000, Math.round(Number(r.portraitIdleGapMaxMs ?? 18_000))))
  if (portraitIdleGapMaxMs < portraitIdleGapMinMs) portraitIdleGapMaxMs = portraitIdleGapMinMs
  let portraitIdleFlashMinMs = Math.max(0, Math.min(5000, Math.round(Number(r.portraitIdleFlashMinMs ?? 120))))
  let portraitIdleFlashMaxMs = Math.max(0, Math.min(5000, Math.round(Number(r.portraitIdleFlashMaxMs ?? 350))))
  if (portraitIdleFlashMaxMs < portraitIdleFlashMinMs) portraitIdleFlashMaxMs = portraitIdleFlashMinMs
  const portraitMouthFlickerHz = Math.max(0, Math.min(40, Number(r.portraitMouthFlickerHz ?? 18)))
  const portraitMouthFlickerAmount = Math.max(0, Math.min(64, Math.round(Number(r.portraitMouthFlickerAmount ?? 8))))
  const dropRangeCells = Math.max(0, Math.min(20, Math.round(Number(r.dropRangeCells ?? 5))))
  const shadowLanternPoint = Number(r.shadowLanternPoint ?? 0) > 0 ? 1 : 0
  const shadowMapSize = clampShadowMapSize(Number(r.shadowMapSize ?? 256))
  const shadowFilter = Math.max(0, Math.min(2, Math.round(Number(r.shadowFilter ?? 2)))) as RenderTuning['shadowFilter']
  const torchPoiLightMax = Math.max(0, Math.min(6, Math.round(Number(r.torchPoiLightMax ?? 3))))

  const clampNpcSize = (v: number) => Math.max(0.1, Math.min(2.5, Number(v)))
  const clampNpcRand = (v: number) => Math.max(0, Math.min(1, Number(v)))
  const npcFootLift = Math.max(-0.2, Math.min(0.5, Number(r.npcFootLift ?? 0.02)))
  const clampNpcGroundY = (v: number) => Math.max(-0.75, Math.min(1.25, Number(v)))
  const npcGroundY_Wurglepup = clampNpcGroundY(r.npcGroundY_Wurglepup ?? 0)
  const npcGroundY_Bobr = clampNpcGroundY(r.npcGroundY_Bobr ?? 0)
  const npcGroundY_Skeleton = clampNpcGroundY(r.npcGroundY_Skeleton ?? 0)
  const npcGroundY_Catoctopus = clampNpcGroundY(r.npcGroundY_Catoctopus ?? 0)
  const poiGroundY_Well = clampNpcGroundY(r.poiGroundY_Well ?? 0)
  const poiGroundY_Chest = clampNpcGroundY(r.poiGroundY_Chest ?? 0)
  const poiSpriteBoost = Math.max(0, Math.min(3, Number(r.poiSpriteBoost ?? 1.0)))

  const npcSize_Wurglepup = clampNpcSize(r.npcSize_Wurglepup ?? 0.65)
  const npcSizeRand_Wurglepup = clampNpcRand(r.npcSizeRand_Wurglepup ?? 0)
  const npcSize_Bobr = clampNpcSize(r.npcSize_Bobr ?? 0.65)
  const npcSizeRand_Bobr = clampNpcRand(r.npcSizeRand_Bobr ?? 0)
  const npcSize_Skeleton = clampNpcSize(r.npcSize_Skeleton ?? 0.65)
  const npcSizeRand_Skeleton = clampNpcRand(r.npcSizeRand_Skeleton ?? 0)
  const npcSize_Catoctopus = clampNpcSize(r.npcSize_Catoctopus ?? 0.65)
  const npcSizeRand_Catoctopus = clampNpcRand(r.npcSizeRand_Catoctopus ?? 0)
  return {
    ...r,
    globalIntensity,
    themeHueShiftDeg_dungeon_warm,
    themeHueShiftDeg_dungeon_cool,
    themeHueShiftDeg_cave_damp,
    themeHueShiftDeg_cave_deep,
    themeHueShiftDeg_ruins_bleach,
    themeHueShiftDeg_ruins_umber,
    themeSaturation_dungeon_warm,
    themeSaturation_dungeon_cool,
    themeSaturation_cave_damp,
    themeSaturation_cave_deep,
    themeSaturation_ruins_bleach,
    themeSaturation_ruins_umber,
    ditherMatrixSize,
    ditherPalette: p as RenderTuning['ditherPalette'],
    ditherPalette0Mix,
    postDitherLevels,
    postDitherLift,
    postDitherGamma,
    fogEnabled,
    fogDensity,
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
    portraitShakeHz,
    portraitIdleGapMinMs,
    portraitIdleGapMaxMs,
    portraitIdleFlashMinMs,
    portraitIdleFlashMaxMs,
    portraitMouthFlickerHz,
    portraitMouthFlickerAmount,
    dropRangeCells,
    shadowLanternPoint,
    shadowMapSize,
    shadowFilter,
    torchPoiLightMax,

    npcFootLift,
    npcGroundY_Wurglepup,
    npcGroundY_Bobr,
    npcGroundY_Skeleton,
    npcGroundY_Catoctopus,
    poiGroundY_Well,
    poiGroundY_Chest,
    poiSpriteBoost,
    npcSize_Wurglepup,
    npcSizeRand_Wurglepup,
    npcSize_Bobr,
    npcSizeRand_Bobr,
    npcSize_Skeleton,
    npcSizeRand_Skeleton,
    npcSize_Catoctopus,
    npcSizeRand_Catoctopus,
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

function rectContains(r: { x: number; y: number; w: number; h: number }, p: { x: number; y: number }) {
  return p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h
}

function roomForCell(state: GameState, x: number, y: number) {
  const rooms = state.floor.gen?.rooms
  if (!rooms?.length) return null
  for (const r of rooms) {
    if (rectContains(r.rect, { x, y })) return r
  }
  return null
}

function addStatusToChar(state: GameState, characterId: string, statusId: 'Poisoned' | 'Blessed' | 'Sick' | 'Bleeding' | 'Burning' | 'Drenched' | 'Drowsy' | 'Focused' | 'Cursed' | 'Frightened' | 'Rooted' | 'Shielded' | 'Starving' | 'Dehydrated', durMs?: number) {
  const idx = state.party.chars.findIndex((c) => c.id === characterId)
  if (idx < 0) return state
  const chars = state.party.chars.slice()
  const c = chars[idx]
  const already = c.statuses.some((s) => s.id === statusId && (s.untilMs == null || s.untilMs > state.nowMs))
  if (already) return state
  const defDur = CONTENT.status(statusId).defaultDurationMs
  const untilMs = state.nowMs + Math.max(250, durMs ?? defDur ?? 12_000)
  chars[idx] = { ...c, statuses: c.statuses.concat([{ id: statusId, untilMs }]) }
  return { ...state, party: { ...state.party, chars } }
}

function applyRoomHazardOnEnter(state: GameState, x: number, y: number): GameState {
  const room = roomForCell(state, x, y)
  const prop = room?.tags?.roomProperties
  if (!prop) return state

  const seed = hashStr(`${state.floor.seed}:hazard:${prop}:${x},${y}`)
  const q = state.ui.sfxQueue ?? []

  if (prop === 'Burning') {
    let next = state
    for (const c of state.party.chars) next = addStatusToChar(next, c.id, 'Burning', 12_000)
    const chars = next.party.chars.map((c) => ({ ...c, hp: Math.max(0, c.hp - 2) }))
    next = { ...next, party: { ...next.party, chars } }
    next = pushActivityLog(next, 'The air scorches your lungs.')
    next = { ...next, ui: { ...next.ui, sfxQueue: q.concat([{ id: `s_${state.nowMs}_${q.length}`, kind: 'hit' }]) } }
    return reduce(next, { type: 'ui/shake', magnitude: 0.3, ms: 120 })
  }

  if (prop === 'Flooded') {
    let next = state
    for (const c of state.party.chars) next = addStatusToChar(next, c.id, 'Drenched', 12_000)
    next = pushActivityLog(next, 'Cold water soaks your feet.')
    next = { ...next, ui: { ...next.ui, sfxQueue: q.concat([{ id: `s_${state.nowMs}_${q.length}`, kind: 'ui' }]) } }
    return reduce(next, { type: 'ui/shake', magnitude: 0.18, ms: 90 })
  }

  if (prop === 'Infected') {
    const roll = (seed % 100) + 1
    if (roll > 55) return state
    const status = ((seed >>> 8) & 1) === 0 ? ('Sick' as const) : ('Poisoned' as const)
    let next = state
    const first = state.party.chars[0]
    if (first) next = addStatusToChar(next, first.id, status, status === 'Poisoned' ? 30_000 : 24_000)
    next = pushActivityLog(next, 'A foul miasma clings to you.')
    next = { ...next, ui: { ...next.ui, sfxQueue: q.concat([{ id: `s_${state.nowMs}_${q.length}`, kind: 'reject' }]) } }
    return reduce(next, { type: 'ui/shake', magnitude: 0.22, ms: 110 })
  }

  return state
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

  const moved: GameState = {
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
  }
  const withHazard = applyRoomHazardOnEnter(moved, nx, ny)
  return reduce(withHazard, { type: 'ui/sfx', kind: 'step' })
}

function bump(state: GameState): GameState {
  const withMsg = pushActivityLog(state, 'Solid stone.')
  const withSfx = reduce(withMsg, { type: 'ui/sfx', kind: 'bump' })
  return reduce(withSfx, { type: 'ui/shake', magnitude: 0.25, ms: 90 })
}

function tickViewAnimation(state: GameState): GameState {
  const a = state.view.anim
  if (!a) return state
  if (state.nowMs >= a.endsAtMs) {
    const camYaw =
      a.kind === 'turn' ? canonicalYawForDir(state.floor.playerDir) : a.toYaw
    return { ...state, view: { ...state.view, camPos: a.toPos, camYaw, anim: undefined } }
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
    const w = state.floor.w
    const doorX = idx % w
    const doorY = (idx / w) | 0
    const keep = (state.ui.doorOpenFx ?? []).filter((x) => x.untilMs > state.nowMs)
    const doorOpenFx = keep.concat([
      { id: `doorFx_${state.nowMs}_${doorX},${doorY}`, pos: { x: doorX, y: doorY }, startedAtMs: state.nowMs, untilMs: state.nowMs + 420 },
    ])
    const next = {
      ...state,
      floor: { ...state.floor, tiles, floorGeomRevision: state.floor.floorGeomRevision + 1 },
      ui: { ...state.ui, doorOpenFx },
    }
    return reduce(next, { type: 'ui/toast', text: 'The door creaks open.', ms: 900 })
  }

  const w = state.floor.w
  const doorX = idx % w
  const doorY = (idx / w) | 0
  const doorSpec = state.floor.gen?.doors.find((d) => d.locked && d.pos.x === doorX && d.pos.y === doorY)
  const needDefId = doorSpec?.keyDefId ?? 'IronKey'
  const keyItem = Object.values(state.party.items).find((it) => it.defId === needDefId && it.qty > 0)
  if (!keyItem) {
    const label = needDefId === 'BrassKey' ? 'a brass key' : 'an iron key'
    const withToast = reduce(state, { type: 'ui/toast', text: `Locked. Need ${label}.`, ms: 1100 })
    return reduce(withToast, { type: 'ui/sfx', kind: 'reject' })
  }

  const keyId = keyItem.id
  const consumed = keyId ? consumeItem(state, keyId) : state
  const tiles = consumed.floor.tiles.slice()
  tiles[idx] = 'floor'
  const keep = (consumed.ui.doorOpenFx ?? []).filter((x) => x.untilMs > consumed.nowMs)
  const doorOpenFx = keep.concat([
    { id: `doorFx_${consumed.nowMs}_${doorX},${doorY}`, pos: { x: doorX, y: doorY }, startedAtMs: consumed.nowMs, untilMs: consumed.nowMs + 420 },
  ])
  const opened = {
    ...consumed,
    floor: { ...consumed.floor, tiles, floorGeomRevision: consumed.floor.floorGeomRevision + 1 },
    ui: { ...consumed.ui, doorOpenFx },
  }
  let next: GameState = opened
  const xpRes = applyXp(next, 18)
  next = xpRes.state
  next = pushActivityLog(next, 'Unlocked the door. (+18 XP)')
  if (xpRes.leveledUp) {
    for (const perkId of xpRes.perkIds) {
      const perkLabel = perkId === 'vitals_plus5' ? '+5 max HP/STA' : perkId === 'damage_plus10pct' ? '+10% dmg' : perkId
      next = pushActivityLog(next, `Reached level ${next.run.level}. (${perkLabel})`)
    }
  }
  next = reduce(next, { type: 'ui/sfx', kind: 'ui' })
  return next
}

