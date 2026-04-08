import type { AudioTuning, RenderTuning } from '../game/types'

export type DebugSettingsFile = {
  render?: Partial<RenderTuning>
  audio?: Partial<AudioTuning>
}

const LOCAL_KEY = 'elfenstein.debugSettings'

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
    }
  } catch {
    return null
  }
}

export function saveDebugSettingsToLocal(render: RenderTuning, audio: AudioTuning): void {
  try {
    const data: DebugSettingsFile = { render, audio }
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
  } catch {
    // ignore (storage disabled/quota/etc.)
  }
}

/** Writes `web/public/debug-settings.json` when the Vite dev server is running. */
export async function saveDebugSettingsToProject(render: RenderTuning, audio: AudioTuning): Promise<void> {
  if (!import.meta.env.DEV) return
  try {
    const res = await fetch('/__debug_settings/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ render, audio }),
    })
    if (!res.ok) console.warn('[debug-settings] save failed:', res.status)
  } catch (e) {
    console.warn('[debug-settings] save error:', e)
  }
}
