import type { GameState, RunCheckpoint } from '../game/types'

const LOCAL_KEY = 'elfenstein.runCheckpoint'
const ENVELOPE_VERSION = 1 as const

type EnvelopeV1 = { v: typeof ENVELOPE_VERSION; checkpoint: RunCheckpoint }

function getLocalStorage(): Storage | null {
  try {
    if (typeof globalThis.localStorage === 'undefined') return null
    return globalThis.localStorage
  } catch {
    return null
  }
}

function isUiScreen(v: unknown): v is GameState['ui']['screen'] {
  return v === 'title' || v === 'hub' || v === 'game'
}

function isValidRunCheckpoint(v: unknown): v is RunCheckpoint {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  if (o.kind !== 'well') return false
  if (typeof o.savedAtMs !== 'number' || !Number.isFinite(o.savedAtMs)) return false
  const snap = o.snapshot
  if (!snap || typeof snap !== 'object') return false
  const s = snap as Record<string, unknown>
  if (typeof s.atMs !== 'number' || !Number.isFinite(s.atMs)) return false
  if (!s.run || typeof s.run !== 'object') return false
  if (!s.floor || typeof s.floor !== 'object') return false
  const floor = s.floor as Record<string, unknown>
  if (typeof floor.w !== 'number' || typeof floor.h !== 'number') return false
  if (!Array.isArray(floor.tiles)) return false
  if (!s.party || typeof s.party !== 'object') return false
  const party = s.party as Record<string, unknown>
  if (!Array.isArray(party.chars)) return false
  if (!party.inventory || typeof party.inventory !== 'object') return false
  if (!party.items || typeof party.items !== 'object') return false
  if (!s.view || typeof s.view !== 'object') return false
  if (!s.ui || typeof s.ui !== 'object') return false
  const ui = s.ui as Record<string, unknown>
  if (!isUiScreen(ui.screen)) return false
  return true
}

function parseEnvelope(raw: unknown): RunCheckpoint | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.v !== ENVELOPE_VERSION) return null
  if (!isValidRunCheckpoint(o.checkpoint)) return null
  return o.checkpoint
}

/** Parse stored JSON (for tests and tooling). */
export function parseRunCheckpointJson(json: string): RunCheckpoint | null {
  try {
    return parseEnvelope(JSON.parse(json) as unknown)
  } catch {
    return null
  }
}

export function loadRunCheckpoint(): RunCheckpoint | null {
  const storage = getLocalStorage()
  if (!storage) return null
  let raw: string | null
  try {
    raw = storage.getItem(LOCAL_KEY)
  } catch {
    return null
  }
  if (raw == null || raw === '') return null
  return parseRunCheckpointJson(raw)
}

export function saveRunCheckpoint(cp: RunCheckpoint): void {
  const storage = getLocalStorage()
  if (!storage) return
  const envelope: EnvelopeV1 = { v: ENVELOPE_VERSION, checkpoint: cp }
  try {
    storage.setItem(LOCAL_KEY, JSON.stringify(envelope))
  } catch {
    if (import.meta.env.DEV) console.warn('[runCheckpointPersistence] save failed')
  }
}

export function clearRunCheckpoint(): void {
  const storage = getLocalStorage()
  if (!storage) return
  try {
    storage.removeItem(LOCAL_KEY)
  } catch {
    if (import.meta.env.DEV) console.warn('[runCheckpointPersistence] clear failed')
  }
}

export function mergePersistedCheckpoint(state: GameState): GameState {
  const persisted = loadRunCheckpoint()
  if (!persisted) return state
  return {
    ...state,
    run: { ...state.run, checkpoint: persisted },
  }
}
