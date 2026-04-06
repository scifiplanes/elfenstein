import type { Dispatch } from 'react'
import type { ContentDB } from '../../game/content/contentDb'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import { useEffect, useState } from 'react'
import { useCursor } from '../cursor/useCursor'
import { shakeTransform } from '../feedback/shakeTransform'
import styles from './PortraitPanel.module.css'

type PortraitSprites = { baseSrc: string; eyesSrc: string; mouthSrc: string }

const SPECIES_PORTRAIT: Partial<Record<GameState['party']['chars'][number]['species'], PortraitSprites>> = {
  Igor: {
    baseSrc: '/content/boblin_base.png',
    eyesSrc: '/content/boblin_eyes_open.png',
    mouthSrc: '/content/boblin_mouth_open.png',
  },
}

const SPECIES_FALLBACK_FACE: Record<string, string> = {
  Igor: '🧟',
  Mycyclops: '👁️',
  Frosch: '🐸',
}

export function PortraitPanel(props: { state: GameState; dispatch: Dispatch<Action>; content: ContentDB; characterId: string }) {
  const { state, dispatch, characterId } = props
  const cursor = useCursor()
  const c = state.party.chars.find((x) => x.id === characterId)
  if (!c) return null
  const portrait = SPECIES_PORTRAIT[c.species]
  const [blinkClosed, setBlinkClosed] = useState(false)

  useEffect(() => {
    if (!portrait?.eyesSrc) return
    let cancelled = false
    let timeoutId: number | null = null

    const schedule = (ms: number, fn: () => void) => {
      timeoutId = window.setTimeout(() => {
        if (cancelled) return
        fn()
      }, ms)
    }

    const startCycle = () => {
      // Eyes stay open for a while, then briefly close (blink).
      setBlinkClosed(false)
      schedule(2200 + Math.random() * 3800, () => {
        setBlinkClosed(true)
        schedule(70 + Math.random() * 70, () => startCycle())
      })
    }

    startCycle()
    return () => {
      cancelled = true
      if (timeoutId != null) window.clearTimeout(timeoutId)
    }
  }, [characterId, portrait?.eyesSrc])

  const isHoveringMouth =
    cursor.state.dragging?.started &&
    cursor.state.hoverTarget?.kind === 'portrait' &&
    cursor.state.hoverTarget.characterId === characterId &&
    cursor.state.hoverTarget.target === 'mouth'
  const isMouthFlashActive = state.ui.portraitMouth?.characterId === characterId && state.ui.portraitMouth.untilMs > state.nowMs
  const showMouth = isHoveringMouth || isMouthFlashActive
  const mouthAnimKey = isMouthFlashActive ? `mouth_${state.ui.portraitMouth?.startedAtMs ?? 0}` : 'mouth_idle'

  const ps = state.ui.portraitShake
  const portraitShakeStyle =
    ps && ps.characterId === characterId && ps.untilMs > state.nowMs
      ? { transform: shakeTransform(state.nowMs, ps.untilMs, ps.magnitude) }
      : undefined

  return (
    <div
      className={styles.root}
      onPointerMove={cursor.onPointerMove}
      onPointerUp={(e) => {
        const result = cursor.endPointerUp(e)
        if (result) dispatch({ type: 'drag/drop', payload: result.payload, target: result.target })
      }}
    >
      <button
        type="button"
        className={styles.btn}
        onClick={() => dispatch({ type: 'ui/openPaperdoll', characterId })}
      >
        {c.name} · {c.species}
      </button>

      <div className={styles.portrait} style={portraitShakeStyle}>
        {portrait ? (
          <div className={styles.spriteStack} aria-hidden="true">
            <img className={styles.sprite} src={portrait.baseSrc} alt="" draggable={false} />
            <img className={`${styles.sprite} ${blinkClosed ? styles.eyesHidden : ''}`} src={portrait.eyesSrc} alt="" draggable={false} />
            <img
              key={mouthAnimKey}
              className={`${styles.sprite} ${showMouth ? '' : styles.mouthHidden} ${isMouthFlashActive ? styles.mouthChomp : ''}`}
              src={portrait.mouthSrc}
              alt=""
              draggable={false}
            />
          </div>
        ) : (
          <div className={styles.layer} aria-hidden="true">
            {SPECIES_FALLBACK_FACE[c.species] ?? '🙂'}
          </div>
        )}

        <div
          className={styles.eyes}
          data-drop-kind="portrait"
          data-drop-character-id={characterId}
          data-drop-portrait-target="eyes"
        />
        <div
          className={styles.mouth}
          data-drop-kind="portrait"
          data-drop-character-id={characterId}
          data-drop-portrait-target="mouth"
        />
      </div>

      <div className={styles.stats}>
        <div>HP {Math.round(c.hp)} · STA {Math.round(c.stamina)}</div>
        <div>HUN {Math.round(c.hunger)} · THR {Math.round(c.thirst)}</div>
        <div>
          {c.statuses.length ? `Status: ${c.statuses.map((s) => s.id).join(', ')}` : 'Status: —'}
        </div>
      </div>
    </div>
  )
}

