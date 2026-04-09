import type { HubHotspotPatch } from '../game/hubHotspotDefaults'
import type {
  AudioTuning,
  HubHotspotConfig,
  HubNormRect,
  ProcgenDebugOverlayMode,
  RenderTuning,
  RoomTelegraphMode,
} from '../game/types'

const PROC_OVERLAY_MODES: ProcgenDebugOverlayMode[] = ['districts', 'roomTags', 'mission']

const ROOM_TELEGRAPH_MODES: RoomTelegraphMode[] = ['auto', 'off', 'Burning', 'Flooded', 'Infected']

export type DebugUiPersist = {
  /** `null` in JSON clears the BGM override. */
  debugBgTrack?: string | null
  /** `null` clears procgen overlay. */
  procgenDebugOverlay?: ProcgenDebugOverlayMode | null
  roomTelegraphMode?: RoomTelegraphMode
  roomTelegraphStrength?: number
  debugShowNpcDialogPopup?: boolean
  debugShowDeathPopup?: boolean
}

export type DebugSettingsFile = {
  render?: Partial<RenderTuning>
  audio?: Partial<AudioTuning>
  hubHotspots?: HubHotspotPatch
  debugUi?: DebugUiPersist
}

const LOCAL_KEY = 'elfenstein.debugSettings'

function parseNormRect(v: unknown): Partial<HubNormRect> | undefined {
  if (!v || typeof v !== 'object') return undefined
  const o = v as Record<string, unknown>
  const out: Partial<HubNormRect> = {}
  for (const k of ['x', 'y', 'w', 'h'] as const) {
    const n = o[k]
    if (typeof n === 'number' && Number.isFinite(n)) out[k] = n
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function parseHubHotspotsPatch(raw: unknown): HubHotspotPatch | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const village = o.village && typeof o.village === 'object' ? (o.village as Record<string, unknown>) : null
  const tavern = o.tavern && typeof o.tavern === 'object' ? (o.tavern as Record<string, unknown>) : null
  const patch: HubHotspotPatch = {}
  if (village) {
    const tavernR = parseNormRect(village.tavern)
    const caveR = parseNormRect(village.cave)
    if (tavernR || caveR) {
      patch.village = {}
      if (tavernR) patch.village.tavern = tavernR
      if (caveR) patch.village.cave = caveR
    }
  }
  if (tavern) {
    const inn = parseNormRect(tavern.innkeeper)
    const exit = parseNormRect(tavern.exit)
    if (inn || exit) {
      patch.tavern = {}
      if (inn) patch.tavern.innkeeper = inn
      if (exit) patch.tavern.exit = exit
    }
  }
  return patch.village || patch.tavern ? patch : undefined
}

export function parseDebugUiPersist(raw: unknown): DebugUiPersist | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const out: DebugUiPersist = {}
  if ('debugBgTrack' in o) {
    if (o.debugBgTrack === null) out.debugBgTrack = null
    else if (typeof o.debugBgTrack === 'string') out.debugBgTrack = o.debugBgTrack
  }
  if ('procgenDebugOverlay' in o) {
    if (o.procgenDebugOverlay === null) out.procgenDebugOverlay = null
    else if (typeof o.procgenDebugOverlay === 'string' && PROC_OVERLAY_MODES.includes(o.procgenDebugOverlay as ProcgenDebugOverlayMode))
      out.procgenDebugOverlay = o.procgenDebugOverlay as ProcgenDebugOverlayMode
  }
  if ('roomTelegraphMode' in o && typeof o.roomTelegraphMode === 'string') {
    const m = o.roomTelegraphMode as RoomTelegraphMode
    if (ROOM_TELEGRAPH_MODES.includes(m)) out.roomTelegraphMode = m
  }
  if ('roomTelegraphStrength' in o && typeof o.roomTelegraphStrength === 'number' && Number.isFinite(o.roomTelegraphStrength)) {
    out.roomTelegraphStrength = Math.max(0, Math.min(1, o.roomTelegraphStrength))
  }
  if ('debugShowNpcDialogPopup' in o && typeof o.debugShowNpcDialogPopup === 'boolean') {
    out.debugShowNpcDialogPopup = o.debugShowNpcDialogPopup
  }
  if ('debugShowDeathPopup' in o && typeof o.debugShowDeathPopup === 'boolean') {
    out.debugShowDeathPopup = o.debugShowDeathPopup
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export async function loadDebugSettingsFromProject(): Promise<DebugSettingsFile | null> {
  try {
    const res = await fetch(`/debug-settings.json?${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const j: unknown = await res.json()
    if (!j || typeof j !== 'object') return null
    const o = j as Record<string, unknown>
    return {
      render: o.render && typeof o.render === 'object' ? (o.render as Partial<RenderTuning>) : undefined,
      audio: o.audio && typeof o.audio === 'object' ? (o.audio as Partial<AudioTuning>) : undefined,
      hubHotspots: parseHubHotspotsPatch(o.hubHotspots),
      debugUi: parseDebugUiPersist(o.debugUi),
    }
  } catch {
    return null
  }
}

export function loadDebugSettingsFromLocal(): DebugSettingsFile | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return null
    const j: unknown = JSON.parse(raw) as unknown
    if (!j || typeof j !== 'object') return null
    const o = j as Record<string, unknown>
    return {
      render: o.render && typeof o.render === 'object' ? (o.render as Partial<RenderTuning>) : undefined,
      audio: o.audio && typeof o.audio === 'object' ? (o.audio as Partial<AudioTuning>) : undefined,
      hubHotspots: parseHubHotspotsPatch(o.hubHotspots),
      debugUi: parseDebugUiPersist(o.debugUi),
    }
  } catch {
    return null
  }
}

export function buildDebugUiPersist(ui: {
  debugBgTrack?: string
  procgenDebugOverlay?: ProcgenDebugOverlayMode
  roomTelegraphMode: RoomTelegraphMode
  roomTelegraphStrength: number
  debugShowNpcDialogPopup?: boolean
  debugShowDeathPopup?: boolean
}): DebugUiPersist {
  return {
    debugBgTrack: ui.debugBgTrack ?? null,
    procgenDebugOverlay: ui.procgenDebugOverlay ?? null,
    roomTelegraphMode: ui.roomTelegraphMode,
    roomTelegraphStrength: ui.roomTelegraphStrength,
    debugShowNpcDialogPopup: !!ui.debugShowNpcDialogPopup,
    debugShowDeathPopup: !!ui.debugShowDeathPopup,
  }
}

export function saveDebugSettingsToLocal(
  render: RenderTuning,
  audio: AudioTuning,
  hubHotspots: HubHotspotConfig,
  debugUi: DebugUiPersist,
): void {
  try {
    const data: DebugSettingsFile & { hubHotspots: HubHotspotConfig } = { render, audio, hubHotspots, debugUi }
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
  } catch {
    // ignore (storage disabled/quota/etc.)
  }
}

export function clearLocalDebugSettings(): void {
  try {
    localStorage.removeItem(LOCAL_KEY)
  } catch {
    // ignore
  }
}

/** Writes `web/public/debug-settings.json` when the Vite dev server is running. Returns whether the write succeeded. */
export async function saveDebugSettingsToProject(
  render: RenderTuning,
  audio: AudioTuning,
  hubHotspots: HubHotspotConfig,
  debugUi: DebugUiPersist,
): Promise<boolean> {
  if (!import.meta.env.DEV) return false
  try {
    const res = await fetch('/__debug_settings/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ render, audio, hubHotspots, debugUi }),
    })
    if (!res.ok) {
      console.warn('[debug-settings] save failed:', res.status)
      const text = await res.text().catch(() => '')
      if (text) console.warn('[debug-settings] save body:', text)
      return false
    }
    return true
  } catch (e) {
    console.warn('[debug-settings] save error:', e)
    return false
  }
}
