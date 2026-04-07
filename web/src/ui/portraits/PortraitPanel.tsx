import type { Dispatch } from 'react'
import type React from 'react'
import type { ContentDB } from '../../game/content/contentDb'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import { useEffect, useState } from 'react'
import { useCursor } from '../cursor/useCursor'
import { shakeTransform } from '../feedback/shakeTransform'
import styles from './PortraitPanel.module.css'

type PortraitSprites = { baseSrc: string; eyesSrc: string; mouthSrc: string; idleSrc?: string }

const SPECIES_PORTRAIT: Partial<Record<GameState['party']['chars'][number]['species'], PortraitSprites>> = {
  Igor: {
    baseSrc: '/content/boblin_base.png',
    eyesSrc: '/content/boblin_eyes_open.png',
    mouthSrc: '/content/boblin_mouth_open.png',
    idleSrc: '/content/boblin_idle.png',
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
  const c = state.party.chars.find((x) => x.id === characterId) ?? null
  const portrait = c ? SPECIES_PORTRAIT[c.species] : undefined
  const [blinkClosed, setBlinkClosed] = useState(false)
  const [idleFlash, setIdleFlash] = useState(false)
  const [portraitAr, setPortraitAr] = useState<number>(1)

  useEffect(() => {
    if (!portrait?.eyesSrc || !c) return
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
  }, [characterId, portrait?.eyesSrc, c])

  useEffect(() => {
    if (!portrait?.idleSrc || !c) return
    let cancelled = false
    let timeoutId: number | null = null

    const schedule = (ms: number, fn: () => void) => {
      timeoutId = window.setTimeout(() => {
        if (cancelled) return
        fn()
      }, ms)
    }

    const { portraitIdleGapMinMs, portraitIdleGapMaxMs, portraitIdleFlashMinMs, portraitIdleFlashMaxMs } = state.render
    const gapSpan = Math.max(0, portraitIdleGapMaxMs - portraitIdleGapMinMs)
    const flashSpan = Math.max(0, portraitIdleFlashMaxMs - portraitIdleFlashMinMs)

    const startCycle = () => {
      setIdleFlash(false)
      schedule(portraitIdleGapMinMs + Math.random() * gapSpan, () => {
        setIdleFlash(true)
        schedule(portraitIdleFlashMinMs + Math.random() * flashSpan, () => startCycle())
      })
    }

    startCycle()
    return () => {
      cancelled = true
      if (timeoutId != null) window.clearTimeout(timeoutId)
    }
  }, [
    characterId,
    portrait?.idleSrc,
    state.render.portraitIdleGapMinMs,
    state.render.portraitIdleGapMaxMs,
    state.render.portraitIdleFlashMinMs,
    state.render.portraitIdleFlashMaxMs,
    c,
  ])

  useEffect(() => {
    if (!portrait?.baseSrc || !c) return
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      const w = img.naturalWidth || 0
      const h = img.naturalHeight || 0
      if (w > 0 && h > 0) setPortraitAr(w / h)
    }
    img.src = portrait.baseSrc
    return () => {
      cancelled = true
    }
  }, [portrait?.baseSrc, c])

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
      ? {
          transform: shakeTransform(
            state.nowMs,
            ps.startedAtMs ?? ps.untilMs - 160,
            ps.untilMs,
            ps.magnitude * state.render.portraitShakeMagnitudeScale,
            state.render.portraitShakeLengthMs,
            state.render.portraitShakeDecayMs,
          ),
        }
      : undefined

  if (!c) return null

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

      <div
        className={styles.portrait}
        data-portrait-box="true"
        style={
          {
            ...(portraitShakeStyle ?? {}),
            ['--portrait-ar' as unknown as string]: `${portraitAr}`,
          } as unknown as React.CSSProperties
        }
      >
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
            {portrait.idleSrc ? (
              <img
                className={`${styles.sprite} ${idleFlash ? '' : styles.idleHidden}`}
                src={portrait.idleSrc}
                alt=""
                draggable={false}
              />
            ) : null}
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

