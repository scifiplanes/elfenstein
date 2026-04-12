/** Encounter combat lines for `ui.activityLog`: thematic by default; full roll math when F2 debug is open. */

export function composeCombatLogLine(args: { debugOpen: boolean; thematic: string; legacy: string }): string {
  if (!args.debugOpen) return args.thematic
  return `${args.thematic} — ${args.legacy}`
}

export function npcAttackPcLegacyFormula(args: {
  npcName: string
  targetName: string
  d20: number
  npcSpeed: number
  toHit: number
  defense: number
  /** Raw PC Speed stat (shown when it exceeds the AC cap). */
  speedStat: number
  /** `min(speedStat, defenseSpeedCap)` used in `10 + x` for AC vs NPC hits. */
  speedForAc: number
  defenseSpeedCap: number
  statusAcMods: string[]
  hit: boolean
  crit: boolean
  finalDmg: number
}): string {
  const {
    npcName,
    targetName,
    d20,
    npcSpeed,
    toHit,
    defense,
    speedStat,
    speedForAc,
    defenseSpeedCap,
    statusAcMods,
    hit,
    crit,
    finalDmg,
  } = args
  const npcAtk = `d20+Spd ${d20}+${npcSpeed}=${toHit}`
  const baseAc = 10 + speedForAc
  let pcAc = `AC ${defense} (10+min(Spd,${defenseSpeedCap})=${baseAc}`
  if (speedStat > defenseSpeedCap) pcAc += `; Spd ${speedStat}`
  for (const m of statusAcMods) pcAc += `; ${m}`
  pcAc += ')'
  if (!hit) {
    return `${npcName} → ${targetName}: ${npcAtk} vs ${pcAc} — miss.`
  }
  return `${npcName} → ${targetName}: ${npcAtk} vs ${pcAc} — hit${crit ? ' (nat 20)' : ''}, ${finalDmg} dmg.`
}

export function npcAttackPcThematic(args: {
  npcName: string
  targetName: string
  hit: boolean
  crit: boolean
  finalDmg: number
}): string {
  if (!args.hit) return `${args.npcName} misses ${args.targetName}.`
  if (args.crit) {
    return `${args.npcName} lands a critical hit on ${args.targetName} for ${args.finalDmg} damage.`
  }
  return `${args.npcName} hits ${args.targetName} for ${args.finalDmg} damage.`
}

export function pcAttackNpcLegacyMiss(args: {
  attackerName: string
  npcName: string
  d20: number
  perception: number
  agility: number
  toHit: number
  npcSpeed: number
  defense: number
}): string {
  const acStr = `10+Spd ${args.npcSpeed}=${args.defense}`
  return `${args.attackerName} → ${args.npcName}: d20+Per+Agi ${args.d20}+${args.perception}+${args.agility}=${args.toHit} vs ${acStr} — miss.`
}

export function pcAttackNpcLegacyHit(args: {
  attackerName: string
  npcName: string
  d20: number
  perception: number
  agility: number
  toHit: number
  npcSpeed: number
  defense: number
  crit: boolean
  finalDmg: number
  died: boolean
}): string {
  const acStr = `10+Spd ${args.npcSpeed}=${args.defense}`
  const base = `${args.attackerName} → ${args.npcName}: d20+Per+Agi ${args.d20}+${args.perception}+${args.agility}=${args.toHit} vs ${acStr} — hit${args.crit ? ' (nat 20)' : ''}, ${args.finalDmg} dmg.`
  return args.died ? `${base} ${args.npcName} dies.` : base
}

export function pcAttackNpcThematicMiss(args: { attackerName: string; npcName: string }): string {
  return `${args.attackerName} misses ${args.npcName}.`
}

export function pcAttackNpcThematicHit(args: {
  attackerName: string
  npcName: string
  crit: boolean
  finalDmg: number
  died: boolean
}): string {
  const line = args.crit
    ? `${args.attackerName} lands a critical hit on ${args.npcName} for ${args.finalDmg} damage.`
    : `${args.attackerName} hits ${args.npcName} for ${args.finalDmg} damage.`
  return args.died ? `${line} ${args.npcName} dies.` : line
}
