import { CHEST_LOOT_DEF_IDS, CONTAINER_LOOT_DEF_IDS } from '../game/content/poiLootTables'
import { DEFAULT_ITEMS } from '../game/content/items'
import { DEFAULT_STATUSES } from '../game/content/statuses'
import type { ItemDefId, NpcKind, StatusEffectId } from '../game/types'
import { PROCgen_LOCK_KEY_ITEM_DEF_IDS } from '../procgen/locks'
import {
  PROCgen_NPC_QUEST_HATED_ITEM_DEF_IDS,
  PROCgen_NPC_QUEST_WANT_ITEM_DEF_IDS,
  PROCgen_POI_IDS_ALWAYS,
  PROCgen_POI_IDS_OPTIONAL,
} from '../procgen/population'
import { PROCgen_ALL_NPC_KINDS, PROCgen_FLOOR_SPAWN_TABLE_ITEM_DEF_IDS } from '../procgen/spawnTables'
import { ITEM_DEF_IDS_INTENTIONALLY_NON_PROCGEN } from './procgenContentNonSpawnAllowlist'

function uniq<T>(a: readonly T[]): T[] {
  return Array.from(new Set(a))
}

function statusIdsFromItemDefs(): StatusEffectId[] {
  const out: StatusEffectId[] = []
  for (const it of DEFAULT_ITEMS) {
    const chances = it.feed?.statusChances
    if (!chances) continue
    for (const c of chances) out.push(c.status)
  }
  return uniq(out)
}

export type ProcgenContentAuditResult = {
  text: string
  exitCode: number
  itemViolations: ItemDefId[]
}

/**
 * Compare seeded content (`DEFAULT_ITEMS`, `DEFAULT_STATUSES`) to ids used by procgen + POI loot.
 * Run from CLI: `npm run audit:procgen-content` (see `web/scripts/procgenContentAudit.ts`).
 */
export function runProcgenContentAudit(): ProcgenContentAuditResult {
  const lines: string[] = []
  const seedItems = DEFAULT_ITEMS.map((i) => i.id)
  const seedStatusIds = DEFAULT_STATUSES.map((s) => s.id)

  const usedItems = uniq([
    ...PROCgen_FLOOR_SPAWN_TABLE_ITEM_DEF_IDS,
    ...PROCgen_LOCK_KEY_ITEM_DEF_IDS,
    ...CHEST_LOOT_DEF_IDS,
    ...CONTAINER_LOOT_DEF_IDS,
    ...PROCgen_NPC_QUEST_WANT_ITEM_DEF_IDS,
    ...PROCgen_NPC_QUEST_HATED_ITEM_DEF_IDS,
  ])

  const usedSet = new Set<string>(usedItems)
  const allow = new Set<string>(ITEM_DEF_IDS_INTENTIONALLY_NON_PROCGEN)
  const itemViolations = seedItems.filter((id) => !usedSet.has(id) && !allow.has(id))

  const seedSet = new Set(seedItems)
  const orphanSpawnIds = PROCgen_FLOOR_SPAWN_TABLE_ITEM_DEF_IDS.filter((id) => !seedSet.has(id))
  const lootAll = uniq([...CHEST_LOOT_DEF_IDS, ...CONTAINER_LOOT_DEF_IDS])
  const orphanLootIds = lootAll.filter((id) => !seedSet.has(id))

  /** Keep in sync with `NpcKind` in `game/types.ts` (every kind should appear in procgen tables). */
  const npcUnion: NpcKind[] = [
    'Wurglepup',
    'Bobr',
    'Skeleton',
    'Catoctopus',
    'Swarm',
    'Chumbo',
    'Grub',
    'Kuratko',
    'Grechka',
    'Snailord',
    'Bulba',
    'Elder',
    'Kerekere',
    'Bok',
    'RegularBok',
    'BigHands',
    'Gargantula',
  ]
  const npcMissingFromTable = npcUnion.filter((k) => !PROCgen_ALL_NPC_KINDS.includes(k))

  lines.push('=== Procgen / floor content audit ===')
  lines.push('')
  lines.push(`POI ids (always): ${PROCgen_POI_IDS_ALWAYS.join(', ')}`)
  lines.push(`POI ids (optional): ${PROCgen_POI_IDS_OPTIONAL.join(', ')}`)
  lines.push('')
  lines.push(`NPC kinds (audit list): ${PROCgen_ALL_NPC_KINDS.join(', ')}`)
  lines.push('')
  lines.push(`ItemDefIds used by floor spawn table, locks, POI loot, or NPC quests: ${usedItems.length} distinct`)
  lines.push(usedItems.sort().join(', '))
  lines.push('')
  lines.push('ItemDefIds intentionally non-procgen (allowlist):')
  lines.push([...ITEM_DEF_IDS_INTENTIONALLY_NON_PROCGEN].sort().join(', '))
  lines.push('')

  const indirectStatuses = statusIdsFromItemDefs()
  lines.push(`StatusEffectIds referenced by item defs (feed.statusChances): ${indirectStatuses.sort().join(', ')}`)
  lines.push(`Seeded status defs (${seedStatusIds.length}): ${seedStatusIds.sort().join(', ')}`)
  lines.push(
    'Note: statuses are not placed by procgen; gameplay applies them via combat/feed/hazards. No status “violations” are enforced by this audit.',
  )
  lines.push('')

  if (orphanSpawnIds.length) {
    lines.push(`WARN: spawn-table audit ids not in DEFAULT_ITEMS: ${orphanSpawnIds.join(', ')}`)
  }
  if (orphanLootIds.length) {
    lines.push(`WARN: POI loot ids not in DEFAULT_ITEMS: ${orphanLootIds.join(', ')}`)
  }
  if (npcMissingFromTable.length) {
    lines.push(`WARN: NpcKind missing from PROCgen_ALL_NPC_KINDS: ${npcMissingFromTable.join(', ')}`)
  }

  if (itemViolations.length) {
    lines.push('FAIL: seeded items neither used nor allowlisted:')
    lines.push(itemViolations.join(', '))
  } else {
    lines.push('OK: every seeded item is either used by procgen/POI loot/NPC quests or explicitly allowlisted.')
  }

  const text = lines.join('\n')
  const hasError =
    itemViolations.length > 0 || orphanSpawnIds.length > 0 || orphanLootIds.length > 0 || npcMissingFromTable.length > 0
  const exitCode = hasError ? 1 : 0
  return { text, exitCode, itemViolations }
}
