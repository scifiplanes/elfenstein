import { ContentDB } from './content/contentDb'
import type { DebugUiPersist } from '../app/debugSettingsPersistence'
import type {
  CharacterId,
  DragPayload,
  DragTarget,
  EquipmentSlot,
  GameState,
  GpuTier,
  ItemDefId,
  ItemId,
  NpcKind,
  PoiKind,
  ProcgenDebugOverlayMode,
  RenderTuning,
  RoomTelegraphMode,
  StatusEffectId,
  Tile,
} from './types'
import { mergeHubHotspotConfig, type HubHotspotPatch } from './hubHotspotDefaults'
import { applyGpuTierToRender, isTierOwnedRenderKey } from './gpuTierPresets'
import { DEFAULT_RENDER } from './tuningDefaults'
import { clampNpcSpawnCountRange } from './npcSpawnTuning'
import {
  LEGACY_NPC_FLAT_KEYS,
  buildNpcBillboardFromInput,
  clampNpcBillboardRows,
  type LegacyNpcRenderFlat,
} from './npcBillboardTuning'
import { BOBR_INTRO_TOTAL_MS } from './bobrIntroMs'
import { makeInitialState } from './state/initialState'
import { applyStatusDecay } from './state/status'
import { consumeItem, dropItemToFloor, moveItemToInventorySlot, swapInventorySlots } from './state/inventory'
import { feedCharacter, inspectCharacter } from './state/interactions'
import { applyItemOnPoi, applyPoiUse } from './state/poi'
import {
  clearEquippedSlotIfMatched,
  equipHandsFromPortrait,
  equipHatFromPortrait,
  equipItem,
  moveEquippedItemToInventorySlot,
  resolveWeaponItemIdForPcTurn,
  unequipItem,
} from './state/equipment'
import { generateDungeon } from '../procgen/generateDungeon'
import type { FloorProperty, FloorType } from '../procgen/types'
import { normalizeFloorGenDifficulty } from '../procgen/types'
import { makeDropJitter } from './state/dropJitter'
import { hydrateGenFloorItems, snapViewToGrid } from './state/procgenHydrate'
import { npcKindHpMax } from './content/npcCombat'
import { hydrateFloorNpcs, npcsWithDefaultStatuses } from './state/npcHydrate'
import { pickupFloorItem } from './state/floorItems'
import { pickNpcLootDefId } from './content/npcLoot'
import { isAnyDoorTile, isOpenDoorTile, isPassableOpenDoorTile, tileAfterDoorOpens } from './tiles'
import { findRecipe } from './content/recipes'
import { maybeFinishCrafting, startCrafting } from './state/crafting'
import { pruneExpiredActivityLog, pushActivityLog } from './state/activityLog'
import { descendToNextFloor } from './state/floorProgression'
import { FLOOR_TYPE_ORDER } from './state/runFloorSchedule'
import { nearestFloorCellWithoutPoi, pickPlayerSpawnCell, poiOccupiesCell } from './state/playerFloorCell'
import { applyXp } from './state/runProgression'
import {
  advanceTurnIndex,
  applyCombatFireshield,
  applyWeaponStatusOnHitFromPc,
  attemptFlee,
  collectEncounterNpcIds,
  computePcAttackDamage,
  currentTurn,
  defend,
  endCombat,
  enterCombat,
  npcCombatTuning,
  npcTakeTurn,
  pruneCombatTurnQueue,
} from './state/combat'
import { roomForCell } from './state/roomGeometry'
import {
  closeTradeSession,
  openFloorNpcTrade,
  openHubInnkeeperTrade,
  tradeHasValidAsk,
  tryClearTradeAsk,
  tryConsumeStagedOfferOnly,
  tryExecuteTrade,
  tryReturnTradeOfferToInventory,
  trySetTradeAsk,
  tryStageTradeOffer,
} from './state/trade'
import { innkeeperBarterActivityLogLine, INNKEEPER_OPEN_TRADE_ACTIVITY_LOG } from './npc/innkeeperBarterLog'
import {
  innkeeperSpeechAskNoOffer,
  innkeeperSpeechAskWithOffer,
  innkeeperSpeechExecuteBarter,
  innkeeperSpeechExecuteOfferGift,
  innkeeperSpeechExecuteRequestOnly,
  innkeeperSpeechWelcome,
} from './npc/innkeeperTradeMojibake'
import { HUB_INNKEEPER_SPEECH_WELCOME_MS } from './npc/innkeeperSpeechTiming'

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

function rejectNotWhileInCombat(state: GameState): GameState {
  const withLog = pushActivityLog(state, 'Not while in combat.')
  const q = withLog.ui.sfxQueue ?? []
  return {
    ...withLog,
    ui: { ...withLog.ui, sfxQueue: q.concat([{ id: `s_${withLog.nowMs}_${q.length}`, kind: 'reject' }]) },
  }
}

function mergePersistedDebugUi(state: GameState, patch: DebugUiPersist | undefined): GameState {
  if (!patch) return state
  const ui = { ...state.ui }
  if ('debugBgTrack' in patch) ui.debugBgTrack = patch.debugBgTrack ?? undefined
  if ('procgenDebugOverlay' in patch) ui.procgenDebugOverlay = patch.procgenDebugOverlay ?? undefined
  if ('roomTelegraphMode' in patch && patch.roomTelegraphMode !== undefined) ui.roomTelegraphMode = patch.roomTelegraphMode
  if ('roomTelegraphStrength' in patch && patch.roomTelegraphStrength !== undefined) {
    ui.roomTelegraphStrength = Math.max(0, Math.min(1, patch.roomTelegraphStrength))
  }
  if ('debugShowNpcDialogPopup' in patch && patch.debugShowNpcDialogPopup !== undefined) {
    ui.debugShowNpcDialogPopup = patch.debugShowNpcDialogPopup
  }
  if ('debugShowDeathPopup' in patch && patch.debugShowDeathPopup !== undefined) {
    ui.debugShowDeathPopup = patch.debugShowDeathPopup
  }
  return { ...state, ui }
}

export type Action =
  | { type: 'ui/toggleDebug' }
  | { type: 'ui/toggleSettings' }
  | { type: 'ui/clearHubInnkeeperSpeech' }
  | { type: 'ui/setSettingsOpen'; open: boolean }
  | { type: 'ui/goTitle' }
  | { type: 'ui/openPaperdoll'; characterId: string }
  /** Opens paperdoll and schedules idle overlay pulse (HUD capture path; avoids lost clicks). */
  | { type: 'ui/portraitFrameTap'; characterId: string }
  | { type: 'ui/portraitIdleCancel'; characterId: string }
  | { type: 'ui/closePaperdoll' }
  | { type: 'ui/openNpcDialog'; npcId: string }
  | { type: 'ui/closeNpcDialog' }
  | { type: 'ui/toast'; text: string; ms?: number }
  | { type: 'ui/shake'; magnitude: number; ms?: number }
  | { type: 'ui/sfx'; kind: 'ui' | 'hit' | 'swing' | 'reject' | 'pickup' | 'munch' | 'step' | 'bump' | 'nav' | 'bones' }
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
  /** Debug: spawn a floor item of the given def one cell in front of the player (floor tile only). */
  | { type: 'debug/spawnItem'; defId: ItemDefId }
  /** Debug: cycle `floor.floorType` along segment order (see `FLOOR_TYPE_ORDER`). Regen separately to apply. */
  | { type: 'floor/debugCycleRealizer' }
  /** Debug: cycle `floor.difficulty` (0 → 1 → 2). Regen separately to apply. */
  | { type: 'floor/debugCycleDifficulty' }
  /** Debug: set floor index (0-based). Regen/descend separately to materialize. */
  | { type: 'floor/debugSetFloorIndex'; floorIndex: number }
  /** Debug: toggle a procgen floor property. Regen/descend separately to materialize. */
  | { type: 'floor/debugToggleFloorProperty'; property: FloorProperty }
  | { type: 'ui/setProcgenDebugOverlay'; mode: ProcgenDebugOverlayMode | undefined }
  | { type: 'ui/setDebugBgTrack'; track: string | undefined }
  | { type: 'ui/triggerDebugBgSfx'; index: number }
  | {
      type: 'render/set'
      key: Exclude<keyof GameState['render'], 'npcBillboard' | 'gpuTier'>
      value: number
    }
  | { type: 'render/setGpuTier'; tier: Exclude<GpuTier, 'custom'> }
  | { type: 'render/npcBillboard'; kind: NpcKind; field: 'groundY' | 'size' | 'sizeRand'; value: number }
  | { type: 'debug/loadTuning'; render?: Partial<RenderTuning>; audio?: Partial<GameState['audio']> }
  | { type: 'debug/loadHubHotspots'; patch?: HubHotspotPatch }
  | { type: 'debug/loadPersistedUi'; patch?: DebugUiPersist }
  | { type: 'debug/setRoomTelegraphMode'; mode: RoomTelegraphMode }
  | { type: 'debug/setRoomTelegraphStrength'; strength: number }
  | {
      type: 'hubHotspot/setAxis'
      spot: 'village.tavern' | 'village.cave' | 'tavern.innkeeper' | 'tavern.innkeeperTrade'
      key: 'x' | 'y' | 'w' | 'h'
      value: number
    }
  | { type: 'hub/goTavern' }
  | { type: 'hub/goVillage' }
  | { type: 'hub/enterDungeon' }
  | { type: 'hub/openTavernTrade' }
  | { type: 'hub/closeTavernTrade' }
  | { type: 'trade/openNpc'; npcId: string }
  | { type: 'trade/close' }
  | { type: 'trade/execute' }
  | { type: 'trade/clearAsk' }
  | { type: 'trade/selectStock'; stockIndex: number }
  /** While trading: put a wanted inventory item into the offer slot (click path; same rules as drag to offer). */
  | { type: 'trade/stageOfferFromInventory'; slotIndex: number }
  /** F2: preview the NPC dialog modal (first NPC on the floor) without affecting real dialog state. */
  | { type: 'debug/setShowNpcDialogPopupPreview'; show: boolean }
  /** F2: preview the death modal without killing the party. */
  | { type: 'debug/setShowDeathPopupPreview'; show: boolean }
  | { type: 'floor/toggleChest'; poiId: string }
  | { type: 'npc/attack'; npcId: string; itemId: ItemId; actorId?: string }
  | { type: 'npc/give'; npcId: string; itemId: ItemId }
  | { type: 'npc/pet'; npcId: string }
  | { type: 'combat/enter'; npcId: string }
  | { type: 'combat/advanceTurn' }
  | { type: 'combat/end' }
  | { type: 'combat/fleeAttempt' }
  | { type: 'combat/defend' }
  | { type: 'combat/clickAttack'; npcId: string }
  | { type: 'run/new'; playBobrIntro?: boolean }
  | { type: 'run/reloadCheckpoint' }
  | { type: 'ui/dismissBobrIntro' }

export function initialState(content: ContentDB): GameState {
  return applySpawnRoomHazardIfNeeded(makeInitialState(content))
}

/**
 * SFX played once when the player opens a dialog with a given NPC kind.
 * Add entries here to assign a sound to any NPC — no other changes needed.
 */
const NPC_DIALOG_SFX: Partial<Record<NpcKind, import('../ui/feedback/SfxEngine').SfxKind>> = {
  Skeleton: 'bones',
  Chumbo:   'deep_gnome',
}

export function reduce(state: GameState, action: Action): GameState {
  // Settings / pause menu: block gameplay on every screen (including hub and death).
  if (state.ui.settingsOpen) {
    switch (action.type) {
      case 'run/new':
      case 'run/reloadCheckpoint':
      case 'ui/goTitle':
      case 'time/tick':
      case 'ui/toggleDebug':
      case 'ui/toggleSettings':
      case 'ui/setSettingsOpen':
      case 'ui/clearHubInnkeeperSpeech':
      case 'ui/setProcgenDebugOverlay':
      case 'ui/setDebugBgTrack':
      case 'ui/triggerDebugBgSfx':
      case 'render/set':
      case 'render/setGpuTier':
      case 'render/npcBillboard':
      case 'debug/loadTuning':
      case 'debug/loadHubHotspots':
      case 'debug/loadPersistedUi':
      case 'debug/setRoomTelegraphMode':
      case 'debug/setRoomTelegraphStrength':
      case 'debug/setShowNpcDialogPopupPreview':
      case 'debug/setShowDeathPopupPreview':
      case 'audio/set':
      case 'hubHotspot/setAxis':
      case 'ui/dismissBobrIntro':
        break
      default:
        return state
    }
  }

  // Title blocks gameplay until the player starts/continues a run.
  if (state.ui.screen === 'title' && !state.ui.death) {
    switch (action.type) {
      case 'run/new':
      case 'run/reloadCheckpoint':
      case 'ui/goTitle':
      case 'time/tick':
      case 'ui/toggleDebug':
      case 'ui/toggleSettings':
      case 'ui/setSettingsOpen':
      case 'ui/clearHubInnkeeperSpeech':
      case 'ui/setProcgenDebugOverlay':
      case 'ui/setDebugBgTrack':
      case 'ui/triggerDebugBgSfx':
      case 'render/set':
      case 'render/setGpuTier':
      case 'render/npcBillboard':
      case 'debug/loadTuning':
      case 'debug/loadHubHotspots':
      case 'debug/loadPersistedUi':
      case 'debug/setRoomTelegraphMode':
      case 'debug/setRoomTelegraphStrength':
      case 'debug/setShowNpcDialogPopupPreview':
      case 'debug/setShowDeathPopupPreview':
      case 'audio/set':
      case 'hubHotspot/setAxis':
      case 'ui/dismissBobrIntro':
        break
      default:
        return state
    }
  }

  // Hub (2D village/tavern): no dungeon gameplay until Cave.
  if (state.ui.screen === 'hub' && !state.ui.death) {
    switch (action.type) {
      case 'run/new':
      case 'run/reloadCheckpoint':
      case 'ui/goTitle':
      case 'time/tick':
      case 'ui/toggleDebug':
      case 'ui/toggleSettings':
      case 'ui/setSettingsOpen':
      case 'ui/clearHubInnkeeperSpeech':
      case 'ui/setProcgenDebugOverlay':
      case 'ui/setDebugBgTrack':
      case 'ui/triggerDebugBgSfx':
      case 'render/set':
      case 'render/setGpuTier':
      case 'render/npcBillboard':
      case 'debug/loadTuning':
      case 'debug/loadHubHotspots':
      case 'debug/loadPersistedUi':
      case 'debug/setRoomTelegraphMode':
      case 'debug/setRoomTelegraphStrength':
      case 'debug/setShowNpcDialogPopupPreview':
      case 'debug/setShowDeathPopupPreview':
      case 'audio/set':
      case 'hubHotspot/setAxis':
      case 'hub/goTavern':
      case 'hub/goVillage':
      case 'hub/enterDungeon':
      case 'hub/openTavernTrade':
      case 'hub/closeTavernTrade':
      case 'trade/openNpc':
      case 'trade/close':
      case 'trade/execute':
      case 'trade/clearAsk':
      case 'trade/selectStock':
      case 'trade/stageOfferFromInventory':
      case 'drag/drop':
      case 'ui/sfx':
      case 'ui/shake':
      case 'ui/toast':
      case 'ui/dismissBobrIntro':
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
      case 'ui/toggleSettings':
      case 'ui/setSettingsOpen':
      case 'ui/clearHubInnkeeperSpeech':
      case 'ui/setProcgenDebugOverlay':
      case 'ui/setDebugBgTrack':
      case 'ui/triggerDebugBgSfx':
      case 'render/set':
      case 'render/setGpuTier':
      case 'render/npcBillboard':
      case 'debug/loadTuning':
      case 'debug/loadHubHotspots':
      case 'debug/loadPersistedUi':
      case 'debug/setRoomTelegraphMode':
      case 'debug/setRoomTelegraphStrength':
      case 'debug/setShowNpcDialogPopupPreview':
      case 'debug/setShowDeathPopupPreview':
      case 'audio/set':
      case 'hubHotspot/setAxis':
      case 'ui/dismissBobrIntro':
        break
      default:
        return state
    }
  }

  switch (action.type) {
    case 'ui/goTitle': {
      return {
        ...state,
        ui: {
          ...state.ui,
          screen: 'title',
          settingsOpen: false,
          hubScene: undefined,
          hubKind: undefined,
          tradeSession: undefined,
          hubInnkeeperSpeech: undefined,
          hubInnkeeperSpeechTtlMs: undefined,
          paperdollFor: undefined,
          npcDialogFor: undefined,
          debugShowNpcDialogPopup: false,
          debugShowDeathPopup: false,
          bobrIntroUntilMs: undefined,
        },
      }
    }
    case 'ui/dismissBobrIntro': {
      if (state.ui.bobrIntroUntilMs == null) return state
      return { ...state, ui: { ...state.ui, bobrIntroUntilMs: undefined } }
    }
    case 'run/new': {
      const fresh = makeInitialState(CONTENT)
      const playBobrIntro = action.playBobrIntro === true
      // Preserve tuning across runs; keep debug panel state too.
      const preserved: GameState = {
        ...fresh,
        render: state.render,
        audio: state.audio,
        hubHotspots: state.hubHotspots,
        ui: {
          ...fresh.ui,
          screen: 'hub',
          settingsOpen: false,
          hubScene: 'village',
          hubKind: undefined,
          tradeSession: undefined,
          hubInnkeeperSpeech: undefined,
          hubInnkeeperSpeechTtlMs: undefined,
          debugOpen: state.ui.debugOpen,
          debugShowNpcDialogPopup: false,
          debugShowDeathPopup: false,
          bobrIntroUntilMs: playBobrIntro ? state.nowMs + BOBR_INTRO_TOTAL_MS : undefined,
        },
      }
      return pushActivityLog(applySpawnRoomHazardIfNeeded(preserved), 'New run.')
    }
    case 'run/reloadCheckpoint': {
      const cp = state.run.checkpoint
      if (!cp) return reduce(pushActivityLog(state, 'No checkpoint.'), { type: 'ui/sfx', kind: 'reject' })
      const snap = cp.snapshot
      const f0 = snap.floor
      const nudgedPos = nearestFloorCellWithoutPoi(f0.tiles, f0.w, f0.h, f0.playerPos, f0.pois)
      const floorBody =
        nudgedPos.x === f0.playerPos.x && nudgedPos.y === f0.playerPos.y
          ? f0
          : { ...f0, playerPos: nudgedPos }
      const floor = { ...floorBody, npcs: hydrateFloorNpcs(floorBody.npcs as GameState['floor']['npcs']) }
      const view =
        floorBody === f0
          ? snap.view
          : snapViewToGrid(floor.w, floor.h, state.render.camEyeHeight, nudgedPos, floor.playerDir)
      const next: GameState = {
        ...state,
        // Preserve tuning across restore (same as `run/new`).
        render: state.render,
        audio: state.audio,
        run: { ...(snap.run as any), checkpoint: cp },
        floor,
        party: snap.party,
        view,
        ui: {
          ...state.ui,
          screen: snap.ui.screen,
          debugOpen: snap.ui.debugOpen,
          procgenDebugOverlay: snap.ui.procgenDebugOverlay,
          // Refresh timestamps so TTL pruning does not wipe restored lines on the first tick.
          activityLog: (snap.ui.activityLog ?? []).map((e) => ({ ...e, atMs: state.nowMs })),
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
          sfxQueue: [{ id: `s_${state.nowMs}_well_reload`, kind: 'well' as const }],
          debugShowNpcDialogPopup: false,
          debugShowDeathPopup: false,
          settingsOpen: false,
          hubScene: undefined,
          hubKind: undefined,
          tradeSession: undefined,
          hubInnkeeperSpeech: undefined,
          hubInnkeeperSpeechTtlMs: undefined,
          bobrIntroUntilMs: undefined,
        },
      }
      return pushActivityLog(next, 'Reloaded checkpoint.')
    }
    case 'hub/goTavern': {
      if (state.ui.screen !== 'hub' || state.ui.hubScene !== 'village') return state
      const next: GameState = {
        ...state,
        ui: {
          ...state.ui,
          hubScene: 'tavern',
          tradeSession: undefined,
          hubInnkeeperSpeech: undefined,
          hubInnkeeperSpeechTtlMs: undefined,
        },
      }
      if (next.ui.hubKind !== 'camp') return pushActivityLog(next, INNKEEPER_OPEN_TRADE_ACTIVITY_LOG)
      return next
    }
    case 'hub/goVillage': {
      if (state.ui.screen !== 'hub' || state.ui.hubScene !== 'tavern') return state
      return {
        ...state,
        ui: {
          ...state.ui,
          hubScene: 'village',
          tradeSession: undefined,
          hubInnkeeperSpeech: undefined,
          hubInnkeeperSpeechTtlMs: undefined,
          activityLog: [],
        },
      }
    }
    case 'hub/enterDungeon': {
      if (state.ui.screen !== 'hub') return state
      const f = state.floor
      return {
        ...state,
        ui: {
          ...state.ui,
          screen: 'game',
          hubScene: undefined,
          hubKind: undefined,
          tradeSession: undefined,
          hubInnkeeperSpeech: undefined,
          hubInnkeeperSpeechTtlMs: undefined,
        },
        view: snapViewToGrid(f.w, f.h, state.render.camEyeHeight, f.playerPos, f.playerDir),
        // Rebuild 3D mesh after hub used a different viewport rect for the same floor (avoids stale/off-by-one feel).
        floor: { ...f, floorGeomRevision: f.floorGeomRevision + 1 },
      }
    }
    case 'hub/openTavernTrade': {
      const next = openHubInnkeeperTrade(state)
      if (next.ui.tradeSession?.kind !== 'hub_innkeeper') return next
      const seed = (Math.floor(state.nowMs) ^ 0x51e7) >>> 0
      const line = innkeeperSpeechWelcome(next.ui.tradeSession.wants, seed, (id) => CONTENT.item(id).name)
      return {
        ...next,
        ui: { ...next.ui, hubInnkeeperSpeech: line, hubInnkeeperSpeechTtlMs: HUB_INNKEEPER_SPEECH_WELCOME_MS },
      }
    }
    case 'hub/closeTavernTrade':
    case 'trade/close': {
      return closeTradeSession(state)
    }
    case 'trade/openNpc': {
      return openFloorNpcTrade(state, action.npcId)
    }
    case 'trade/clearAsk': {
      const ts = state.ui.tradeSession
      if (!ts) return state
      return tryClearTradeAsk(state, ts)
    }
    case 'trade/selectStock': {
      const ts = state.ui.tradeSession
      if (!ts) return state
      if (ts.askStockIndex === action.stockIndex) {
        return tryClearTradeAsk(state, ts)
      }
      const applied = trySetTradeAsk(state, ts, action.stockIndex)
      if (!applied) return state
      if (applied.ui.tradeSession?.kind !== 'hub_innkeeper') return applied
      const ts2 = applied.ui.tradeSession
      if (ts2.kind !== 'hub_innkeeper') return applied
      const seed = (Math.floor(state.nowMs) ^ 0x51e8 ^ action.stockIndex) >>> 0
      const line =
        ts2.offerItemId == null ? innkeeperSpeechAskNoOffer(seed) : innkeeperSpeechAskWithOffer(seed)
      return {
        ...applied,
        ui: { ...applied.ui, hubInnkeeperSpeech: line, hubInnkeeperSpeechTtlMs: undefined },
      }
    }
    case 'trade/stageOfferFromInventory': {
      if (state.combat) return rejectNotWhileInCombat(state)
      const ts = state.ui.tradeSession
      if (!ts) return state
      const itemId = state.party.inventory.slots[action.slotIndex]
      if (!itemId) return state
      const applied = tryStageTradeOffer(state, ts, itemId, action.slotIndex)
      if (!applied) return reduce(state, { type: 'ui/sfx', kind: 'reject' })
      return reduce(reduce(applied, { type: 'ui/sfx', kind: 'ui' }), { type: 'ui/shake', magnitude: 0.12, ms: 70 })
    }
    case 'trade/execute': {
      if (state.combat) return rejectNotWhileInCombat(state)
      const ts = state.ui.tradeSession
      if (!ts) return state
      const offerId = ts.offerItemId
      const hasOffer = offerId != null && Boolean(state.party.items[offerId])
      const hasAsk = tradeHasValidAsk(state, ts)
      const seed = (Math.floor(state.nowMs) ^ 0x7e4e) >>> 0

      if (!hasOffer && !hasAsk) return state

      if (!hasOffer && hasAsk) {
        if (ts.kind !== 'hub_innkeeper') return state
        return {
          ...state,
          ui: {
            ...state.ui,
            hubInnkeeperSpeech: innkeeperSpeechExecuteRequestOnly(seed),
            hubInnkeeperSpeechTtlMs: undefined,
          },
        }
      }

      if (hasOffer && !hasAsk) {
        const consumed = tryConsumeStagedOfferOnly(state, ts)
        if (!consumed) return reduce(state, { type: 'ui/sfx', kind: 'reject' })
        const withSpeech =
          ts.kind === 'hub_innkeeper'
            ? {
                ...consumed,
                ui: {
                  ...consumed.ui,
                  hubInnkeeperSpeech: innkeeperSpeechExecuteOfferGift(seed),
                  hubInnkeeperSpeechTtlMs: undefined,
                },
              }
            : consumed
        return reduce(withSpeech, { type: 'ui/sfx', kind: 'pickup' })
      }

      let next = tryExecuteTrade(state, ts, state.nowMs)
      if (!next) return reduce(state, { type: 'ui/sfx', kind: 'reject' })
      let logLine = 'Trade complete.'
      if (ts.kind === 'hub_innkeeper') {
        const completed = (next.run.hubInnkeeperTradesCompleted ?? 0) + 1
        next = { ...next, run: { ...next.run, hubInnkeeperTradesCompleted: completed } }
        logLine = innkeeperBarterActivityLogLine(completed)
      }
      const withSpeech =
        ts.kind === 'hub_innkeeper'
          ? {
              ...next,
              ui: {
                ...next.ui,
                hubInnkeeperSpeech: innkeeperSpeechExecuteBarter(seed),
                hubInnkeeperSpeechTtlMs: undefined,
              },
            }
          : next
      return reduce(pushActivityLog(withSpeech, logLine), { type: 'ui/sfx', kind: 'pickup' })
    }
    case 'debug/loadHubHotspots': {
      return { ...state, hubHotspots: mergeHubHotspotConfig(state.hubHotspots, action.patch) }
    }
    case 'debug/loadPersistedUi':
      return mergePersistedDebugUi(state, action.patch)
    case 'debug/setRoomTelegraphMode':
      return { ...state, ui: { ...state.ui, roomTelegraphMode: action.mode } }
    case 'debug/setRoomTelegraphStrength':
      return {
        ...state,
        ui: { ...state.ui, roomTelegraphStrength: Math.max(0, Math.min(1, action.strength)) },
      }
    case 'hubHotspot/setAxis': {
      const { spot, key, value } = action
      const h = state.hubHotspots
      let next: typeof h
      if (spot === 'village.tavern') {
        next = { ...h, village: { ...h.village, tavern: { ...h.village.tavern, [key]: value } } }
      } else if (spot === 'village.cave') {
        next = { ...h, village: { ...h.village, cave: { ...h.village.cave, [key]: value } } }
      } else if (spot === 'tavern.innkeeper') {
        next = { ...h, tavern: { ...h.tavern, innkeeper: { ...h.tavern.innkeeper, [key]: value } } }
      } else if (spot === 'tavern.innkeeperTrade') {
        next = {
          ...h,
          tavern: { ...h.tavern, innkeeperTrade: { ...h.tavern.innkeeperTrade, [key]: value } },
        }
      } else {
        return state
      }
      return { ...state, hubHotspots: next }
    }
    case 'ui/toggleDebug':
      return { ...state, ui: { ...state.ui, debugOpen: !state.ui.debugOpen } }
    case 'ui/toggleSettings':
      return { ...state, ui: { ...state.ui, settingsOpen: !state.ui.settingsOpen } }
    case 'ui/setSettingsOpen':
      return { ...state, ui: { ...state.ui, settingsOpen: action.open } }
    case 'ui/setProcgenDebugOverlay':
      return { ...state, ui: { ...state.ui, procgenDebugOverlay: action.mode } }
    case 'ui/setDebugBgTrack':
      return { ...state, ui: { ...state.ui, debugBgTrack: action.track } }
    case 'ui/triggerDebugBgSfx':
      return {
        ...state,
        ui: {
          ...state.ui,
          debugBgSfxTrigger: { index: action.index, seq: (state.ui.debugBgSfxTrigger?.seq ?? 0) + 1 },
        },
      }
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
    case 'ui/portraitIdleCancel': {
      const p = state.ui.portraitIdlePulse
      if (!p || p.characterId !== action.characterId) return state
      return { ...state, ui: { ...state.ui, portraitIdlePulse: undefined } }
    }
    case 'ui/closePaperdoll':
      return { ...state, ui: { ...state.ui, paperdollFor: undefined } }
    case 'ui/openNpcDialog': {
      const npc = state.floor.npcs.find((n) => n.id === action.npcId)
      const dialogSfx = npc ? NPC_DIALOG_SFX[npc.kind] : undefined
      const sfxQueue = dialogSfx
        ? (state.ui.sfxQueue ?? []).concat([{ id: `s_${state.nowMs}_npc_dialog`, kind: dialogSfx }])
        : state.ui.sfxQueue
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
      return { ...state, ui: { ...state.ui, npcDialogFor: undefined, debugShowNpcDialogPopup: false } }
    case 'ui/clearHubInnkeeperSpeech':
      return {
        ...state,
        ui: { ...state.ui, hubInnkeeperSpeech: undefined, hubInnkeeperSpeechTtlMs: undefined },
      }
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
      const tickNow = action.nowMs
      let tickState = state
      if (state.ui.bobrIntroUntilMs != null && tickNow >= state.ui.bobrIntroUntilMs) {
        tickState = { ...state, ui: { ...state.ui, bobrIntroUntilMs: undefined } }
      }
      const next: GameState = pruneExpiredActivityLog({ ...tickState, nowMs: tickNow })
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
            ui: {
              ...updated.ui,
              death: { atMs: updated.nowMs, runId: updated.run.runId, floorIndex: updated.floor.floorIndex, level: updated.run.level },
              debugShowDeathPopup: false,
            },
          }
          return pushActivityLog(dead, 'The party has fallen.')
        }
        return updated
      }
      const wiped = withAnim.party.chars.length > 0 && withAnim.party.chars.every((c) => c.hp <= 0)
      if (wiped && !withAnim.ui.death) {
        const dead = {
          ...withAnim,
          ui: {
            ...withAnim.ui,
            death: { atMs: withAnim.nowMs, runId: withAnim.run.runId, floorIndex: withAnim.floor.floorIndex, level: withAnim.run.level },
            debugShowDeathPopup: false,
          },
        }
        return pushActivityLog(dead, 'The party has fallen.')
      }
      return withAnim
    }
    case 'render/set': {
      const tierPatch: Partial<RenderTuning> = isTierOwnedRenderKey(action.key) ? { gpuTier: 'custom' } : {}
      const raw = { ...state.render, [action.key]: action.value, ...tierPatch }
      const render = clampRenderTuning(raw)
      let next: GameState = { ...state, render }
      if (action.key === 'camEyeHeight') {
        return applyCamEyeHeight(next, render.camEyeHeight)
      }
      return next
    }
    case 'render/setGpuTier': {
      const render = clampRenderTuning(applyGpuTierToRender(state.render, action.tier))
      return { ...state, render }
    }
    case 'render/npcBillboard': {
      const cur = state.render.npcBillboard[action.kind]
      const row = { ...cur, [action.field]: action.value }
      const npcBillboard = { ...state.render.npcBillboard, [action.kind]: row }
      const render = clampRenderTuning({ ...state.render, npcBillboard })
      return { ...state, render }
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
    case 'debug/setShowNpcDialogPopupPreview': {
      return { ...state, ui: { ...state.ui, debugShowNpcDialogPopup: action.show } }
    }
    case 'debug/setShowDeathPopupPreview': {
      return { ...state, ui: { ...state.ui, debugShowDeathPopup: action.show } }
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
      const hpMax = npcKindHpMax(action.kind)
      const base = {
        id: `debug_npc_${state.nowMs}`,
        kind: action.kind,
        name: action.kind,
        pos,
        hp: hpMax,
        hpMax,
        language: 'DeepGnome' as const,
        statuses: [] as GameState['floor']['npcs'][number]['statuses'],
      }
      const npc: GameState['floor']['npcs'][number] =
        action.kind === 'Bobr'
          ? {
              ...base,
              status: 'friendly' as const,
              trade: {
                stock: [
                  { defId: 'Mushrooms' as const, qty: 3 },
                  { defId: 'Flourball' as const, qty: 1 },
                ],
                wants: ['Stone' as const, 'Stick' as const],
              },
            }
          : { ...base, status: 'neutral' as const }
      return { ...state, floor: { ...state.floor, npcs: [...state.floor.npcs, npc], floorGeomRevision: state.floor.floorGeomRevision + 1 } }
    }
    case 'debug/spawnPoi': {
      const dv = dirVec(state.floor.playerDir)
      const pos = { x: state.floor.playerPos.x + dv.x, y: state.floor.playerPos.y + dv.y }
      const poi = { id: `debug_poi_${state.nowMs}`, kind: action.kind, pos }
      return { ...state, floor: { ...state.floor, pois: [...state.floor.pois, poi], floorGeomRevision: state.floor.floorGeomRevision + 1 } }
    }
    case 'debug/spawnItem': {
      try {
        CONTENT.item(action.defId)
      } catch {
        return state
      }
      const dv = dirVec(state.floor.playerDir)
      const pos = { x: state.floor.playerPos.x + dv.x, y: state.floor.playerPos.y + dv.y }
      const { w, h, tiles } = state.floor
      if (pos.x < 0 || pos.y < 0 || pos.x >= w || pos.y >= h || tiles[pos.x + pos.y * w] !== 'floor') {
        return pushActivityLog(state, 'Cannot spawn item: cell ahead is not floor.')
      }
      const newId = (`i_${action.defId}_${state.floor.seed}_dbg_${state.nowMs}` as unknown) as ItemId
      const jitter = makeDropJitter({
        floorSeed: state.floor.seed,
        itemId: newId,
        nonce: Math.floor(state.nowMs),
        radius: state.render.dropJitterRadius ?? 0.28,
      })
      return {
        ...state,
        party: {
          ...state.party,
          items: { ...state.party.items, [newId]: { id: newId, defId: action.defId, qty: 1 } },
        },
        floor: {
          ...state.floor,
          itemsOnFloor: state.floor.itemsOnFloor.concat([{ id: newId, pos: { ...pos }, jitter }]),
          floorGeomRevision: state.floor.floorGeomRevision + 1,
        },
      }
    }
    case 'floor/debugCycleRealizer': {
      const order = [...FLOOR_TYPE_ORDER] as FloorType[]
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
        npcSpawnCountMin: state.render.npcSpawnCountMin,
        npcSpawnCountMax: state.render.npcSpawnCountMax,
      })
      const playerPos = pickPlayerSpawnCell(gen.tiles, w, h, gen.entrance, gen.pois)
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
          npcs: npcsWithDefaultStatuses(gen.npcs),
          playerPos,
          playerDir,
          roomHazardAppliedForRoomId: undefined,
        },
        party: { ...state.party, items: { ...state.party.items, ...spawnedItems } },
        view: snapViewToGrid(w, h, state.render.camEyeHeight, playerPos, playerDir),
      }
      return pushActivityLog(applySpawnRoomHazardIfNeeded(next), `Regenerated (seed ${nextSeed}).`)
    }
    case 'floor/descend': {
      return applySpawnRoomHazardIfNeeded(descendToNextFloor(state))
    }
    case 'player/turn': {
      const stateAfterDialog = dismissNpcDialogOnMovement(state)
      if (stateAfterDialog.view.anim) return stateAfterDialog
      const dir = (((stateAfterDialog.floor.playerDir + action.dir) % 4) + 4) % 4
      const fromYaw = stateAfterDialog.view.camYaw
      const baseToYaw = (dir * Math.PI) / 2
      const toYaw = nearestEquivalentAngle(fromYaw, baseToYaw)
      const startedAtMs = stateAfterDialog.nowMs
      const endsAtMs = startedAtMs + 90
      return {
        ...stateAfterDialog,
        floor: { ...stateAfterDialog.floor, playerDir: dir as any },
        view: {
          ...stateAfterDialog.view,
          anim: {
            kind: 'turn',
            fromPos: stateAfterDialog.view.camPos,
            toPos: stateAfterDialog.view.camPos,
            fromYaw,
            toYaw,
            startedAtMs,
            endsAtMs,
          },
        },
      }
    }
    case 'player/step': {
      const s0 = dismissNpcDialogOnMovement(state)
      if (s0.view.anim) return s0
      if (s0.combat) {
        const withToast = reduce(s0, { type: 'ui/toast', text: 'You cannot move during combat.', ms: 900 })
        return reduce(withToast, { type: 'ui/sfx', kind: 'reject' })
      }
      const { playerDir, playerPos } = s0.floor
      const step = action.forward
      const v = dirVec(playerDir)
      const nx = playerPos.x + v.x * step
      const ny = playerPos.y + v.y * step
      return attemptMoveTo(s0, nx, ny)
    }
    case 'player/strafe': {
      const s0 = dismissNpcDialogOnMovement(state)
      if (s0.view.anim) return s0
      if (s0.combat) {
        const withToast = reduce(s0, { type: 'ui/toast', text: 'You cannot move during combat.', ms: 900 })
        return reduce(withToast, { type: 'ui/sfx', kind: 'reject' })
      }
      const { playerDir, playerPos } = s0.floor
      const v = strafeVec(playerDir, action.side)
      const nx = playerPos.x + v.x
      const ny = playerPos.y + v.y
      return attemptMoveTo(s0, nx, ny)
    }
    case 'poi/use': {
      if (state.combat) return rejectNotWhileInCombat(state)
      return applySpawnRoomHazardIfNeeded(applyPoiUse(state, CONTENT, action.poiId))
    }
    case 'floor/pickup':
      if (state.combat) return rejectNotWhileInCombat(state)
      return pickupFloorItem(state, action.itemId)
    case 'drag/drop': {
      const stateAtAction = action.nowMs != null ? { ...state, nowMs: action.nowMs } : state
      const { payload, target } = action
      const ts0 = stateAtAction.ui.tradeSession
      if (ts0) {
        if (target.kind === 'inventorySlot' && payload.source.kind === 'tradeOffer') {
          const applied = tryReturnTradeOfferToInventory(stateAtAction, ts0, payload.itemId, target.slotIndex)
          if (applied) return applied
          return stateAtAction
        }
        if (payload.source.kind === 'tradeOffer' && target.kind !== 'inventorySlot') {
          return reduce(stateAtAction, { type: 'ui/sfx', kind: 'reject' })
        }
        if (target.kind === 'tradeOfferSlot' && payload.source.kind === 'inventorySlot') {
          const applied = tryStageTradeOffer(stateAtAction, ts0, payload.itemId, payload.source.slotIndex)
          if (applied) return reduce(reduce(applied, { type: 'ui/sfx', kind: 'ui' }), { type: 'ui/shake', magnitude: 0.12, ms: 70 })
          return reduce(stateAtAction, { type: 'ui/sfx', kind: 'reject' })
        }
      }
      if (target.kind === 'tradeStockSlot' || target.kind === 'hubInnkeeperTrade') {
        return reduce(stateAtAction, { type: 'ui/sfx', kind: 'reject' })
      }
      const itemId: ItemId = payload.itemId

      if (target.kind === 'stowEquipped') {
        if (payload.source.kind !== 'equipmentSlot') return stateAtAction
        return unequipItem(stateAtAction, payload.source.characterId, payload.source.slot)
      }

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
              if (stateAtAction.combat) return rejectNotWhileInCombat(stateAtAction)
              const withStart = startCrafting(stateAtAction, srcItem.id, dstItem.id, recipe, { dstSlotIndex: dst })
              return reduce(reduce(withStart, { type: 'ui/sfx', kind: 'ui' }), { type: 'ui/shake', magnitude: 0.2, ms: 90 })
            }
          }
          return swapInventorySlots(stateAtAction, src, dst)
        }
        if (payload.source.kind === 'equipmentSlot') {
          return moveEquippedItemToInventorySlot(
            stateAtAction,
            payload.source.characterId,
            payload.source.slot,
            itemId,
            dst,
          )
        }
        return moveItemToInventorySlot(stateAtAction, itemId, dst)
      }

      if (target.kind === 'floorDrop') {
        let st = stateAtAction
        if (payload.source.kind === 'equipmentSlot') {
          const cleared = clearEquippedSlotIfMatched(
            stateAtAction,
            payload.source.characterId,
            payload.source.slot,
            itemId,
          )
          if (!cleared) return stateAtAction
          st = cleared
        }

        const item = st.party.items[itemId]
        if (item?.defId === 'Hive' && st.combat) {
          return reduce(pushActivityLog(st, 'Not while in combat.'), { type: 'ui/sfx', kind: 'reject' })
        }
        if (item?.defId === 'Hive') {
          const seed = hashStr(`${st.floor.seed}:hive:${itemId}:${st.nowMs >> 9}`)
          const queenRoll = (seed % 100) + 1
          const breakRoll = ((seed >>> 10) % 100) + 1
          const breaks = breakRoll <= 75

          const pos = target.dropPos ?? st.floor.playerPos
          const hasFreeInv = st.party.inventory.slots.some((s) => s == null)

          // 8%: produce a Swarm Queen instead of spawning a Swarm.
          if (queenRoll <= 8) {
            let next = breaks ? consumeItem(st, itemId) : dropItemToFloor(st, itemId, pos)
            next = mintItemToInventoryOrFloor(next, 'SwarmQueen', `hiveQueen_${itemId}_${st.nowMs}`, pos)
            return reduce(
              pushActivityLog(next, hasFreeInv ? 'A Swarm Queen wriggles free.' : 'A Swarm Queen wriggles free and drops to the floor.'),
              { type: 'ui/sfx', kind: 'pickup' },
            )
          }

          // Otherwise: spawn a Swarm NPC at the drop cell.
          const swarmId = `npc_swarm_${st.floor.seed}_${(seed >>> 0).toString(16)}`
          const status: 'hostile' | 'neutral' = partyHasItemDef(st, 'SwarmQueen') ? 'neutral' : 'hostile'
          const smax = npcKindHpMax('Swarm')
          const swarm = {
            id: swarmId,
            kind: 'Swarm' as const,
            name: 'Swarm',
            pos,
            status,
            hp: smax,
            hpMax: smax,
            language: 'Zalgo' as const,
            statuses: [] as GameState['floor']['npcs'][number]['statuses'],
          }

          let next = breaks ? consumeItem(st, itemId) : dropItemToFloor(st, itemId, pos)
          next = {
            ...next,
            floor: { ...next.floor, npcs: next.floor.npcs.concat([swarm]), floorGeomRevision: next.floor.floorGeomRevision + 1 },
          }
          next = pushActivityLog(next, status === 'neutral' ? 'A swarm spills out, but it calms at your presence.' : 'A swarm spills out!')
          next = reduce(next, { type: 'ui/sfx', kind: 'reject' })
          return reduce(next, { type: 'ui/shake', magnitude: 0.35, ms: 160 })
        }

        return dropItemToFloor(st, itemId, target.dropPos)
      }

      if (target.kind === 'floorItem') {
        // When dragging onto a floor item, interpret as pickup.
        if (stateAtAction.combat) return rejectNotWhileInCombat(stateAtAction)
        return pickupFloorItem(stateAtAction, target.itemId)
      }

      if (target.kind === 'portrait') {
        if (target.target === 'eyes') return inspectCharacter(stateAtAction, CONTENT, target.characterId, itemId)
        if (target.target === 'mouth') return feedCharacter(stateAtAction, CONTENT, target.characterId, itemId)
        if (target.target === 'hat') {
          const before = stateAtAction
          const next = equipHatFromPortrait(before, CONTENT, target.characterId, itemId)
          if (next === before) {
            return reduce(pushActivityLog(before, 'That does not go on the head.'), { type: 'ui/sfx', kind: 'reject' })
          }
          return next
        }
        if (target.target === 'hands') {
          const itemHands = stateAtAction.party.items[itemId]
          const shieldDef = itemHands ? CONTENT.item(itemHands.defId).combatShield : undefined
          if (shieldDef && stateAtAction.combat) {
            const turn = currentTurn(stateAtAction)
            if (!turn || turn.kind !== 'pc' || turn.id !== target.characterId) {
              return reduce(pushActivityLog(stateAtAction, 'Not your turn.'), { type: 'ui/sfx', kind: 'reject' })
            }
            const pc = stateAtAction.party.chars.find((c) => c.id === target.characterId)
            if (!pc || pc.stamina < shieldDef.staminaCost) {
              return reduce(pushActivityLog(stateAtAction, 'Too exhausted.'), { type: 'ui/sfx', kind: 'reject' })
            }
            const idx = stateAtAction.party.chars.findIndex((c) => c.id === target.characterId)
            const chars = stateAtAction.party.chars.slice()
            chars[idx] = { ...chars[idx]!, stamina: Math.max(0, chars[idx]!.stamina - shieldDef.staminaCost) }
            let next: GameState = { ...stateAtAction, party: { ...stateAtAction.party, chars } }
            next = applyCombatFireshield(next, target.characterId as CharacterId, {
              fireResistBonusPct: shieldDef.fireResistBonusPct,
              shieldTurns: shieldDef.shieldTurns,
            })
            const name = next.party.chars.find((c) => c.id === target.characterId)?.name ?? 'PC'
            next = pushActivityLog(next, `${name} raises a fire ward (${shieldDef.shieldTurns} turns).`)
            next = consumeItem(next, itemId)
            next = reduce(next, { type: 'ui/sfx', kind: 'ui' })
            return reduce(next, { type: 'combat/advanceTurn' })
          }
          const before = stateAtAction
          const next = equipHandsFromPortrait(before, CONTENT, target.characterId, itemId)
          if (next === before) {
            return reduce(pushActivityLog(before, 'That cannot be equipped in hand.'), { type: 'ui/sfx', kind: 'reject' })
          }
          return next
        }
        return stateAtAction
      }

      if (target.kind === 'poi') {
        if (stateAtAction.combat) return rejectNotWhileInCombat(stateAtAction)
        return applyItemOnPoi(stateAtAction, CONTENT, itemId, target.poiId)
      }

      if (target.kind === 'equipmentSlot') {
        let st = stateAtAction
        if (payload.source.kind === 'equipmentSlot') {
          // Equipped items are not in `inventory.slots`, so `equipItem` → `removeItemFromInventory`
          // does not detach them; clear the source slot first (incl. two-hand) to avoid duplicates.
          const cleared = clearEquippedSlotIfMatched(
            st,
            payload.source.characterId,
            payload.source.slot,
            itemId,
          )
          if (!cleared) return stateAtAction
          st = cleared
        }
        return equipItem(st, target.characterId, target.slot, itemId, CONTENT)
      }

      if (target.kind === 'npc') {
        const item = stateAtAction.party.items[itemId]
        const npcIdx = stateAtAction.floor.npcs.findIndex((n) => n.id === target.npcId)
        if (!item || npcIdx < 0) return stateAtAction
        const npc = stateAtAction.floor.npcs[npcIdx]!

        // Special-case: Swarm Basket captures a Swarm.
        if (item.defId === 'SwarmBasket' && npc.kind === 'Swarm') {
          if (stateAtAction.combat) {
            return reduce(pushActivityLog(stateAtAction, 'Not while in combat.'), { type: 'ui/sfx', kind: 'reject' })
          }
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
            if (stateAtAction.combat) {
              return reduce(pushActivityLog(stateAtAction, 'Not while in combat.'), { type: 'ui/sfx', kind: 'reject' })
            }
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
          if (stateAtAction.combat) {
            return reduce(pushActivityLog(stateAtAction, 'Not while in combat.'), { type: 'ui/sfx', kind: 'reject' })
          }
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
        if (isWeapon) {
          const turn = currentTurn(stateAtAction)
          const actorId = turn?.kind === 'pc' ? turn.id : undefined
          const actorOk =
            !stateAtAction.combat ? true
            : turn?.kind !== 'pc' ? false
            : payload.source.kind === 'equipmentSlot' ? payload.source.characterId === actorId
            : true
          if (stateAtAction.combat && !actorOk) {
            return reduce(pushActivityLog(stateAtAction, 'Not your turn.'), { type: 'ui/sfx', kind: 'reject' })
          }
          return reduce(stateAtAction, { type: 'npc/attack', npcId: target.npcId, itemId, actorId })
        }
        return reduce(stateAtAction, { type: 'npc/give', npcId: target.npcId, itemId })
      }

      return stateAtAction
    }
    case 'combat/enter': {
      if (state.combat) return state
      const npcIds = collectEncounterNpcIds(state, action.npcId)
      const entered = enterCombat(state, npcIds)
      return autoResolveNpcTurns(entered)
    }
    case 'combat/advanceTurn': {
      const advanced = advanceTurnIndex(state)
      const progressed = autoResolveNpcTurns(advanced)
      return maybeEndCombat(progressed)
    }
    case 'combat/end': {
      return endCombat(state)
    }
    case 'combat/fleeAttempt': {
      if (!state.combat) return state
      const { state: afterFlee, advanceTurn } = attemptFlee(state)
      let next = ensureDeath(afterFlee)
      if (advanceTurn && next.combat) {
        next = reduce(next, { type: 'combat/advanceTurn' })
      }
      return next
    }
    case 'combat/defend': {
      if (!state.combat) return state
      const turn = currentTurn(state)
      if (!turn || turn.kind !== 'pc') {
        return reduce(pushActivityLog(state, 'Not your turn.'), { type: 'ui/sfx', kind: 'reject' })
      }
      const withDef = defend(state, turn.id)
      return reduce(withDef, { type: 'combat/advanceTurn' })
    }
    case 'combat/clickAttack': {
      if (!state.combat) return state
      const turn = currentTurn(state)
      if (!turn || turn.kind !== 'pc') {
        return reduce(pushActivityLog(state, 'Not your turn.'), { type: 'ui/sfx', kind: 'reject' })
      }
      const npc = state.floor.npcs.find((n) => n.id === action.npcId)
      if (!npc || npc.hp <= 0) return state
      if (!state.combat.participants.npcs.includes(action.npcId)) {
        return reduce(pushActivityLog(state, 'That foe is not in this fight.'), { type: 'ui/sfx', kind: 'reject' })
      }
      const itemId = resolveWeaponItemIdForPcTurn(state, turn.id, CONTENT)
      if (!itemId) {
        return reduce(reduce(state, { type: 'ui/toast', text: 'No weapon available.', ms: 2000 }), { type: 'ui/sfx', kind: 'reject' })
      }
      return reduce(state, { type: 'npc/attack', npcId: action.npcId, itemId, actorId: turn.id })
    }
    case 'npc/attack': {
      const npcIdx = state.floor.npcs.findIndex((n) => n.id === action.npcId)
      const item = state.party.items[action.itemId]
      if (npcIdx < 0 || !item) return state
      if (state.combat) {
        const turn = currentTurn(state)
        if (!turn || turn.kind !== 'pc' || (action.actorId != null && turn.id !== action.actorId)) {
          return reduce(pushActivityLog(state, 'Not your turn.'), { type: 'ui/sfx', kind: 'reject' })
        }
      }
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

      const def = CONTENT.item(item.defId)
      const weapon = def.weapon
      if (!weapon) {
        return reduce(pushActivityLog(state, 'That does not work as a weapon.'), { type: 'ui/sfx', kind: 'reject' })
      }
      if (state.combat) {
        const actor = state.party.chars.find((c) => c.id === (action.actorId as any))
        const cost = Math.max(0, Math.round(Number(weapon.staminaCost ?? 0)))
        if (actor && actor.stamina < cost) {
          const withMsg = pushActivityLog(state, 'Too exhausted to attack.')
          const withSfx = reduce(withMsg, { type: 'ui/sfx', kind: 'reject' })
          return reduce(withSfx, { type: 'combat/advanceTurn' })
        }
      }
      const actorId = state.combat ? ((currentTurn(state)?.kind === 'pc' ? currentTurn(state)!.id : action.actorId) as any) : (action.actorId as any)
      const out =
        actorId != null
          ? computePcAttackDamage({
              state,
              attackerId: actorId as CharacterId,
              defenderNpcId: npc.id,
              weaponBaseDamage: weapon.baseDamage,
              weaponDamageType: weapon.damageType,
              damageStat: weapon.damageStat,
              resolveAttackRoll: Boolean(state.combat),
            })
          : { hit: true, crit: false, finalDmg: weapon.baseDamage }
      if (state.combat) {
        const atkCost = Math.max(0, Math.round(Number(weapon.staminaCost ?? 0)))
        const idx = state.party.chars.findIndex((c) => c.id === actorId)
        if (idx >= 0 && atkCost > 0) {
          const chars = state.party.chars.slice()
          chars[idx] = { ...chars[idx]!, stamina: Math.max(0, chars[idx]!.stamina - atkCost) }
          state = { ...state, party: { ...state.party, chars } }
        }
      }
      if (state.combat && !out.hit) {
        const attacker = actorId != null ? state.party.chars.find((c) => c.id === actorId) : undefined
        const r = out.pcAttackRoll
        let withMsg = state
        if (attacker && r) {
          const p = attacker.stats.perception
          const ag = attacker.stats.agility
          const spd = npcCombatTuning(npc.kind).speed
          const acStr = `10+Spd ${spd}=${r.defense}`
          withMsg = pushActivityLog(
            state,
            `${attacker.name} → ${npc.name}: d20+Per+Agi ${r.d20}+${p}+${ag}=${r.toHit} vs ${acStr} — miss.`,
          )
        } else {
          withMsg = pushActivityLog(state, 'Miss.')
        }
        const withSfx = reduce(withMsg, { type: 'ui/sfx', kind: 'swing' })
        return reduce(withSfx, { type: 'combat/advanceTurn' })
      }
      const finalDmg = out.finalDmg
      const hp = Math.max(0, npc.hp - finalDmg)
      npcs[npcIdx] = { ...npc, hp }
      const died = hp === 0
      let nextState: GameState = { ...state, floor: { ...state.floor, npcs: died ? npcs.filter((n) => n.id !== npc.id) : npcs } }
      if (nextState !== state) {
        nextState = { ...nextState, floor: { ...nextState.floor, floorGeomRevision: nextState.floor.floorGeomRevision + 1 } }
      }

      // Spell-like items are consumed on use.
      if (weapon.consumesOnUse) nextState = consumeItem(nextState, action.itemId)

      // On death, sometimes drop loot to the floor.
      if (died) {
        const lootDef = pickNpcLootDefId(nextState, npc.kind, npc.id)
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
      if (!died && actorId && weapon.statusOnHit?.length) {
        nextState = applyWeaponStatusOnHitFromPc(nextState, npc.id, weapon, actorId as CharacterId)
      }
      let withMsg: GameState
      if (state.combat && actorId != null && out.pcAttackRoll) {
        const attacker = nextState.party.chars.find((c) => c.id === actorId)
        const r = out.pcAttackRoll
        if (attacker) {
          const p = attacker.stats.perception
          const ag = attacker.stats.agility
          const spd = npcCombatTuning(npc.kind).speed
          const acStr = `10+Spd ${spd}=${r.defense}`
          const line =
            `${attacker.name} → ${npc.name}: d20+Per+Agi ${r.d20}+${p}+${ag}=${r.toHit} vs ${acStr} — hit${out.crit ? ' (nat 20)' : ''}, ${finalDmg} dmg.` +
            (died ? ` ${npc.name} dies.` : '')
          withMsg = pushActivityLog(nextState, line)
        } else {
          withMsg = pushActivityLog(nextState, died ? `${npc.name} dies.` : `${npc.name} takes ${finalDmg} dmg.`)
        }
      } else {
        withMsg = pushActivityLog(nextState, died ? `${npc.name} dies.` : `${npc.name} takes ${finalDmg} dmg.`)
      }
      const withHit = reduce(withMsg, { type: 'ui/sfx', kind: 'hit' })
      const withShake = reduce(withHit, { type: 'ui/shake', magnitude: died ? 0.7 : 0.4, ms: died ? 220 : 140 })
      return state.combat ? reduce(withShake, { type: 'combat/advanceTurn' }) : withShake
    }
    case 'npc/give': {
      const npcIdx = state.floor.npcs.findIndex((n) => n.id === action.npcId)
      const item = state.party.items[action.itemId]
      if (npcIdx < 0 || !item) return state
      if (state.combat) {
        const turn = currentTurn(state)
        if (!turn || turn.kind !== 'pc') {
          return reduce(pushActivityLog(state, 'Not your turn.'), { type: 'ui/sfx', kind: 'reject' })
        }
      }
      const npc = state.floor.npcs[npcIdx]
      const quest = npc.quest
      if (!quest) {
        const res = reduce(pushActivityLog(state, `${npc.name} ignores it.`), { type: 'ui/sfx', kind: 'reject' })
        return state.combat ? reduce(res, { type: 'combat/advanceTurn' }) : res
      }
      if (quest.hated.includes(item.defId)) {
        const npcs = state.floor.npcs.slice()
        npcs[npcIdx] = { ...npc, status: 'hostile' }
        const withNpc = { ...state, floor: { ...state.floor, npcs, floorGeomRevision: state.floor.floorGeomRevision + 1 } }
        const res = reduce(pushActivityLog(withNpc, `${npc.name} becomes hostile!`), { type: 'ui/sfx', kind: 'reject' })
        return state.combat ? reduce(res, { type: 'combat/advanceTurn' }) : res
      }
      if (quest.wants === item.defId) {
        // Consume item and improve status.
        const npcs = state.floor.npcs.slice()
        const nextStatus = npc.status === 'hostile' ? 'neutral' : 'friendly'
        npcs[npcIdx] = { ...npc, status: nextStatus }
        const withNpc = { ...state, floor: { ...state.floor, npcs, floorGeomRevision: state.floor.floorGeomRevision + 1 } }
        const withConsume = consumeItem(withNpc, action.itemId)
        const res = reduce(pushActivityLog(withConsume, `${npc.name} accepts it.`), { type: 'ui/sfx', kind: 'pickup' })
        return state.combat ? reduce(res, { type: 'combat/advanceTurn' }) : res
      }
      const res = reduce(pushActivityLog(state, `${npc.name} rejects it.`), { type: 'ui/sfx', kind: 'reject' })
      return state.combat ? reduce(res, { type: 'combat/advanceTurn' }) : res
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

function clampRenderTuning(r: Partial<RenderTuning> & LegacyNpcRenderFlat & Record<string, unknown>): RenderTuning {
  const src = { ...DEFAULT_RENDER, ...r } as RenderTuning & LegacyNpcRenderFlat & Record<string, unknown>
  const npcBillboard = clampNpcBillboardRows(buildNpcBillboardFromInput(src))
  for (const k of LEGACY_NPC_FLAT_KEYS) delete (src as Record<string, unknown>)[k]
  delete (src as Record<string, unknown>).npcBillboard

  const globalIntensity = Math.max(0, Math.min(3, Number(src.globalIntensity ?? 1.0)))
  const clampHue = (v: number) => Math.max(-180, Math.min(180, Number(v)))
  const clampSat = (v: number) => Math.max(0, Math.min(3, Number(v)))
  const themeHueShiftDeg_dungeon_warm = clampHue(src.themeHueShiftDeg_dungeon_warm ?? 0)
  const themeHueShiftDeg_dungeon_cool = clampHue(src.themeHueShiftDeg_dungeon_cool ?? 0)
  const themeHueShiftDeg_cave_damp = clampHue(src.themeHueShiftDeg_cave_damp ?? 0)
  const themeHueShiftDeg_cave_deep = clampHue(src.themeHueShiftDeg_cave_deep ?? 0)
  const themeHueShiftDeg_ruins_bleach = clampHue(src.themeHueShiftDeg_ruins_bleach ?? 0)
  const themeHueShiftDeg_ruins_umber = clampHue(src.themeHueShiftDeg_ruins_umber ?? 0)
  const themeSaturation_dungeon_warm = clampSat(src.themeSaturation_dungeon_warm ?? 1.0)
  const themeSaturation_dungeon_cool = clampSat(src.themeSaturation_dungeon_cool ?? 1.0)
  const themeSaturation_cave_damp = clampSat(src.themeSaturation_cave_damp ?? 1.0)
  const themeSaturation_cave_deep = clampSat(src.themeSaturation_cave_deep ?? 1.0)
  const themeSaturation_ruins_bleach = clampSat(src.themeSaturation_ruins_bleach ?? 1.0)
  const themeSaturation_ruins_umber = clampSat(src.themeSaturation_ruins_umber ?? 1.0)
  const ditherM = Math.round(src.ditherMatrixSize)
  const ditherMatrixSize: RenderTuning['ditherMatrixSize'] = ditherM <= 3 ? 2 : ditherM <= 6 ? 4 : 8
  const p = Math.max(0, Math.min(4, Math.round(src.ditherPalette)))
  const ditherPalette0Mix = Math.max(0, Math.min(1, Number(src.ditherPalette0Mix ?? 1)))
  const postDitherLevels = Math.max(0, Math.min(3, Number(src.postDitherLevels ?? 1.0)))
  const postDitherLift = Math.max(-1, Math.min(1, Number(src.postDitherLift ?? 0.0)))
  const postDitherGamma = Math.max(0.2, Math.min(3, Number(src.postDitherGamma ?? 1.0)))
  const fogEnabled = Number(src.fogEnabled ?? 0) > 0 ? 1 : 0
  const fogDensity = Math.max(0, Math.min(0.3, Number(src.fogDensity ?? 0)))
  const lanternForwardOffset = Math.max(0, Math.min(2, src.lanternForwardOffset))
  const lanternVerticalOffset = Math.max(-1, Math.min(1, src.lanternVerticalOffset))
  const lanternFlickerAmp = Math.max(0, Math.min(1, src.lanternFlickerAmp))
  const lanternFlickerHz = Math.max(0, Math.min(30, src.lanternFlickerHz))
  const baseEmissive = Math.max(0, Math.min(2, src.baseEmissive))
  const camShakePosAmp = Math.max(0, Math.min(0.25, src.camShakePosAmp))
  const camShakeRollDeg = Math.max(0, Math.min(12, src.camShakeRollDeg))
  const camShakeHz = Math.max(0, Math.min(40, src.camShakeHz))
  const camShakeLengthMs = Math.max(0, Math.min(12_000, Math.round(Number(src.camShakeLengthMs ?? 0))))
  const camShakeDecayMs = Math.max(0, Math.min(3000, Math.round(Number(src.camShakeDecayMs ?? 220))))
  const camShakeUiMix = Math.max(0, Math.min(3, src.camShakeUiMix))
  const portraitShakeLengthMs = Math.max(0, Math.min(12_000, Math.round(Number(src.portraitShakeLengthMs ?? camShakeLengthMs))))
  const portraitShakeDecayMs = Math.max(0, Math.min(3000, Math.round(Number(src.portraitShakeDecayMs ?? camShakeDecayMs))))
  const portraitShakeMagnitudeScale = Math.max(0, Math.min(10, Number(src.portraitShakeMagnitudeScale ?? 1)))
  const portraitShakeHz = Math.max(0, Math.min(60, Number(src.portraitShakeHz ?? camShakeHz)))
  let portraitIdleGapMinMs = Math.max(0, Math.min(120_000, Math.round(Number(src.portraitIdleGapMinMs ?? 8000))))
  let portraitIdleGapMaxMs = Math.max(0, Math.min(120_000, Math.round(Number(src.portraitIdleGapMaxMs ?? 18_000))))
  if (portraitIdleGapMaxMs < portraitIdleGapMinMs) portraitIdleGapMaxMs = portraitIdleGapMinMs
  let portraitIdleFlashMinMs = Math.max(0, Math.min(5000, Math.round(Number(src.portraitIdleFlashMinMs ?? 120))))
  let portraitIdleFlashMaxMs = Math.max(0, Math.min(5000, Math.round(Number(src.portraitIdleFlashMaxMs ?? 350))))
  if (portraitIdleFlashMaxMs < portraitIdleFlashMinMs) portraitIdleFlashMaxMs = portraitIdleFlashMinMs
  const portraitMouthFlickerHz = Math.max(0, Math.min(40, Number(src.portraitMouthFlickerHz ?? 18)))
  const portraitMouthFlickerAmount = Math.max(0, Math.min(64, Math.round(Number(src.portraitMouthFlickerAmount ?? 8))))
  const dropRangeCells = Math.max(0, Math.min(20, Math.round(Number(src.dropRangeCells ?? 5))))
  const shadowLanternPoint = Number(src.shadowLanternPoint ?? 0) > 0 ? 1 : 0
  const shadowLanternBeam = Number(src.shadowLanternBeam ?? 0) > 0 ? 1 : 0
  const shadowMapSize = clampShadowMapSize(Number(src.shadowMapSize ?? 256))
  const shadowFilter = Math.max(0, Math.min(2, Math.round(Number(src.shadowFilter ?? 2)))) as RenderTuning['shadowFilter']
  const torchPoiLightMax = Math.max(0, Math.min(6, Math.round(Number(src.torchPoiLightMax ?? 3))))
  const pixelRatioCap = Math.max(1, Math.min(1.5, Number(src.pixelRatioCap ?? 1.5)))
  const rawGpuTier = String(src.gpuTier ?? 'high')
  const gpuTier: GpuTier = (['low', 'balanced', 'high', 'custom'] as const).includes(rawGpuTier as GpuTier)
    ? (rawGpuTier as GpuTier)
    : 'custom'

  const npcFootLift = Math.max(-0.2, Math.min(0.5, Number(src.npcFootLift ?? 0.02)))
  const clampNpcGroundY = (v: number) => Math.max(-0.75, Math.min(1.25, Number(v)))
  const poiGroundY_Well = clampNpcGroundY(src.poiGroundY_Well ?? 0)
  const poiGroundY_Chest = clampNpcGroundY(src.poiGroundY_Chest ?? 0)
  const poiGroundY_Barrel = clampNpcGroundY(src.poiGroundY_Barrel ?? 0)
  const poiGroundY_Crate = clampNpcGroundY(src.poiGroundY_Crate ?? 0)
  const poiGroundY_Bed = clampNpcGroundY(src.poiGroundY_Bed ?? 0)
  const poiGroundY_Shrine = clampNpcGroundY(src.poiGroundY_Shrine ?? 0)
  const poiGroundY_CrackedWall = clampNpcGroundY(src.poiGroundY_CrackedWall ?? 0)
  const poiGroundY_Exit = clampNpcGroundY(src.poiGroundY_Exit ?? 0)
  const poiSpriteBoost = Math.max(0, Math.min(3, Number(src.poiSpriteBoost ?? 1.0)))
  const poiFootLift = Math.max(-0.2, Math.min(0.5, Number(src.poiFootLift ?? 0.02)))
  const hubInnkeeperSpriteScale = Math.max(0.25, Math.min(3, Number(src.hubInnkeeperSpriteScale ?? 1)))
  const doorSpriteHeight = Math.max(0.05, Math.min(3, Number(src.doorSpriteHeight ?? 1)))
  const doorSpriteCenterY = Math.max(0, Math.min(2, Number(src.doorSpriteCenterY ?? 0.55)))
  const doorSpriteNudgeX = Math.max(-0.5, Math.min(0.5, Number(src.doorSpriteNudgeX ?? 0)))
  const doorSpriteNudgeZ = Math.max(-0.5, Math.min(0.5, Number(src.doorSpriteNudgeZ ?? 0)))
  const campEveryFloors = Math.min(99, Math.max(1, Math.round(Number(src.campEveryFloors ?? 10))))
  const { min: npcSpawnCountMin, max: npcSpawnCountMax } = clampNpcSpawnCountRange(
    src.npcSpawnCountMin,
    src.npcSpawnCountMax,
  )
  const combatEncounterJoinChebyshevMax = Math.max(1, Math.min(32, Math.round(Number(src.combatEncounterJoinChebyshevMax ?? 5))))
  return {
    ...src,
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
    shadowLanternBeam,
    shadowMapSize,
    shadowFilter,
    torchPoiLightMax,
    pixelRatioCap,
    gpuTier,

    npcFootLift,
    npcBillboard,
    poiGroundY_Well,
    poiGroundY_Chest,
    poiGroundY_Barrel,
    poiGroundY_Crate,
    poiGroundY_Bed,
    poiGroundY_Shrine,
    poiGroundY_CrackedWall,
    poiGroundY_Exit,
    poiSpriteBoost,
    poiFootLift,
    hubInnkeeperSpriteScale,
    doorSpriteHeight,
    doorSpriteCenterY,
    doorSpriteNudgeX,
    doorSpriteNudgeZ,
    campEveryFloors,
    npcSpawnCountMin,
    npcSpawnCountMax,
    combatEncounterJoinChebyshevMax,
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


function addStatusToChar(state: GameState, characterId: string, statusId: StatusEffectId, durMs?: number) {
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

/** Run hazard gameplay once per visit to a tagged procgen room (not on every tile inside the room). */
function applyRoomHazardAfterStep(state: GameState, x: number, y: number): GameState {
  const room = roomForCell(state, x, y)
  const prop = room?.tags?.roomProperties
  if (!room || !prop) {
    if (state.floor.roomHazardAppliedForRoomId == null) return state
    return { ...state, floor: { ...state.floor, roomHazardAppliedForRoomId: undefined } }
  }
  if (state.floor.roomHazardAppliedForRoomId === room.id) {
    return state
  }
  const afterHazard = applyRoomHazardOnEnter(state, x, y)
  return { ...afterHazard, floor: { ...afterHazard.floor, roomHazardAppliedForRoomId: room.id } }
}

/**
 * After placing the party on a floor (initial load, new run, regen, descend, Exit POI), run hazard
 * gameplay once if the spawn cell sits in a tagged procgen room. Mirrors `applyRoomHazardAfterStep`
 * without requiring a step.
 */
function applySpawnRoomHazardIfNeeded(state: GameState): GameState {
  const { x, y } = state.floor.playerPos
  const room = roomForCell(state, x, y)
  const prop = room?.tags?.roomProperties
  if (!room || !prop) {
    if (state.floor.roomHazardAppliedForRoomId == null) return state
    return { ...state, floor: { ...state.floor, roomHazardAppliedForRoomId: undefined } }
  }
  if (state.floor.roomHazardAppliedForRoomId === room.id) return state
  const afterHazard = applyRoomHazardOnEnter(state, x, y)
  return { ...afterHazard, floor: { ...afterHazard.floor, roomHazardAppliedForRoomId: room.id } }
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

  if (prop === 'SporeMist') {
    let next = state
    for (const c of state.party.chars) next = addStatusToChar(next, c.id, 'Spored', 22_000)
    const roll = (seed % 100) + 1
    if (roll <= 40) {
      const victim = state.party.chars[(seed >>> 4) % Math.max(1, state.party.chars.length)]
      if (victim) next = addStatusToChar(next, victim.id, 'Sick', 24_000)
    }
    next = pushActivityLog(next, 'Spores sting your throat.')
    next = { ...next, ui: { ...next.ui, sfxQueue: q.concat([{ id: `s_${state.nowMs}_${q.length}`, kind: 'reject' }]) } }
    return reduce(next, { type: 'ui/shake', magnitude: 0.2, ms: 100 })
  }

  if (prop === 'NanoHaze') {
    let next = state
    for (const c of state.party.chars) next = addStatusToChar(next, c.id, 'NanoTagged', 25_000)
    next = pushActivityLog(next, 'The air hums with invisible motes.')
    next = { ...next, ui: { ...next.ui, sfxQueue: q.concat([{ id: `s_${state.nowMs}_${q.length}`, kind: 'ui' }]) } }
    return reduce(next, { type: 'ui/shake', magnitude: 0.16, ms: 95 })
  }

  if (prop === 'Unstable') {
    let next = state
    const chars = state.party.chars.map((c) => ({ ...c, hp: Math.max(0, c.hp - 1) }))
    next = { ...state, party: { ...state.party, chars } }
    for (const c of next.party.chars) next = addStatusToChar(next, c.id, 'Frightened', 10_000)
    next = pushActivityLog(next, 'The floor shudders.')
    next = { ...next, ui: { ...next.ui, sfxQueue: q.concat([{ id: `s_${state.nowMs}_${q.length}`, kind: 'hit' }]) } }
    return reduce(next, { type: 'ui/shake', magnitude: 0.35, ms: 140 })
  }

  if (prop === 'Haunted') {
    let next = state
    for (const c of state.party.chars) next = addStatusToChar(next, c.id, 'Frightened', 14_000)
    const hitch = (seed % 100) + 1
    if (hitch <= 18 && state.party.chars.length) {
      const victim = state.party.chars[(seed >>> 12) % state.party.chars.length]!
      next = addStatusToChar(next, victim.id, 'Parasitized', 28_000)
    }
    next = pushActivityLog(next, 'A chill crawls up your spine.')
    next = { ...next, ui: { ...next.ui, sfxQueue: q.concat([{ id: `s_${state.nowMs}_${q.length}`, kind: 'reject' }]) } }
    return reduce(next, { type: 'ui/shake', magnitude: 0.24, ms: 120 })
  }

  if (prop === 'RoyalMiasma') {
    let next = state
    for (const c of state.party.chars) next = addStatusToChar(next, c.id, 'Drowsy', 18_000)
    next = pushActivityLog(next, 'Perfume and decay mingle in the air.')
    next = { ...next, ui: { ...next.ui, sfxQueue: q.concat([{ id: `s_${state.nowMs}_${q.length}`, kind: 'ui' }]) } }
    return reduce(next, { type: 'ui/shake', magnitude: 0.14, ms: 85 })
  }

  return state
}

/** Close NPC dialog (and F2 preview flag) before the player turns, steps, or strafes. */
function dismissNpcDialogOnMovement(state: GameState): GameState {
  if (!state.ui.npcDialogFor && !state.ui.debugShowNpcDialogPopup) return state
  return {
    ...state,
    ui: { ...state.ui, npcDialogFor: undefined, debugShowNpcDialogPopup: false },
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

function ensureDeath(state: GameState): GameState {
  if (state.ui.death) return state
  const wiped = state.party.chars.length > 0 && state.party.chars.every((c) => c.hp <= 0)
  if (!wiped) return state
  const dead: GameState = {
    ...state,
    combat: undefined,
    ui: {
      ...state.ui,
      death: { atMs: state.nowMs, runId: state.run.runId, floorIndex: state.floor.floorIndex, level: state.run.level },
      debugShowDeathPopup: false,
    },
  }
  return pushActivityLog(dead, 'The party has fallen.')
}

function maybeEndCombat(state: GameState): GameState {
  if (!state.combat) return state
  const combat = pruneCombatTurnQueue(state, state.combat)
  const aliveNpc = combat.participants.npcs.some((id) => state.floor.npcs.some((n) => n.id === id && n.hp > 0))
  if (!aliveNpc) {
    const enemyCount = Math.max(1, combat.participants.npcs.length)
    const xp = 10 * enemyCount
    const { state: withXp, leveledUp, gainedLevels } = applyXp({ ...state, combat: undefined }, xp)
    const msg = leveledUp ? `Encounter won. +${xp} XP (level +${gainedLevels}).` : `Encounter won. +${xp} XP.`
    return pushActivityLog(withXp, msg)
  }
  return { ...state, combat }
}

function autoResolveNpcTurns(state: GameState): GameState {
  let st: GameState = state
  st = maybeEndCombat(st)
  if (!st.combat) return st

  // Ensure combat state is pruned before stepping.
  st = { ...st, combat: pruneCombatTurnQueue(st, st.combat) }

  for (let i = 0; i < 32; i++) {
    if (!st.combat) break
    const turn = currentTurn(st)
    if (!turn || turn.kind !== 'npc') break
    st = npcTakeTurn(st, turn.id)
    st = ensureDeath(st)
    if (st.ui.death) break
    st = advanceTurnIndex(st)
    st = maybeEndCombat(st)
  }
  return st
}

function attemptMoveTo(state: GameState, nx: number, ny: number): GameState {
  if (state.view.anim) return state
  const { w, tiles } = state.floor
  const idx = nx + ny * w
  if (idx < 0 || idx >= tiles.length) return bump(state)
  const tile = tiles[idx]
  if (isAnyDoorTile(tile)) {
    return tryOpenDoor(state, idx, tile)
  }
  if (tile !== 'floor' && !isPassableOpenDoorTile(tile)) return bump(state)

  const npc = state.floor.npcs.find((n) => n.pos.x === nx && n.pos.y === ny)
  if (npc?.status === 'hostile') {
    return reduce(state, { type: 'combat/enter', npcId: npc.id })
  }

  if (poiOccupiesCell(state.floor.pois, nx, ny)) {
    return bump(state, 'Something is in the way.')
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
  const withHazard = applyRoomHazardAfterStep(moved, nx, ny)
  return reduce(withHazard, { type: 'ui/sfx', kind: 'step' })
}

function bump(state: GameState, message = 'Solid stone.'): GameState {
  const withMsg = pushActivityLog(state, message)
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

function tryOpenDoor(state: GameState, idx: number, tile: Tile): GameState {
  const openedTile = tileAfterDoorOpens(tile)

  if (isOpenDoorTile(tile)) {
    const tiles = state.floor.tiles.slice()
    tiles[idx] = openedTile
    const next = {
      ...state,
      floor: { ...state.floor, tiles, floorGeomRevision: state.floor.floorGeomRevision + 1 },
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
  tiles[idx] = openedTile
  const opened = {
    ...consumed,
    floor: { ...consumed.floor, tiles, floorGeomRevision: consumed.floor.floorGeomRevision + 1 },
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

