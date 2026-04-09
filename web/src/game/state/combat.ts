import type { Character, CharacterId, CombatState, CombatTurn, DamageType, GameState, Id, StatusEffectId } from '../types'
import { pushActivityLog } from './activityLog'
import { addStatus } from './status'
import { roomForCell } from './roomGeometry'

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

export function npcCombatTuning(
  kind: GameState['floor']['npcs'][number]['kind'],
): { speed: number; baseDamage: number; damageType: DamageType; statusOnHit?: Array<{ status: StatusEffectId; pct: number; durationMs?: number }> } {
  switch (kind) {
    case 'Swarm':
      return { speed: 8, baseDamage: 4, damageType: 'Pierce', statusOnHit: [{ status: 'Poisoned', pct: 12, durationMs: 18_000 }] }
    case 'Skeleton':
      return { speed: 5, baseDamage: 7, damageType: 'Cut' }
    case 'Catoctopus':
      return { speed: 6, baseDamage: 6, damageType: 'Blunt' }
    case 'Wurglepup':
      return { speed: 7, baseDamage: 5, damageType: 'Cut' }
    case 'Bobr':
    default:
      return { speed: 4, baseDamage: 6, damageType: 'Blunt' }
  }
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

export function attemptFlee(state: GameState): GameState {
  const combat = state.combat
  if (!combat) return state

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

  if (!pc || !npc) return state

  // Stamina cost (MVP): fleeing is costly; if too exhausted, reject but do not consume a turn.
  const fleeCost = 8
  if (pc.stamina < fleeCost) {
    let next = pushActivityLog(state, 'Too exhausted to flee.')
    next = pushSfx(next, 'reject')
    return next
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
    return pushSfx(withMsg, 'ui')
  }

  let next = pushActivityLog(state, 'You fail to flee!')
  // Free hit: use the fastest living NPC in the encounter.
  const fastest = livingNpcs.sort((a, b) => npcCombatTuning(b.kind).speed - npcCombatTuning(a.kind).speed || a.id.localeCompare(b.id))[0]!
  next = npcTakeTurn(next, fastest.id)
  const c = next.combat
  if (c) {
    next = { ...next, combat: { ...c, lastAction: { actorKind: 'pc', actorId: pc.id, action: 'flee', atMs: next.nowMs } } }
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

export function computePcAttackDamage(args: { state: GameState; attackerId: CharacterId; defenderNpcId: Id; weaponBaseDamage: number }): { hit: boolean; crit: boolean; finalDmg: number } {
  const { state, attackerId, defenderNpcId, weaponBaseDamage } = args
  const attacker = state.party.chars.find((c) => c.id === attackerId)
  if (!attacker) return { hit: true, crit: false, finalDmg: weaponBaseDamage }
  const roll = resolvePcAttackRoll({ state, attacker, defenderNpcId })
  if (!roll.hit) return { hit: false, crit: roll.crit, finalDmg: 0 }
  const dmgBonus = Math.max(0, Number(state.run?.bonuses.damageBonusPct ?? 0))
  const base = Math.max(1, Math.round(weaponBaseDamage * (1 + dmgBonus)))
  const finalDmg = Math.max(1, Math.round(base * (roll.crit ? 1.5 : 1)))
  return { hit: true, crit: roll.crit, finalDmg }
}

export function npcTakeTurn(state: GameState, npcId: Id): GameState {
  const npc = state.floor.npcs.find((n) => n.id === npcId)
  if (!npc || npc.hp <= 0) return state

  const living = state.party.chars.filter((c) => c.hp > 0)
  if (!living.length) return state

  let target = living[0]!
  for (const c of living) {
    if (c.hp < target.hp) target = c
    else if (c.hp === target.hp && c.id < target.id) target = c
  }

  const combat = state.combat
  const tuned = npcCombatTuning(npc.kind)
  const dmgType = tuned.damageType
  const def = defenseForPc(state, target.id as any)
  const armor = def?.armor ?? Math.max(0, target.armor ?? 0)
  const resistBonusPct = def?.resistBonusPct ?? 0
  const resist = Math.max(0, Math.min(0.95, Number(target.resistances?.[dmgType] ?? 0) + resistBonusPct))
  const isPhysical = dmgType === 'Blunt' || dmgType === 'Pierce' || dmgType === 'Cut'
  const mitigated = isPhysical ? Math.max(0, tuned.baseDamage - armor) : tuned.baseDamage
  const d20 = combat ? rollD20(state, combat.encounterId, `npcHit:${npc.id}:${target.id}:${combat.turnIndex}`) : 20
  const toHit = d20 + tuned.speed
  const defense = 10 + target.stats.speed
  const hit = toHit >= defense
  const crit = d20 === 20
  const final = hit ? Math.max(1, Math.round(mitigated * (1 - resist) * (crit ? 1.5 : 1))) : 0

  const chars = state.party.chars.slice()
  const idx = chars.findIndex((c) => c.id === target.id)
  if (idx < 0) return state
  chars[idx] = { ...chars[idx], hp: Math.max(0, chars[idx].hp - final) }

  let next: GameState = { ...state, party: { ...state.party, chars } }
  if (!hit) {
    next = pushActivityLog(next, `${npc.name} misses ${target.name}.`)
    next = pushSfx(next, 'reject')
    return next
  }
  next = pushActivityLog(next, crit ? `${npc.name} crits ${target.name} for ${final}.` : `${npc.name} hits ${target.name} for ${final}.`)
  next = pushSfx(next, 'hit')
  next = applyUiShake(next, crit ? 0.55 : 0.35, crit ? 180 : 140)
  if (tuned.statusOnHit?.length && state.combat) {
    for (const sh of tuned.statusOnHit) {
      const seed = hashStr(`${state.floor.seed}:${state.combat.encounterId}:${npc.id}:${target.id}:${sh.status}:${state.combat.turnIndex}`)
      const roll = (seed % 100) + 1
      if (roll <= sh.pct) {
        const untilMs = sh.durationMs != null ? state.nowMs + Math.max(0, Math.round(sh.durationMs)) : undefined
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
  const nextCombat: CombatState = {
    ...pruned,
    turnIndex: nextIndex,
    pcDefense: pcDefense && Object.keys(pcDefense).length ? pcDefense : {},
  }
  return { ...state, combat: nextCombat }
}

