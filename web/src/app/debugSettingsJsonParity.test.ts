import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_HUB_HOTSPOTS } from '../game/hubHotspotDefaults'
import type { HubHotspotConfig } from '../game/types'
import { DEFAULT_AUDIO, DEFAULT_RENDER } from '../game/tuningDefaults'
import type { DebugUiPersist } from './debugSettingsPersistence'

/** Repo root of the `web` package (where `public/debug-settings.json` lives). */
const webRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** Full `debugUi` object written by Save to project — keep in sync with `DebugUiPersist`. */
const DEBUG_UI_PERSIST_KEYS = [
  'debugBgTrack',
  'procgenDebugOverlay',
  'roomTelegraphMode',
  'roomTelegraphStrength',
  'debugShowNpcDialogPopup',
  'debugShowDeathPopup',
] as const satisfies readonly (keyof DebugUiPersist)[]

type _DebugUiKeysComplete = Exclude<keyof DebugUiPersist, (typeof DEBUG_UI_PERSIST_KEYS)[number]> extends never
  ? true
  : never
const _debugUiKeysComplete: _DebugUiKeysComplete = true
void _debugUiKeysComplete

function expectNormRect(v: unknown): void {
  expect(v && typeof v === 'object').toBe(true)
  const o = v as Record<string, unknown>
  for (const k of ['x', 'y', 'w', 'h'] as const) {
    expect(typeof o[k]).toBe('number')
    expect(Number.isFinite(o[k] as number)).toBe(true)
  }
}

function expectHubHotspotConfigShape(raw: unknown, template: HubHotspotConfig): void {
  expect(raw && typeof raw === 'object').toBe(true)
  const a = raw as HubHotspotConfig
  const topKeys = Object.keys(template).sort()
  expect(Object.keys(a).sort()).toEqual(topKeys)
  for (const section of topKeys as (keyof HubHotspotConfig)[]) {
    expect(a[section] && typeof a[section] === 'object').toBe(true)
    const innerT = template[section]
    const innerA = a[section]
    const innerKeys = Object.keys(innerT).sort()
    expect(Object.keys(innerA).sort()).toEqual(innerKeys)
    for (const spot of innerKeys) {
      expectNormRect((innerA as Record<string, unknown>)[spot])
    }
  }
}

describe('debug-settings.json vs persistence pickers', () => {
  const file = JSON.parse(readFileSync(path.join(webRoot, 'public/debug-settings.json'), 'utf8')) as Record<string, unknown>

  it('top-level sections exist', () => {
    expect(file).toHaveProperty('render')
    expect(file).toHaveProperty('audio')
    expect(file).toHaveProperty('hubHotspots')
    expect(file).toHaveProperty('debugUi')
  })

  it('render keys match DEFAULT_RENDER (pickRenderTuningForPersistence schema)', () => {
    const r = file.render as Record<string, unknown>
    expect(Object.keys(r).sort()).toEqual(Object.keys(DEFAULT_RENDER).sort())
  })

  it('audio keys match DEFAULT_AUDIO (pickAudioTuningForPersistence schema)', () => {
    const a = file.audio as Record<string, unknown>
    expect(Object.keys(a).sort()).toEqual(Object.keys(DEFAULT_AUDIO).sort())
  })

  it('hubHotspots matches HubHotspotConfig shape (same nested keys as DEFAULT_HUB_HOTSPOTS)', () => {
    expectHubHotspotConfigShape(file.hubHotspots, DEFAULT_HUB_HOTSPOTS)
  })

  it('debugUi keys match full Save-to-project snapshot', () => {
    const d = file.debugUi as Record<string, unknown>
    expect(Object.keys(d).sort()).toEqual([...DEBUG_UI_PERSIST_KEYS].sort())
  })
})
