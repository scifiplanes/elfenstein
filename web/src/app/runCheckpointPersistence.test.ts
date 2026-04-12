import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RunCheckpoint } from '../game/types'
import {
  clearRunCheckpoint,
  loadRunCheckpoint,
  parseRunCheckpointJson,
  saveRunCheckpoint,
} from './runCheckpointPersistence'

function minimalValidEnvelope(): string {
  return JSON.stringify({
    v: 1,
    checkpoint: {
      kind: 'well',
      savedAtMs: 99,
      snapshot: {
        atMs: 88,
        run: {
          runId: 'run_test',
          startedAtMs: 1,
          xp: 0,
          level: 1,
          perkHistory: [],
          bonuses: { hpMaxBonus: 0, staminaMaxBonus: 0, damageBonusPct: 0 },
        },
        floor: {
          w: 2,
          h: 2,
          tiles: ['floor', 'floor', 'floor', 'floor'],
        },
        party: {
          chars: [],
          inventory: { cols: 1, rows: 1, slots: [null] },
          items: {},
        },
        view: { camPos: { x: 0, y: 0, z: 0 }, camYaw: 0 },
        ui: { screen: 'game' },
      },
    },
  })
}

describe('parseRunCheckpointJson', () => {
  it('returns checkpoint for v1 envelope', () => {
    const cp = parseRunCheckpointJson(minimalValidEnvelope())
    expect(cp).not.toBeNull()
    expect(cp!.kind).toBe('well')
    expect(cp!.savedAtMs).toBe(99)
    expect(cp!.snapshot.ui.screen).toBe('game')
  })

  it('returns null for wrong envelope version', () => {
    const raw = JSON.stringify({
      v: 0,
      checkpoint: JSON.parse(minimalValidEnvelope()).checkpoint,
    })
    expect(parseRunCheckpointJson(raw)).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(parseRunCheckpointJson('not json')).toBeNull()
  })

  it('returns null when checkpoint kind is not well', () => {
    const o = JSON.parse(minimalValidEnvelope()) as { v: number; checkpoint: RunCheckpoint }
    o.checkpoint.kind = 'other' as RunCheckpoint['kind']
    expect(parseRunCheckpointJson(JSON.stringify(o))).toBeNull()
  })

  it('returns null when floor.tiles is missing', () => {
    const o = JSON.parse(minimalValidEnvelope()) as {
      checkpoint: { snapshot: { floor: Record<string, unknown> } }
    }
    delete o.checkpoint.snapshot.floor.tiles
    expect(parseRunCheckpointJson(JSON.stringify(o))).toBeNull()
  })

  it('returns null when ui.screen is invalid', () => {
    const o = JSON.parse(minimalValidEnvelope()) as {
      checkpoint: { snapshot: { ui: { screen: string } } }
    }
    o.checkpoint.snapshot.ui.screen = 'lobby'
    expect(parseRunCheckpointJson(JSON.stringify(o))).toBeNull()
  })
})

describe('localStorage round-trip', () => {
  const mem: Record<string, string> = {}

  beforeAll(() => {
    vi.stubGlobal(
      'localStorage',
      {
        getItem: (k: string) => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null),
        setItem: (k: string, v: string) => {
          mem[k] = v
        },
        removeItem: (k: string) => {
          delete mem[k]
        },
        clear: () => {
          for (const k of Object.keys(mem)) delete mem[k]
        },
        get length() {
          return Object.keys(mem).length
        },
        key: (i: number) => Object.keys(mem)[i] ?? null,
      } as Storage,
    )
  })

  beforeEach(() => {
    for (const k of Object.keys(mem)) delete mem[k]
  })

  it('save then load restores checkpoint', () => {
    const parsed = parseRunCheckpointJson(minimalValidEnvelope())!
    saveRunCheckpoint(parsed)
    const again = loadRunCheckpoint()
    expect(again).toEqual(parsed)
  })

  it('clearRunCheckpoint removes stored value', () => {
    const parsed = parseRunCheckpointJson(minimalValidEnvelope())!
    saveRunCheckpoint(parsed)
    expect(loadRunCheckpoint()).not.toBeNull()
    clearRunCheckpoint()
    expect(loadRunCheckpoint()).toBeNull()
  })
})
