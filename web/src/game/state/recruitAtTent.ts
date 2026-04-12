import type { ContentDB } from '../content/contentDb'
import type { Character, CharacterId, EquipmentSlot, GameState, Species } from '../types'
import { pushActivityLog } from './activityLog'
import { unequipItem } from './equipment'
import { hpMax, staminaMax } from './runProgression'
import { tentReplacementPortraitSaturateMultFromHash } from './tentReplacementPortraitTint'

const SPECIES_ORDER: readonly Species[] = ['Igor', 'Mycyclops', 'Frosch', 'Afonso']
const RECRUIT_NAMES = [
  'Gonkalo',
  'Hnat',
  'Talker',
  'Candidate',
  'Big Thought',
  'Cutie',
  'Bobblin',
] as const

function hashStr(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Stats cloned from initial party templates (`initialState.ts`). */
function bodyForSpecies(species: Species): Omit<Character, 'id' | 'name' | 'hp' | 'stamina' | 'statuses' | 'equipment'> {
  switch (species) {
    case 'Igor':
      return {
        species,
        endurance: 6,
        stats: {
          strength: 8,
          agility: 5,
          speed: 5,
          perception: 5,
          endurance: 6,
          intelligence: 4,
          wisdom: 4,
          luck: 5,
        },
        armor: 1,
        resistances: { Cut: 0.05 },
        skills: { chipping: 2, foraging: 1 },
        hunger: 60,
        thirst: 60,
      }
    case 'Mycyclops':
      return {
        species,
        endurance: 7,
        stats: {
          strength: 6,
          agility: 4,
          speed: 4,
          perception: 6,
          endurance: 7,
          intelligence: 6,
          wisdom: 6,
          luck: 4,
        },
        armor: 0,
        resistances: { Earth: 0.1, Fire: 0.05 },
        skills: { cooking: 1, foraging: 2 },
        hunger: 60,
        thirst: 60,
      }
    case 'Frosch':
      return {
        species,
        endurance: 5,
        stats: {
          strength: 5,
          agility: 7,
          speed: 7,
          perception: 5,
          endurance: 5,
          intelligence: 4,
          wisdom: 4,
          luck: 6,
        },
        armor: 0,
        resistances: { Water: 0.15 },
        skills: { weaving: 1, cooking: 2 },
        hunger: 60,
        thirst: 60,
      }
    case 'Afonso':
      return {
        species,
        endurance: 6,
        stats: {
          strength: 6,
          agility: 6,
          speed: 6,
          perception: 6,
          endurance: 6,
          intelligence: 6,
          wisdom: 5,
          luck: 5,
        },
        armor: 0,
        resistances: { Thunder: 0.05 },
        skills: { chipping: 1, weaving: 1 },
        hunger: 60,
        thirst: 60,
      }
  }
}

const EQUIP_ORDER: EquipmentSlot[] = ['head', 'clothing', 'feet', 'accessory', 'handLeft', 'handRight']

function stripCharacterEquipment(state: GameState, characterId: CharacterId, content: ContentDB): GameState {
  let s = state
  for (let guard = 0; guard < 24; guard++) {
    const c = s.party.chars.find((x) => x.id === characterId)
    if (!c) return s
    const hasAny = EQUIP_ORDER.some((sl) => c.equipment[sl])
    if (!hasAny) return s

    let progressed = false
    for (const sl of EQUIP_ORDER) {
      if (!c.equipment[sl]) continue
      const next = unequipItem(s, characterId, sl)
      if (next !== s) {
        s = next
        progressed = true
        break
      }
    }
    if (progressed) continue

    const c2 = s.party.chars.find((x) => x.id === characterId)
    if (!c2) return s
    const sl = EQUIP_ORDER.find((x) => c2.equipment[x])
    if (!sl) return s
    const itemId = c2.equipment[sl]!
    const item = s.party.items[itemId]
    const defName = item ? content.item(item.defId).name : 'gear'
    const chars = s.party.chars.slice()
    const ci = chars.findIndex((x) => x.id === characterId)
    const ch = chars[ci]!
    const eq = { ...ch.equipment }
    const left = eq.handLeft
    const right = eq.handRight
    if (left && right && left === right) {
      delete eq.handLeft
      delete eq.handRight
    } else {
      delete eq[sl]
    }
    chars[ci] = { ...ch, equipment: eq }
    const { [itemId]: _drop, ...items } = s.party.items
    s = { ...s, party: { ...s.party, chars, items } }
    s = pushActivityLog(s, `No room in packs; ${defName} was left at the tent.`)
  }
  return s
}

/** Re-roll portrait hue + saturation for every character that already has `tentReplacementPortraitHueDeg` (F2 debug). */
export function regenerateTentPortraitHues(state: GameState): GameState {
  if (!state.party.chars.some((c) => c.tentReplacementPortraitHueDeg !== undefined)) {
    return state
  }
  const rev = (state.run.debugTentPortraitHueRevision ?? 0) + 1
  const chars = state.party.chars.map((c) => {
    if (c.tentReplacementPortraitHueDeg === undefined) return c
    const h = hashStr(`${state.run.runId}:tentPortraitRegen:${c.id}:${rev}`)
    const sat = tentReplacementPortraitSaturateMultFromHash(
      hashStr(`${state.run.runId}:tentPortraitRegenSat:${c.id}:${rev}`),
    )
    return { ...c, tentReplacementPortraitHueDeg: h % 360, tentReplacementPortraitSaturateMult: sat }
  })
  return {
    ...state,
    party: { ...state.party, chars },
    run: { ...state.run, debugTentPortraitHueRevision: rev },
  }
}

/** F2 debug: strip all party gear (tent rules), then rebuild each slot as a tent-style recruit; preserves `id` and order; does not advance `tentRecruitsCompleted`. */
export function debugReplaceAllPartyWithTentTemplates(state: GameState, content: ContentDB): GameState {
  let s = state
  for (const c of s.party.chars) {
    s = stripCharacterEquipment(s, c.id as CharacterId, content)
  }
  const rev = (s.run.debugReplaceAllPartyRevision ?? 0) + 1
  const hm = hpMax(s)
  const sm = staminaMax(s)
  const chars = s.party.chars.map((c, i) => {
    const h = hashStr(`${s.run.runId}:debugAllParty:${rev}:${c.id}:${i}`)
    const species = SPECIES_ORDER[h % SPECIES_ORDER.length]!
    const name = RECRUIT_NAMES[h % RECRUIT_NAMES.length]!
    const portraitHue = hashStr(`${s.run.runId}:debugAllPartyHue:${rev}:${c.id}:${i}`) % 360
    const portraitSat = tentReplacementPortraitSaturateMultFromHash(
      hashStr(`${s.run.runId}:debugAllPartySat:${rev}:${c.id}:${i}`),
    )
    const body = bodyForSpecies(species)
    return {
      ...body,
      id: c.id,
      name,
      hp: hm,
      stamina: sm,
      statuses: [] as Character['statuses'],
      equipment: {},
      tentReplacementPortraitHueDeg: portraitHue,
      tentReplacementPortraitSaturateMult: portraitSat,
    }
  })
  s = {
    ...s,
    party: { ...s.party, chars },
    run: { ...s.run, debugReplaceAllPartyRevision: rev },
  }
  return pushActivityLog(s, 'Debug: party replaced with tent templates.')
}

export function recruitAtTent(state: GameState, content: ContentDB): GameState {
  if (state.ui.screen !== 'hub' || state.ui.hubScene !== 'village') return state

  const deadIdx = state.party.chars.findIndex((c) => c.hp <= 0)
  if (deadIdx < 0) return state

  const deadId = state.party.chars[deadIdx]!.id as CharacterId
  let s = stripCharacterEquipment(state, deadId, content)

  const seq = (s.run.tentRecruitsCompleted ?? 0) + 1
  const h = hashStr(`${s.run.runId}:tent:${seq}`)
  const portraitHue = hashStr(`${s.run.runId}:tentPortraitHue:${seq}`) % 360
  const portraitSat = tentReplacementPortraitSaturateMultFromHash(hashStr(`${s.run.runId}:tentPortraitSat:${seq}`))
  const species = SPECIES_ORDER[h % SPECIES_ORDER.length]!
  const name = RECRUIT_NAMES[h % RECRUIT_NAMES.length]!
  const body = bodyForSpecies(species)
  const hm = hpMax(s)
  const sm = staminaMax(s)

  const chars = s.party.chars.slice()
  chars[deadIdx] = {
    ...body,
    id: deadId,
    name,
    hp: hm,
    stamina: sm,
    statuses: [],
    equipment: {},
    tentReplacementPortraitHueDeg: portraitHue,
    tentReplacementPortraitSaturateMult: portraitSat,
  }

  s = {
    ...s,
    party: { ...s.party, chars },
    run: { ...s.run, tentRecruitsCompleted: seq },
  }
  return pushActivityLog(s, `${name} joins the party from the tent.`)
}
