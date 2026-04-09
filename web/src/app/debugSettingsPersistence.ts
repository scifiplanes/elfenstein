import type { HubHotspotPatch } from '../game/hubHotspotDefaults'
import type { AudioTuning, HubHotspotConfig, HubNormRect, RenderTuning } from '../game/types'

export type DebugSettingsFile = {
  render?: Partial<RenderTuning>
  audio?: Partial<AudioTuning>
  hubHotspots?: HubHotspotPatch
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
    }
  } catch {
    return null
  }
}

export function saveDebugSettingsToLocal(render: RenderTuning, audio: AudioTuning, hubHotspots: HubHotspotConfig): void {
  try {
    const data: DebugSettingsFile & { hubHotspots: HubHotspotConfig } = { render, audio, hubHotspots }
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
  } catch {
    // ignore (storage disabled/quota/etc.)
  }
}

/** Writes `web/public/debug-settings.json` when the Vite dev server is running. */
export async function saveDebugSettingsToProject(
  render: RenderTuning,
  audio: AudioTuning,
  hubHotspots: HubHotspotConfig,
): Promise<void> {
  if (!import.meta.env.DEV) return
  try {
    const res = await fetch('/__debug_settings/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ render, audio, hubHotspots }),
    })
    if (!res.ok) console.warn('[debug-settings] save failed:', res.status)
  } catch (e) {
    console.warn('[debug-settings] save error:', e)
  }
}
