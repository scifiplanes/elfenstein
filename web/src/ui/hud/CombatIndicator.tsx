import type { Dispatch } from 'react'
import type { GameState } from '../../game/types'
import type { Action } from '../../game/reducer'
import { currentTurn } from '../../game/state/combat'
import styles from './CombatIndicator.module.css'

function npcName(state: GameState, npcId: string) {
  return state.floor.npcs.find((n) => n.id === npcId)?.name ?? 'Unknown'
}

function pcName(state: GameState, characterId: string) {
  return state.party.chars.find((c) => c.id === characterId)?.name ?? 'Unknown'
}

export function CombatIndicator(props: {
  state: GameState
  dispatch: Dispatch<Action>
  /** Capture HUD omits interactive controls (see `DitheredFrameRoot`). */
  interactive?: boolean
}) {
  const { state, dispatch, interactive = true } = props
  if (!state.combat) return null
  if (state.ui.death || state.ui.screen === 'title') return null

  const turn = currentTurn(state)
  const turnText =
    !turn ? '—'
    : turn.kind === 'pc' ? `PC turn: ${pcName(state, turn.id)}`
    : `NPC turn: ${npcName(state, turn.id)}`

  const npcs = state.combat.participants.npcs
    .map((id) => state.floor.npcs.find((n) => n.id === id))
    .filter(Boolean) as Array<GameState['floor']['npcs'][number]>

  const enemyLabel = npcs.length ? npcs.map((n) => n.name).join(', ') : 'Unknown'
  const canDefend = turn?.kind === 'pc'

  return (
    <div className={styles.wrap} aria-label="Combat status">
      <div className={styles.title}>ENCOUNTER</div>
      <div className={styles.enemies}>{enemyLabel}</div>
      <div className={styles.turn}>{turnText}</div>
      {interactive ? (
        <div className={styles.actions} role="group" aria-label="Combat actions">
          <button
            type="button"
            className={styles.actionBtn}
            disabled={!canDefend}
            aria-disabled={!canDefend}
            aria-label="Defend (stamina cost). Keyboard: F"
            onClick={() => dispatch({ type: 'combat/defend' })}
          >
            Defend (F)
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            aria-label="Attempt to flee (stamina cost). Keyboard: R"
            onClick={() => dispatch({ type: 'combat/fleeAttempt' })}
          >
            Flee (R)
          </button>
        </div>
      ) : (
        <div className={styles.captureHint}>Flee (R) · Defend (F)</div>
      )}
    </div>
  )
}
