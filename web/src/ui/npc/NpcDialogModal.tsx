import type { Dispatch } from 'react'
import type { ContentDB } from '../../game/content/contentDb'
import { toGibberish } from '../../game/npc/gibberish'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import { useCursor } from '../cursor/useCursor'
import styles from './NpcDialogModal.module.css'

export function NpcDialogModal(props: { state: GameState; dispatch: Dispatch<Action>; content: ContentDB }) {
  const { state, dispatch, content } = props
  const cursor = useCursor()
  const npcId = state.ui.npcDialogFor
  if (!npcId) return null
  const npc = state.floor.npcs.find((n) => n.id === npcId)
  if (!npc) return null

  const wants = npc.quest?.wants ? content.item(npc.quest.wants).name : null
  const english = wants ? `…bring me ${wants}.` : `…`
  const gib = toGibberish(npc.language, english, Math.floor(state.floor.seed) ^ 0xabc)

  return (
    <div
      className={styles.backdrop}
      onClick={() => dispatch({ type: 'ui/closeNpcDialog' })}
      onPointerMove={cursor.onPointerMove}
      onPointerUp={(e) => {
        const result = cursor.endPointerUp(e)
        if (result) dispatch({ type: 'drag/drop', payload: result.payload, target: result.target })
      }}
    >
      <div
        className={styles.modal}
        data-drop-kind="npc"
        data-drop-npc-id={npc.id}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.title}>
            {npc.name} · {npc.status} · {npc.language}
          </div>
          <button className={styles.close} type="button" onClick={() => dispatch({ type: 'ui/closeNpcDialog' })}>
            Close
          </button>
        </div>

        <div className={styles.body}>{gib}</div>
        <div className={styles.hint}>Tip: drag an item from inventory onto them.</div>
      </div>
    </div>
  )
}

