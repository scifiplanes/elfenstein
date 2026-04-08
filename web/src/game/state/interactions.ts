import type { ContentDB } from '../content/contentDb'
import type { GameState, ItemId, StatusEffectId } from '../types'
import { consumeItem } from './inventory'
import { removeStatus } from './status'
import { pushActivityLog } from './activityLog'
import { hpMax, staminaMax } from './runProgression'

export function inspectCharacter(state: GameState, _content: ContentDB, characterId: string, itemId: ItemId): GameState {
  const item = state.party.items[itemId]
  if (!item) return state
  const c = state.party.chars.find((x) => x.id === characterId)
  if (!c) return state
  const tunedMs = Math.max(0, (state.render.portraitShakeLengthMs ?? 0) + (state.render.portraitShakeDecayMs ?? 0))
  const durMs = Math.max(130, tunedMs)
  const nowMs = performance.now()
  return pushActivityLog(
    {
      ...state,
      ui: {
        ...state.ui,
        portraitShake: { characterId, startedAtMs: nowMs, untilMs: nowMs + durMs, magnitude: 0.14 },
      },
    },
    `${c.name} inspects ${item.defId}.`,
  )
}

export function feedCharacter(state: GameState, content: ContentDB, characterId: string, itemId: ItemId): GameState {
  const item = state.party.items[itemId]
  if (!item) return state
  const cIdx = state.party.chars.findIndex((x) => x.id === characterId)
  if (cIdx < 0) return state
  const def = content.item(item.defId)

  const tunedMs = Math.max(0, (state.render.portraitShakeLengthMs ?? 0) + (state.render.portraitShakeDecayMs ?? 0))
  const durMs = Math.max(200, tunedMs)
  const hz = Math.max(0, Number(state.render.portraitMouthFlickerHz ?? 0))
  // Amount is interpreted as number of visible “chomps” (mouth-on pulses), not raw on/off toggles.
  const amount = Math.max(0, Math.round(Number(state.render.portraitMouthFlickerAmount ?? 0)))
  const steps = amount * 2
  const computedBurstMs = hz > 0 && steps > 0 ? Math.round((steps * 1000) / hz) : 0
  // Mouth flicker is rendered at compositor time (not capture-limited), so very short bursts are OK.
  const burstMs = Math.max(90, Math.min(8000, computedBurstMs || 240))
  const nowMs = performance.now()
  const withMouth: GameState = {
    ...state,
    ui: {
      ...state.ui,
      portraitMouth: { characterId, startedAtMs: nowMs, untilMs: nowMs + burstMs },
      portraitShake: { characterId, startedAtMs: nowMs, untilMs: nowMs + durMs, magnitude: 0.2 },
      sfxQueue: (state.ui.sfxQueue ?? []).concat([{ id: `s_${state.nowMs}_${(state.ui.sfxQueue ?? []).length}`, kind: 'ui' }]),
    },
  }

  if (!def.feed) {
    return pushActivityLog(withMouth, 'They refuse to eat that.')
  }

  const chars = state.party.chars.slice()
  const c = chars[cIdx]

  const hungerDelta = def.feed.hunger ?? 0
  const thirstDelta = def.feed.thirst ?? 0
  const staminaDelta = def.feed.stamina ?? 0
  const hpDelta = def.feed.hp ?? 0
  const hm = hpMax(state)
  const sm = staminaMax(state)

  const next = {
    ...c,
    hunger: Math.min(100, c.hunger + hungerDelta),
    thirst: Math.min(100, c.thirst + thirstDelta),
    hp: Math.min(hm, c.hp + hpDelta),
    stamina: Math.min(sm, c.stamina + staminaDelta),
  }
  chars[cIdx] = next

  let nextState: GameState = { ...withMouth, party: { ...state.party, chars } }

  const statusSeed = hashStr(`${state.floor.seed}:${characterId}:${itemId}`)
  if (def.feed.statusChances?.length) {
    for (const sc of def.feed.statusChances) {
      if (sc.onlySpecies && sc.onlySpecies !== next.species) continue
      const roll = (statusSeed % 100) + 1
      if (roll <= sc.pct) nextState = addStatus(nextState, characterId, sc.status)
    }
  }

  // Basic remedies: if the item is tagged as food and has no hunger/thirst impact but is named like a remedy,
  // keep current MVP behavior via statuses in ContentDB (preferred). For now, we use explicit defs.
  if (item.defId === 'BandageStrip') nextState = removeStatus(nextState, characterId, 'Bleeding')
  if (item.defId === 'AntitoxinVial') nextState = removeStatus(nextState, characterId, 'Poisoned')
  if (item.defId === 'HerbPoultice') {
    nextState = removeStatus(nextState, characterId, 'Sick')
    const roll2 = ((statusSeed >>> 8) % 100) + 1
    if (roll2 <= 12) nextState = addStatus(nextState, characterId, 'Drowsy')
  }

  nextState = consumeItem(nextState, itemId)
  const q = nextState.ui.sfxQueue ?? []
  const withSfx: GameState = { ...nextState, ui: { ...nextState.ui, sfxQueue: q.concat([{ id: `s_${state.nowMs}_${q.length}`, kind: 'munch' }]) } }
  return pushActivityLog(withSfx, `${c.name} eats.`)
}

function addStatus(state: GameState, characterId: string, status: StatusEffectId): GameState {
  const idx = state.party.chars.findIndex((c) => c.id === characterId)
  if (idx < 0) return state
  const chars = state.party.chars.slice()
  const c = chars[idx]
  const untilMs =
    status === 'Blessed' ? state.nowMs + 45_000
    : status === 'Drowsy' ? state.nowMs + 18_000
    : state.nowMs + 30_000
  chars[idx] = { ...c, statuses: c.statuses.concat([{ id: status, untilMs }]) }
  return { ...state, party: { ...state.party, chars } }
}

function hashStr(s: string) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

