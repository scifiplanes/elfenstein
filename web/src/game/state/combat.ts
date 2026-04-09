import type { Character, CharacterId, CombatState, CombatTurn, DamageType, GameState, Id, Resistances, StatusEffectId } from '../types'
import { ContentDB } from '../content/contentDb'
import { npcCombatTuningFromContent } from '../content/npcCombat'
import { npcQuestEnglishLine } from '../npc/npcQuestSpeech'
import { pushActivityLog } from './activityLog'
import { addStatus, addStatusToNpc } from './status'
import { roomForCell } from './roomGeometry'

const COMBAT_CONTENT = ContentDB.createDefault()

/** Chance per NPC turn (deterministic roll) to echo quest text in the activity log. */
export const QUEST_SHOUT_CHANCE_PCT = 20

/** For tests: same roll as `npcTakeTurn` quest shout. */
export function questShoutRollMod100(
  floorSeed: number,
  encounterId: string,
  npcId: string,
  turnIndex: number,
): number {
  return hashStr(`${floorSeed}:${encounterId}:questShout:${npcId}:${turnIndex}`) % 100
}

function hashStr(s: string) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function tieBreak01(state: GameState, encounterId: Id, participantKey: string) {
  const h = hashStr(`${state.floor.seed}:${encounterId}:${participantKey}`)
  return ((h % 10_000) + 0.5) / 10_000 // (0, 1)
}

function rollD20(state: GameState, encounterId: Id, key: string): number {
  const h = hashStr(`${state.floor.seed}:${encounterId}:${key}`)
  return (h % 20) + 1
}

export function npcCombatTuning(kind: GameState['floor']['npcs'][number]['kind']): {
  speed: number
  baseDamage: number
  damageType: DamageType
  /** Flat subtraction after base damage, for Blunt/Pierce/Cut hits from PCs only. */
  armor: number
  resistances: Resistances
  statusOnHit?: Array<{ status: StatusEffectId; pct: number; durationMs?: number }>
} {
  return npcCombatTuningFromContent(kind)
}

export function makeCombatEncounterId(state: GameState, primaryNpcId: Id) {
  return `enc_${state.floor.seed}_${primaryNpcId}_${Math.floor(state.nowMs)}`
}

function partyHasItemDefInInventory(state: GameState, defId: string): boolean {
  for (const slot of state.party.inventory.slots) {
    if (!slot) continue
    if (state.party.items[slot]?.defId === defId) return true
  }
  return false
}

function hostileJoinsEncounter(state: GameState, npc: GameState['floor']['npcs'][number]): boolean {
  if (npc.hp <= 0) return false
  if (npc.status !== 'hostile') return false
  if (npc.kind === 'Swarm' && partyHasItemDefInInventory(state, 'SwarmQueen')) return false
  return true
}

/** Hostiles in the same procgen room as the primary NPC, or Chebyshev-adjacent to the player if no room. */
export function collectEncounterNpcIds(state: GameState, primaryNpcId: Id): Id[] {
  const primary = state.floor.npcs.find((n) => n.id === primaryNpcId)
  if (!primary || !hostileJoinsEncounter(state, primary)) return []

  const room = roomForCell(state, primary.pos.x, primary.pos.y)
  const px = state.floor.playerPos.x
  const py = state.floor.playerPos.y
  const ids = new Set<Id>([primary.id])

  if (room) {
    for (const n of state.floor.npcs) {
      if (!hostileJoinsEncounter(state, n)) continue
      if (roomForCell(state, n.pos.x, n.pos.y) === room) ids.add(n.id)
    }
  } else {
    for (const n of state.floor.npcs) {
      if (!hostileJoinsEncounter(state, n)) continue
      const dx = Math.abs(n.pos.x - px)
      const dy = Math.abs(n.pos.y - py)
      if (Math.max(dx, dy) <= 1) ids.add(n.id)
    }
  }

  return [...ids].sort((a, b) => a.localeCompare(b))
}

export function buildEncounterTurnQueue(state: GameState, encounterId: Id, partyIds: Id[], npcIds: Id[]): CombatTurn[] {
  const turns: CombatTurn[] = []
  for (const id of partyIds) {
    const c = state.party.chars.find((x) => x.id === id)
    if (!c || c.hp <= 0) continue
    const base = c.stats.speed
    const init = base + tieBreak01(state, encounterId, `pc:${id}`)
    turns.push({ kind: 'pc', id: id as any, initiative: init })
  }
  for (const id of npcIds) {
    const npc = state.floor.npcs.find((n) => n.id === id)
    if (!npc || npc.hp <= 0) continue
    const base = npcCombatTuning(npc.kind).speed
    const init = base + tieBreak01(state, encounterId, `npc:${id}`)
    turns.push({ kind: 'npc', id: id as any, initiative: init })
  }
  turns.sort((a, b) => b.initiative - a.initiative)
  return turns
}

export function enterCombat(state: GameState, npcIdsIn: Id[]): GameState {
  const npcIds: Id[] = []
  for (const id of npcIdsIn) {
    const npc = state.floor.npcs.find((n) => n.id === id)
    if (!npc || !hostileJoinsEncounter(state, npc)) continue
    npcIds.push(id)
  }
  const unique = [...new Set(npcIds)]
  if (!unique.length) return state

  const primaryId = unique[0]!
  const encounterId = makeCombatEncounterId(state, primaryId)
  const partyIds = state.party.chars.filter((c) => c.hp > 0).map((c) => c.id)
  const turnQueue = buildEncounterTurnQueue(state, encounterId, partyIds, unique)
  if (!turnQueue.length) return state

  const combat: CombatState = {
    encounterId,
    startedAtMs: state.nowMs,
    participants: { party: partyIds, npcs: unique },
    turnQueue,
    turnIndex: 0,
    pcDefense: {},
  }
  const names = unique.map((id) => state.floor.npcs.find((n) => n.id === id)?.name ?? '?').join(', ')
  return pushActivityLog({ ...state, combat }, `Encounter: ${names}.`)
}

export function currentTurn(state: GameState): CombatTurn | undefined {
  const c = state.combat
  if (!c || !c.turnQueue.length) return undefined
  const idx = ((c.turnIndex % c.turnQueue.length) + c.turnQueue.length) % c.turnQueue.length
  return c.turnQueue[idx]
}

export function pruneCombatTurnQueue(state: GameState, combat: CombatState): CombatState {
  const livingPc = new Set(state.party.chars.filter((c) => c.hp > 0).map((c) => c.id))
  const livingNpc = new Set(state.floor.npcs.filter((n) => n.hp > 0).map((n) => n.id))
  const nextQueue = combat.turnQueue.filter((t) => (t.kind === 'pc' ? livingPc.has(t.id) : livingNpc.has(t.id)))
  const nextIndex = nextQueue.length ? Math.min(combat.turnIndex, nextQueue.length - 1) : 0
  return { ...combat, turnQueue: nextQueue, turnIndex: nextIndex }
}

export function endCombat(state: GameState): GameState {
  if (!state.combat) return state
  return { ...state, combat: undefined }
}

function pushSfx(state: GameState, kind: NonNullable<GameState['ui']['sfxQueue']>[number]['kind']): GameState {
  const q = state.ui.sfxQueue ?? []
  const id = `s_${state.nowMs}_${q.length}`
  return { ...state, ui: { ...state.ui, sfxQueue: q.concat([{ id, kind }]) } }
}

function applyUiShake(state: GameState, magnitude: number, ms: number) {
  const startedAtMs = state.nowMs
  const untilMs = startedAtMs + Math.max(0, ms)
  return { ...state, ui: { ...state.ui, shake: { startedAtMs, untilMs, magnitude } } }
}

function defenseForPc(state: GameState, pcId: CharacterId) {
  const c = state.party.chars.find((x) => x.id === pcId)
  if (!c) return null
  const def = state.combat?.pcDefense?.[pcId]
  const armorBonus = def?.armorBonus ?? 0
  const resistBonusPct = def?.resistBonusPct ?? 0
  return { armor: Math.max(0, (c.armor ?? 0) + armorBonus), resistBonusPct: Math.max(0, resistBonusPct) }
}

export function applyCombatFireshield(
  state: GameState,
  pcId: CharacterId,
  shield: { fireResistBonusPct: number; shieldTurns: number },
): GameState {
  const combat = state.combat
  if (!combat) return state
  const pcFireshield = { ...(combat.pcFireshield ?? {}) }
  pcFireshield[pcId] = {
    fireResistBonusPct: shield.fireResistBonusPct,
    turnsRemaining: shield.shieldTurns,
  }
  return { ...state, combat: { ...combat, pcFireshield } }
}

export function defend(state: GameState, pcId: CharacterId): GameState {
  if (!state.combat) return state
  const combat = state.combat
  const cost = 4
  const idx = state.party.chars.findIndex((c) => c.id === pcId)
  if (idx < 0) return state
  const pc = state.party.chars[idx]!
  if (pc.stamina < cost) {
    let next = pushActivityLog(state, 'Too exhausted to defend.')
    next = pushSfx(next, 'reject')
    return next
  }
  {
    const chars = state.party.chars.slice()
    chars[idx] = { ...pc, stamina: Math.max(0, pc.stamina - cost) }
    state = { ...state, party: { ...state.party, chars } }
  }
  const pcDefense = { ...(combat.pcDefense ?? {}) }
  pcDefense[pcId] = { armorBonus: 2, resistBonusPct: 0.08 }
  const nextCombat: CombatState = { ...combat, pcDefense, lastAction: { actorKind: 'pc', actorId: pcId, action: 'defend', atMs: state.nowMs } }
  return pushActivityLog({ ...state, combat: nextCombat }, `${state.party.chars.find((c) => c.id === pcId)?.name ?? 'PC'} defends.`)
}

export type AttemptFleeResult = { state: GameState; /** Paid stamina and failed roll: caller should advance initiative. */ advanceTurn: boolean }

export function attemptFlee(state: GameState): AttemptFleeResult {
  const combat = state.combat
  if (!combat) return { state, advanceTurn: false }

  const turn = currentTurn(state)
  const livingPcs = state.party.chars.filter((c) => c.hp > 0)
  const pc =
    turn?.kind === 'pc' ? state.party.chars.find((c) => c.id === turn.id && c.hp > 0) ?? null
    : livingPcs.sort((a, b) => b.stats.speed - a.stats.speed || a.id.localeCompare(b.id))[0] ?? null

  const livingNpcs = combat.participants.npcs
    .map((id) => state.floor.npcs.find((n) => n.id === id))
    .filter((n): n is NonNullable<typeof n> => Boolean(n && n.hp > 0))

  const npc =
    turn?.kind === 'npc' ? state.floor.npcs.find((n) => n.id === turn.id && n.hp > 0) ?? null
    : livingNpcs.sort((a, b) => npcCombatTuning(b.kind).speed - npcCombatTuning(a.kind).speed || a.id.localeCompare(b.id))[0] ?? null

  if (!pc || !npc) return { state, advanceTurn: false }

  // Stamina cost (MVP): fleeing is costly; if too exhausted, reject but do not consume a turn.
  const fleeCost = 8
  if (pc.stamina < fleeCost) {
    let next = pushActivityLog(state, 'Too exhausted to flee.')
    next = pushSfx(next, 'reject')
    return { state: next, advanceTurn: false }
  }
  {
    const chars = state.party.chars.slice()
    const idx = chars.findIndex((c) => c.id === pc.id)
    if (idx >= 0) {
      chars[idx] = { ...chars[idx], stamina: Math.max(0, chars[idx].stamina - fleeCost) }
      state = { ...state, party: { ...state.party, chars } }
    }
  }

  const pcSpeed = pc.stats.speed
  const npcSpeed = npcCombatTuning(npc.kind).speed
  const d20 = rollD20(state, combat.encounterId, `flee:${combat.turnIndex}:${Math.floor(state.nowMs / 333)}`)
  const margin = pcSpeed - npcSpeed
  const success = d20 + margin >= 11

  if (success) {
    const ended = endCombat(state)
    const withMsg = pushActivityLog(ended, 'You flee.')
    return { state: pushSfx(withMsg, 'ui'), advanceTurn: false }
  }

  let next = pushActivityLog(state, 'You fail to flee!')
  // Free hit: use the fastest living NPC in the encounter.
  const fastest = livingNpcs.sort((a, b) => npcCombatTuning(b.kind).speed - npcCombatTuning(a.kind).speed || a.id.localeCompare(b.id))[0]!
  next = npcTakeTurn(next, fastest.id)
  const c = next.combat
  if (c) {
    next = { ...next, combat: { ...c, lastAction: { actorKind: 'pc', actorId: pc.id, action: 'flee', atMs: next.nowMs } } }
  }
  return { state: next, advanceTurn: true }
}

/** Deterministic weapon proc rolls vs NPCs (combat or open world). */
export function applyWeaponStatusOnHitFromPc(
  state: GameState,
  defenderNpcId: Id,
  weapon: { statusOnHit?: Array<{ status: StatusEffectId; pct: number; durationMs?: number }> },
  attackerId: CharacterId,
): GameState {
  const list = weapon.statusOnHit
  if (!list?.length) return state
  const combat = state.combat
  const npc = state.floor.npcs.find((n) => n.id === defenderNpcId)
  if (!npc || npc.hp <= 0) return state
  let next = state
  const turnPart = combat != null ? String(combat.turnIndex) : `oc_${Math.floor(state.nowMs)}`
  for (const sh of list) {
    const seed = hashStr(`${state.floor.seed}:${combat?.encounterId ?? 'open'}:${attackerId}:${defenderNpcId}:${sh.status}:${turnPart}`)
    const roll = (seed % 100) + 1
    if (roll <= sh.pct) {
      const untilMs = sh.durationMs != null ? state.nowMs + Math.max(0, Math.round(sh.durationMs)) : undefined
      next = addStatusToNpc(next, defenderNpcId, sh.status, untilMs)
      const name = next.floor.npcs.find((n) => n.id === defenderNpcId)?.name ?? 'Foe'
      next = pushActivityLog(next, `${name} is ${sh.status}.`)
    }
  }
  return next
}

export function resolvePcAttackRoll(args: { state: GameState; attacker: Character; defenderNpcId: Id }): { hit: boolean; crit: boolean; d20: number; toHit: number; defense: number } {
  const { state, attacker } = args
  const combat = state.combat
  const npc = state.floor.npcs.find((n) => n.id === args.defenderNpcId)
  if (!combat || !npc) return { hit: true, crit: false, d20: 20, toHit: 20, defense: 0 }

  const d20 = rollD20(state, combat.encounterId, `hit:${attacker.id}:${npc.id}:${combat.turnIndex}`)
  const toHit = d20 + attacker.stats.perception + attacker.stats.agility
  const defense = 10 + npcCombatTuning(npc.kind).speed
  const hit = toHit >= defense
  const crit = d20 === 20
  return { hit, crit, d20, toHit, defense }
}

export type PcAttackRollSummary = { d20: number; toHit: number; defense: number; crit: boolean }

export function computePcAttackDamage(args: {
  state: GameState
  attackerId: CharacterId
  defenderNpcId: Id
  weaponBaseDamage: number
  weaponDamageType: DamageType
  damageStat?: 'strength' | 'agility'
  /** Encounter: roll vs NPC defense. Open world: auto-hit (still apply mitigation). */
  resolveAttackRoll: boolean
}): { hit: boolean; crit: boolean; finalDmg: number; pcAttackRoll?: PcAttackRollSummary } {
  const { state, attackerId, defenderNpcId, weaponBaseDamage, weaponDamageType, damageStat, resolveAttackRoll } = args
  const attacker = state.party.chars.find((c) => c.id === attackerId)
  const npc = state.floor.npcs.find((n) => n.id === defenderNpcId)
  if (!attacker || !npc) return { hit: true, crit: false, finalDmg: Math.max(1, weaponBaseDamage) }

  let crit = false
  let pcAttackRoll: PcAttackRollSummary | undefined
  if (resolveAttackRoll) {
    const roll = resolvePcAttackRoll({ state, attacker, defenderNpcId })
    pcAttackRoll = { d20: roll.d20, toHit: roll.toHit, defense: roll.defense, crit: roll.crit }
    if (!roll.hit) return { hit: false, crit: roll.crit, finalDmg: 0, pcAttackRoll }
    crit = roll.crit
  }

  const statPts = damageStat === 'strength' ? attacker.stats.strength : damageStat === 'agility' ? attacker.stats.agility : 0
  const statBonus = damageStat ? Math.floor(statPts * 0.25) : 0
  const rawWeapon = weaponBaseDamage + statBonus
  const dmgBonus = Math.max(0, Number(state.run?.bonuses.damageBonusPct ?? 0))
  const afterRunPct = Math.max(1, Math.round(rawWeapon * (1 + dmgBonus)))

  const tuned = npcCombatTuning(npc.kind)
  const isPhysical = weaponDamageType === 'Blunt' || weaponDamageType === 'Pierce' || weaponDamageType === 'Cut'
  const mitigated = isPhysical ? Math.max(0, afterRunPct - tuned.armor) : afterRunPct
  const resist = Math.max(0, Math.min(0.95, Number(tuned.resistances?.[weaponDamageType] ?? 0)))
  const finalDmg = Math.max(1, Math.round(mitigated * (1 - resist) * (crit ? 1.5 : 1)))
  return { hit: true, crit, finalDmg, pcAttackRoll }
}

export function npcTakeTurn(state: GameState, npcId: Id): GameState {
  const npc = state.floor.npcs.find((n) => n.id === npcId)
  if (!npc || npc.hp <= 0) return state

  const living = state.party.chars.filter((c) => c.hp > 0)
  if (!living.length) return state

  const combat = state.combat
  const encId = combat?.encounterId ?? 'open'
  const softness = (c: Character) => {
    const defendBias = combat?.pcDefense?.[c.id] ? 8 : 0
    return c.hp + defendBias + tieBreak01(state, encId, `npcTar:${npc.id}:${c.id}`) * 0.001
  }
  let target = living[0]!
  let bestS = softness(target)
  for (let i = 1; i < living.length; i++) {
    const c = living[i]!
    const s = softness(c)
    if (s < bestS || (s === bestS && c.id < target.id)) {
      target = c
      bestS = s
    }
  }

  let st = state
  if (combat) {
    const english = npcQuestEnglishLine(npc, (id) => COMBAT_CONTENT.item(id).name)
    if (english != null && questShoutRollMod100(st.floor.seed, combat.encounterId, npc.id, combat.turnIndex) < QUEST_SHOUT_CHANCE_PCT) {
      st = pushActivityLog(st, `${npc.name}: "${english}"`)
    }
  }

  const tuned = npcCombatTuning(npc.kind)
  const dmgType = tuned.damageType
  const def = defenseForPc(st, target.id as any)
  const armor = def?.armor ?? Math.max(0, target.armor ?? 0)
  const resistBonusPct = def?.resistBonusPct ?? 0
  const shieldFire =
    dmgType === 'Fire' && combat?.pcFireshield?.[target.id]?.fireResistBonusPct != null
      ? combat.pcFireshield[target.id]!.fireResistBonusPct
      : 0
  const resist = Math.max(
    0,
    Math.min(0.95, Number(target.resistances?.[dmgType] ?? 0) + resistBonusPct + shieldFire),
  )
  const isPhysical = dmgType === 'Blunt' || dmgType === 'Pierce' || dmgType === 'Cut'
  const mitigated = isPhysical ? Math.max(0, tuned.baseDamage - armor) : tuned.baseDamage
  const d20 = combat != null ? rollD20(st, combat.encounterId, `npcHit:${npc.id}:${target.id}:${combat.turnIndex}`) : 20
  const toHit = d20 + tuned.speed
  const defense = 10 + target.stats.speed
  const hit = toHit >= defense
  const crit = d20 === 20
  const final = hit ? Math.max(1, Math.round(mitigated * (1 - resist) * (crit ? 1.5 : 1))) : 0

  const chars = st.party.chars.slice()
  const idx = chars.findIndex((c) => c.id === target.id)
  if (idx < 0) return st
  chars[idx] = { ...chars[idx], hp: Math.max(0, chars[idx].hp - final) }

  let next: GameState = { ...st, party: { ...st.party, chars } }
  const npcAtk = `d20+Spd ${d20}+${tuned.speed}=${toHit}`
  const pcAc = `10+Spd ${target.stats.speed}=${defense}`
  if (!hit) {
    next = pushActivityLog(next, `${npc.name} → ${target.name}: ${npcAtk} vs ${pcAc} — miss.`)
    next = pushSfx(next, 'swing')
    return next
  }
  next = pushActivityLog(
    next,
    `${npc.name} → ${target.name}: ${npcAtk} vs ${pcAc} — hit${crit ? ' (nat 20)' : ''}, ${final} dmg.`,
  )
  next = pushSfx(next, 'hit')
  next = applyUiShake(next, crit ? 0.55 : 0.35, crit ? 180 : 140)
  if (tuned.statusOnHit?.length && st.combat) {
    for (const sh of tuned.statusOnHit) {
      const seed = hashStr(`${st.floor.seed}:${st.combat!.encounterId}:${npc.id}:${target.id}:${sh.status}:${st.combat!.turnIndex}`)
      const roll = (seed % 100) + 1
      if (roll <= sh.pct) {
        const untilMs = sh.durationMs != null ? st.nowMs + Math.max(0, Math.round(sh.durationMs)) : undefined
        next = addStatus(next, target.id, sh.status, untilMs)
        next = pushActivityLog(next, `${target.name} is ${sh.status}.`)
      }
    }
  }
  return next
}

export function advanceTurnIndex(state: GameState): GameState {
  const combat = state.combat
  if (!combat) return state
  const pruned = pruneCombatTurnQueue(state, combat)
  if (!pruned.turnQueue.length) return { ...state, combat: undefined }
  const nextIndex = (pruned.turnIndex + 1) % pruned.turnQueue.length
  const nextActor = pruned.turnQueue[nextIndex]
  let pcDefense = pruned.pcDefense ? { ...pruned.pcDefense } : undefined
  if (pcDefense && nextActor?.kind === 'pc') {
    const { [nextActor.id]: _cleared, ...rest } = pcDefense
    pcDefense = Object.keys(rest).length ? rest : {}
  }
  let pcFireshield: CombatState['pcFireshield'] = pruned.pcFireshield ? { ...pruned.pcFireshield } : undefined
  if (pcFireshield && nextActor?.kind === 'pc') {
    const id = nextActor.id
    const cur = pcFireshield[id]
    if (cur) {
      const tr = cur.turnsRemaining - 1
      if (tr <= 0) {
        const { [id]: _drop, ...rest } = pcFireshield
        pcFireshield = Object.keys(rest).length ? rest : undefined
      } else {
        pcFireshield = { ...pcFireshield, [id]: { ...cur, turnsRemaining: tr } }
      }
    }
  }
  const nextCombat: CombatState = {
    ...pruned,
    turnIndex: nextIndex,
    pcDefense: pcDefense && Object.keys(pcDefense).length ? pcDefense : {},
    pcFireshield: pcFireshield != null && Object.keys(pcFireshield).length > 0 ? pcFireshield : undefined,
  }
  return { ...state, combat: nextCombat }
}

