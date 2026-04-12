import type { Dispatch } from 'react'
import type { ContentDB } from '../../game/content/contentDb'
import type { GameState } from '../../game/types'
import type { Action } from '../../game/reducer'
import {
  COMBAT_DEFEND_STAMINA_COST,
  COMBAT_FLEE_STAMINA_COST,
  currentTurn,
  effectiveCombatAttackStaminaCost,
  effectiveDefendStaminaCost,
  effectiveFleeStaminaCost,
  firstLivingEncounterNpcId,
} from '../../game/state/combat'
import { resolveWeaponItemIdForPcTurn } from '../../game/state/equipment'
import { COMBAT_ACTION_CHROME_ATTR } from '../cursor/combatActionChromeAttr'
import { CURSOR_HAND_ACTIVE_ATTR } from '../cursor/cursorHandActiveAttr'
import styles from './CombatIndicator.module.css'

function npcName(state: GameState, npcId: string) {
  return state.floor.npcs.find((n) => n.id === npcId)?.name ?? 'Unknown'
}

function pcName(state: GameState, characterId: string) {
  return state.party.chars.find((c) => c.id === characterId)?.name ?? 'Unknown'
}

function combatChromeVisible(state: GameState) {
  return Boolean(state.combat) && !state.ui.death && state.ui.screen !== 'title'
}

/** Bottom-right encounter roster (enemy HP). Sits in `gameCornerStack` with `ActivityLog`. */
export function CombatEncounterCorner(props: { state: GameState }) {
  const { state } = props
  if (!combatChromeVisible(state)) return null

  const npcs = state.combat!.participants.npcs
    .map((id) => state.floor.npcs.find((n) => n.id === id))
    .filter(Boolean) as Array<GameState['floor']['npcs'][number]>

  return (
    <div className={styles.cornerWrap} aria-label="Combat encounter">
      <div className={styles.title}>ENCOUNTER</div>
      <div className={styles.enemyList} aria-label="Encounter enemies">
        {npcs.length ? (
          npcs.map((n) => {
            const max = Math.max(1, n.hpMax ?? n.hp)
            const pct = Math.round((100 * Math.max(0, n.hp)) / max)
            return (
              <div key={n.id} className={styles.enemyRow}>
                <span className={styles.enemyName}>{n.name}</span>
                <div
                  className={styles.hpTrack}
                  role="progressbar"
                  aria-valuenow={n.hp}
                  aria-valuemin={0}
                  aria-valuemax={max}
                  aria-label={`${n.name} health`}
                >
                  <div className={styles.hpFill} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })
        ) : (
          <div className={styles.enemies}>Unknown</div>
        )}
      </div>
    </div>
  )
}

function attackStaminaCost(state: GameState, content: ContentDB, actingPc: GameState['party']['chars'][number]): number | null {
  const turn = currentTurn(state)
  if (!turn || turn.kind !== 'pc') return null
  const itemId = resolveWeaponItemIdForPcTurn(state, turn.id, content)
  if (!itemId) return null
  const item = state.party.items[itemId]
  if (!item) return null
  const def = content.item(item.defId)
  const w = def.weapon
  if (!def.tags.includes('weapon') || !w) return null
  return effectiveCombatAttackStaminaCost(actingPc, w)
}

/** Centered action menu + turn aside; hotkeys inline on each row. Full-bleed overlay (`pointer-events: none` except the card). */
export function CombatCenterActionMenu(props: {
  state: GameState
  dispatch: Dispatch<Action>
  content: ContentDB
  /** Capture HUD omits interactive controls (see `DitheredFrameRoot`). */
  interactive?: boolean
}) {
  const { state, dispatch, content, interactive = true } = props
  if (!combatChromeVisible(state)) return null

  const turn = currentTurn(state)
  const turnText =
    !turn ? '—'
    : turn.kind === 'pc' ? `Current: ${pcName(state, turn.id)}`
    : `NPC turn: ${npcName(state, turn.id)}`

  const q = state.combat!.turnQueue
  const nq = q.length
  let nextLine: string | null = null
  if (nq > 1) {
    const cur = ((state.combat!.turnIndex % nq) + nq) % nq
    const nt = q[(cur + 1) % nq]!
    nextLine = nt.kind === 'pc' ? `Next: ${pcName(state, nt.id)}` : `Next: ${npcName(state, nt.id)}`
  }

  const canPcAct = turn?.kind === 'pc'
  const actingPc = canPcAct ? state.party.chars.find((c) => c.id === turn!.id) : undefined
  const atkCost = actingPc ? attackStaminaCost(state, content, actingPc) : null
  const attackCostLabel = atkCost == null ? '—' : atkCost === 0 ? '0' : `−${atkCost}`

  const defendCost = actingPc ? effectiveDefendStaminaCost(actingPc) : 0
  const fleeCost = actingPc ? effectiveFleeStaminaCost(actingPc) : 0
  const defendCostShown = actingPc ? defendCost : COMBAT_DEFEND_STAMINA_COST
  const fleeCostShown = actingPc ? fleeCost : COMBAT_FLEE_STAMINA_COST
  const defendDisabled = !canPcAct || !actingPc || actingPc.stamina < defendCost
  const livingEncounterNpcId = state.combat ? firstLivingEncounterNpcId(state) : null
  const fleeDisabled =
    !canPcAct || !actingPc || actingPc.stamina < fleeCost || !livingEncounterNpcId
  const skipDisabled = !canPcAct

  const attackTargetId = livingEncounterNpcId
  const attackDisabled =
    !canPcAct ||
    !actingPc ||
    atkCost == null ||
    !attackTargetId ||
    actingPc.stamina < atkCost

  const actionMenuTitle = turn?.kind === 'pc' ? pcName(state, turn.id) : '—'

  return (
    <div className={styles.centerOverlay}>
      <div className={styles.centerCluster} {...{ [COMBAT_ACTION_CHROME_ATTR]: '' }}>
        <div className={styles.actionMenuCard} role="region" aria-label="Combat actions">
          <div className={styles.menuTitle}>{actionMenuTitle}</div>
          {interactive ? (
            <>
              <div className={styles.menuRow}>
                <button
                  type="button"
                  className={styles.menuRowBtn}
                  disabled={attackDisabled}
                  aria-disabled={attackDisabled}
                  aria-label="Attack first enemy in the encounter roster, or click a specific foe in the 3D view."
                  {...{ [CURSOR_HAND_ACTIVE_ATTR]: '' }}
                  onClick={() => {
                    const id = firstLivingEncounterNpcId(state)
                    if (id) dispatch({ type: 'combat/clickAttack', npcId: id })
                  }}
                >
                  <span className={styles.menuRowLabel}>ATTACK</span>{' '}
                  <span className={styles.menuRowKey}>(click)</span>
                </button>
                <span className={styles.menuRowCost}>{attackCostLabel}</span>
              </div>
              <div className={styles.menuRow}>
                <button
                  type="button"
                  className={styles.menuRowBtn}
                  disabled={defendDisabled}
                  aria-disabled={defendDisabled}
                  aria-label="Defend. Keyboard: F"
                  {...{ [CURSOR_HAND_ACTIVE_ATTR]: '' }}
                  onClick={() => dispatch({ type: 'combat/defend' })}
                >
                  <span className={styles.menuRowLabel}>DEFEND</span>{' '}
                  <span className={styles.menuRowKey}>(F)</span>
                </button>
                <span className={styles.menuRowCost}>−{defendCostShown}</span>
              </div>
              <div className={styles.menuRow}>
                <button
                  type="button"
                  className={styles.menuRowBtn}
                  disabled={skipDisabled}
                  aria-disabled={skipDisabled}
                  aria-label="Wait (skip turn). Keyboard: Space"
                  {...{ [CURSOR_HAND_ACTIVE_ATTR]: '' }}
                  onClick={() => dispatch({ type: 'combat/skip' })}
                >
                  <span className={styles.menuRowLabel}>WAIT</span>{' '}
                  <span className={styles.menuRowKey}>(Space)</span>
                </button>
                <span className={styles.menuRowCost}>0</span>
              </div>
              <div className={styles.menuRow}>
                <button
                  type="button"
                  className={styles.menuRowBtn}
                  disabled={fleeDisabled}
                  aria-disabled={fleeDisabled}
                  aria-label="Attempt to flee. Keyboard: R"
                  {...{ [CURSOR_HAND_ACTIVE_ATTR]: '' }}
                  onClick={() => dispatch({ type: 'combat/fleeAttempt' })}
                >
                  <span className={styles.menuRowLabel}>FLEE</span>{' '}
                  <span className={styles.menuRowKey}>(R)</span>
                </button>
                <span className={styles.menuRowCost}>−{fleeCostShown}</span>
              </div>
            </>
          ) : (
            <>
              <div className={styles.menuRow}>
                <span className={styles.menuRowStatic}>
                  ATTACK <span className={styles.menuRowKey}>(click)</span>
                </span>
                <span className={styles.menuRowCost}>{attackCostLabel}</span>
              </div>
              <div className={styles.menuRow}>
                <span className={styles.menuRowStatic}>
                  DEFEND <span className={styles.menuRowKey}>(F)</span>
                </span>
                <span className={styles.menuRowCost}>−{defendCostShown}</span>
              </div>
              <div className={styles.menuRow}>
                <span className={styles.menuRowStatic}>
                  WAIT <span className={styles.menuRowKey}>(Space)</span>
                </span>
                <span className={styles.menuRowCost}>0</span>
              </div>
              <div className={styles.menuRow}>
                <span className={styles.menuRowStatic}>
                  FLEE <span className={styles.menuRowKey}>(R)</span>
                </span>
                <span className={styles.menuRowCost}>−{fleeCostShown}</span>
              </div>
            </>
          )}
        </div>
        <div className={styles.turnAside} aria-label="Combat turn">
          <div className={styles.turnAsideLine}>{turnText}</div>
          {nextLine ? <div className={styles.turnAsideNext}>{nextLine}</div> : null}
        </div>
      </div>
    </div>
  )
}
