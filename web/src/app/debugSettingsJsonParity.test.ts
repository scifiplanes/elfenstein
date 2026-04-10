import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_AUDIO, DEFAULT_RENDER } from '../game/tuningDefaults'

/** Repo root of the `web` package (where `public/debug-settings.json` lives). */
const webRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')

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
})
