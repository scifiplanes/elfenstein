import type { ContentDB, ItemDef } from '../content/contentDb'
import type { Character, GameState, ItemDefId, ItemId, StatusEffectId } from '../types'
import { consumeItem } from './inventory'
import { removeStatus } from './status'
import { pushActivityLog } from './activityLog'
import { hpMax, staminaMax } from './runProgression'

export function inspectCharacter(state: GameState, content: ContentDB, characterId: string, itemId: ItemId): GameState {
  const item = state.party.items[itemId]
  if (!item) return state
  const c = state.party.chars.find((x) => x.id === characterId)
  if (!c) return state
  const def = content.item(item.defId)
  const perception = c.stats.perception
  const seed = hashStr(`${state.floor.seed}:inspect:${characterId}:${itemId}:${item.defId}`)
  const d20 = (seed % 20) + 1 // 1..20, deterministic (matches crafting roll style)
  const total = d20 + perception
  const dc = inspectDcForItem(def)
  const success = total >= dc
  const great = total >= dc + 5

  const tunedMs = Math.max(0, (state.render.portraitShakeLengthMs ?? 0) + (state.render.portraitShakeDecayMs ?? 0))
  const durMs = Math.max(130, tunedMs)
  const nowMs = performance.now()
  let next: GameState = {
    ...state,
    ui: {
      ...state.ui,
      portraitShake: { characterId, startedAtMs: nowMs, untilMs: nowMs + durMs, magnitude: 0.14 },
    },
  }

  next = pushActivityLog(next, `${c.name} inspects ${def.name}.`)
  next = pushActivityLog(next, `Perception: ${d20} + ${perception} = ${total} vs DC ${dc}.`)

  if (!success) {
    return pushActivityLog(next, `Nothing more stands out to ${c.name}.`)
  }

  next = pushActivityLog(next, buildInspectSuccessLine(state, def, c))
  if (great) {
    for (const line of buildInspectGreatLines(content, def)) {
      next = pushActivityLog(next, line)
    }
  }
  return next
}

/** DC from item tags (hardest applicable). */
function inspectDcForItem(def: ItemDef): number {
  let dc = 12
  const tags = def.tags
  if (tags.includes('quest')) dc = Math.max(dc, 14)
  if (tags.includes('weapon') || tags.includes('tool') || tags.includes('hat')) dc = Math.max(dc, 12)
  if (tags.includes('container')) dc = Math.max(dc, 11)
  if (tags.includes('food') || tags.includes('material')) dc = Math.max(dc, 10)
  return dc
}

function hasActiveStatus(c: Character, state: GameState, id: StatusEffectId): boolean {
  return c.statuses.some((s) => s.id === id && (s.untilMs == null || s.untilMs > state.nowMs))
}

function remedyHint(defId: ItemDefId, c: Character, state: GameState): string | null {
  if (defId === 'BandageStrip' && hasActiveStatus(c, state, 'Bleeding')) return 'This could help with your bleeding.'
  if (defId === 'AntitoxinVial' && hasActiveStatus(c, state, 'Poisoned')) return 'This could help with your poisoning.'
  if (defId === 'HerbPoultice' && hasActiveStatus(c, state, 'Sick')) return 'This could help with your sickness.'
  if (defId === 'Salt' && (hasActiveStatus(c, state, 'Spored') || hasActiveStatus(c, state, 'Parasitized')))
    return 'This might calm the irritation.'
  if (defId === 'Moss' && hasActiveStatus(c, state, 'NanoTagged')) return 'This might draw the haze out of you.'
  if (defId === 'AntitoxinVial' && hasActiveStatus(c, state, 'Parasitized')) return 'This could help with parasites.'
  if (defId === 'CoolingPoultice' && hasActiveStatus(c, state, 'Burning')) return 'This could help with the burning.'
  if (defId === 'DryWrap' && hasActiveStatus(c, state, 'Drenched')) return 'This could help you dry off.'
  return null
}

function speciesFeedHint(def: ItemDef, c: Character): string | null {
  if (!def.feed?.statusChances?.length) return null
  for (const sc of def.feed.statusChances) {
    if (sc.onlySpecies === c.species) {
      return `Effects may differ for this species (${c.species} affinity).`
    }
  }
  return null
}

function buildInspectSuccessLine(state: GameState, def: ItemDef, c: Character): string {
  const classification = classifyItemShort(def)
  const remedy = remedyHint(def.id, c, state)
  const species = speciesFeedHint(def, c)
  const hint = remedy ?? species
  if (hint) return `${classification} ${hint}`
  return classification
}

function classifyItemShort(def: ItemDef): string {
  const tags = def.tags
  if (tags.includes('weapon') && def.weapon) {
    const hand = tags.includes('twoHand') ? 'Two-handed' : 'One-handed'
    return `${hand} ${def.weapon.damageType.toLowerCase()} weapon (~${def.weapon.baseDamage} base damage).`
  }
  if (tags.includes('hat')) return 'Headwear.'
  if (tags.includes('food') && def.feed) return 'Looks edible.'
  if (tags.includes('quest')) return 'Something quest-related or symbolic.'
  if (tags.includes('container')) return 'A container.'
  if (tags.includes('tool')) return 'A tool.'
  if (tags.includes('material')) return 'Craftable material.'
  return 'A potentially useful item.'
}

function buildInspectGreatLines(content: ContentDB, def: ItemDef): string[] {
  const lines: string[] = []
  if (def.feed) {
    const f = def.feed
    const bits: string[] = []
    if (f.hunger) bits.push(`hunger +${f.hunger}`)
    if (f.thirst) bits.push(`thirst +${f.thirst}`)
    if (f.stamina) bits.push(`stamina +${f.stamina}`)
    if (f.hp) bits.push(`HP +${f.hp}`)
    const eat = bits.length ? `If eaten: ${bits.join(', ')}` : ''
    let sc = ''
    if (f.statusChances?.length) {
      const scParts = f.statusChances.map((scx) => {
        const species = scx.onlySpecies ? ` (${scx.onlySpecies} only)` : ''
        const stName = content.status(scx.status).name
        return `${stName} ${scx.pct}%${species}`
      })
      sc = `Possible effects when eaten: ${scParts.join('; ')}`
    }
    const feedLine = [eat, sc].filter(Boolean).join('. ')
    if (feedLine) lines.push(feedLine.endsWith('.') ? feedLine : `${feedLine}.`)
  }

  const mechBits: string[] = []
  if (def.weapon) {
    const w = def.weapon
    mechBits.push(`${w.baseDamage} ${w.damageType} damage${w.consumesOnUse ? ', consumed on use' : ''}`)
  }
  if (def.equipSlots?.length) mechBits.push(`equips to ${def.equipSlots.join(', ')}`)
  if (def.useOnPoi && Object.keys(def.useOnPoi).length) {
    const parts = Object.entries(def.useOnPoi).map(([k, v]) => {
      const bits: string[] = []
      if (v.transformTo) bits.push(`→ ${v.transformTo}`)
      if (v.consumeOffering) bits.push('consumes offering')
      if (v.blessPartyMs != null && v.blessPartyMs > 0) bits.push(`party Blessed ~${Math.round(v.blessPartyMs / 1000)}s`)
      const t = bits.length ? `: ${bits.join('; ')}` : ''
      return `${k}${t}`
    })
    mechBits.push(`POI: ${parts.join('; ')}`)
  }
  if (mechBits.length) lines.push(mechBits.join('; ') + '.')

  if (!lines.length) lines.push('No further mechanical details stand out.')
  return lines.slice(0, 2)
}

export function feedCharacter(state: GameState, content: ContentDB, characterId: string, itemId: ItemId): GameState {
  const item = state.party.items[itemId]
  if (!item) return state
  const cIdx = state.party.chars.findIndex((x) => x.id === characterId)
  if (cIdx < 0) return state
  const def = content.item(item.defId)

  if (!def.feed) {
    const tunedMs = Math.max(0, (state.render.portraitShakeLengthMs ?? 0) + (state.render.portraitShakeDecayMs ?? 0))
    const durMs = Math.max(200, tunedMs)
    const min = state.render.portraitIdleFlashMinMs
    const max = state.render.portraitIdleFlashMaxMs
    const span = Math.max(0, max - min)
    const ms = Math.round(min + Math.random() * span)
    const nowMs = performance.now()
    const q = state.ui.sfxQueue ?? []
    const withRefuse: GameState = {
      ...state,
      ui: {
        ...state.ui,
        portraitIdlePulse: { characterId, untilMs: nowMs + ms },
        portraitShake: { characterId, startedAtMs: nowMs, untilMs: nowMs + durMs, magnitude: 0.2 },
        sfxQueue: q.concat([{ id: `s_${state.nowMs}_${q.length}`, kind: 'reject' }]),
      },
    }
    return pushActivityLog(withRefuse, 'They refuse to eat that.')
  }

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
  if (item.defId === 'Salt') {
    nextState = removeStatus(nextState, characterId, 'Spored')
    nextState = removeStatus(nextState, characterId, 'Parasitized')
  }
  if (item.defId === 'Moss') nextState = removeStatus(nextState, characterId, 'NanoTagged')
  if (item.defId === 'AntitoxinVial') nextState = removeStatus(nextState, characterId, 'Parasitized')
  if (item.defId === 'CoolingPoultice') nextState = removeStatus(nextState, characterId, 'Burning')
  if (item.defId === 'DryWrap') nextState = removeStatus(nextState, characterId, 'Drenched')

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

