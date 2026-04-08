import type { Dispatch } from 'react'
import type React from 'react'
import type { ContentDB } from '../../game/content/contentDb'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import { useEffect, useState } from 'react'
import { useCursor } from '../cursor/useCursor'
import { shakeTransform } from '../feedback/shakeTransform'
import { loadImage, prefetchImages } from '../assets/imageCache'
import styles from './PortraitPanel.module.css'

const VITAL_BAR_FILL: Record<'hp' | 'sta' | 'hun' | 'thr', string> = {
  hp: '#ff2400',
  sta: '#d6bdb5',
  hun: '#547d39',
  thr: '#3d75dd',
}

/** Until character state exposes per-vital **max** + **current**, treat the bar as full (implicit max = current). Order: row1 HP|STA, row2 HUN|THR. */
const PORTRAIT_VITAL_CELL_KEYS = ['hp', 'sta', 'hun', 'thr'] as const

type PortraitSprites =
  | { kind: 'simple'; baseSrc: string; eyesSrc: string; eyesInspectSrc?: string; mouthSrc: string; idleSrc?: string }
  | {
      kind: 'frosh'
      baseSrc: string
      eyesSrcL: string
      eyesSrcR: string
      eyesInspectSrc?: string
      mouthSrc: string
      idleSrc?: string
    }

const SPECIES_PORTRAIT: Partial<Record<GameState['party']['chars'][number]['species'], PortraitSprites>> = {
  Igor: {
    kind: 'simple',
    baseSrc: '/content/boblin_base.png',
    eyesSrc: '/content/boblin_eyes_open.png',
    eyesInspectSrc: '/content/boblin_eyes_inspect.png',
    mouthSrc: '/content/boblin_mouth_open.png',
    idleSrc: '/content/boblin_idle.png',
  },
  Mycyclops: {
    kind: 'simple',
    baseSrc: '/content/myclops_base.png',
    eyesSrc: '/content/myclops_eyes_open.png',
    eyesInspectSrc: '/content/myclops_eyes_inspect.png',
    mouthSrc: '/content/myclops_mouth_open.png',
    idleSrc: '/content/myclops_idle.png',
  },
  Frosch: {
    kind: 'frosh',
    baseSrc: '/content/frosh_base.png',
    eyesSrcL: '/content/frosh_eye_L.png',
    eyesSrcR: '/content/frosh_eye_R.png',
    eyesInspectSrc: '/content/frosh_eye_inspect.png',
    mouthSrc: '/content/frosh_mouth_open.png',
    idleSrc: '/content/frosh_idle.png',
  },
}

const SPECIES_FALLBACK_FACE: Record<string, string> = {
  Igor: '🧟',
  Mycyclops: '👁️',
  Frosch: '🐸',
}

export function PortraitPanel(props: {
  state: GameState
  dispatch: Dispatch<Action>
  content: ContentDB
  characterId: string
  captureForPostprocess?: boolean
}) {
  const { state, dispatch, characterId, captureForPostprocess = false } = props
  const cursor = useCursor()
  const nowMs = performance.now()
  const c = state.party.chars.find((x) => x.id === characterId) ?? null
  const portrait = c ? SPECIES_PORTRAIT[c.species] : undefined
  const portraitBaseSrc = portrait?.baseSrc ?? ''
  const portraitEyesSrc = portrait && portrait.kind !== 'frosh' ? portrait.eyesSrc : ''
  const portraitEyesSrcL = portrait && portrait.kind === 'frosh' ? portrait.eyesSrcL : ''
  const portraitEyesSrcR = portrait && portrait.kind === 'frosh' ? portrait.eyesSrcR : ''
  const portraitEyesInspectSrc = portrait?.eyesInspectSrc ?? ''
  const portraitMouthSrc = portrait?.mouthSrc ?? ''
  const portraitIdleSrc = portrait?.idleSrc ?? ''
  const [blinkClosed, setBlinkClosed] = useState(false)
  const [blinkClosedL, setBlinkClosedL] = useState(false)
  const [blinkClosedR, setBlinkClosedR] = useState(false)
  const [idleFlash, setIdleFlash] = useState(false)
  const [portraitAr, setPortraitAr] = useState<number>(1)

  useEffect(() => {
    let cancelled = false
    const timeoutIds: number[] = []
    if (!portrait) return

    const schedule = (ms: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        if (cancelled) return
        fn()
      }, ms)
      timeoutIds.push(id)
    }

    const openMs = () => 2200 + Math.random() * 3800
    const blinkMs = () => 70 + Math.random() * 70

    const startCycleSimple = () => {
      // Eyes stay open for a while, then briefly close (blink).
      setBlinkClosed(false)
      schedule(openMs(), () => {
        setBlinkClosed(true)
        schedule(blinkMs(), () => startCycleSimple())
      })
    }

    const startCycleFrosh = () => {
      // Frosh has independent eye sprites; blink with a slight offset between L/R.
      setBlinkClosed(false)
      setBlinkClosedL(false)
      setBlinkClosedR(false)
      schedule(openMs(), () => {
        const offsetMs = 35 + Math.random() * 110
        const durL = blinkMs()
        const durR = blinkMs()

        setBlinkClosedL(true)
        schedule(durL, () => setBlinkClosedL(false))

        schedule(offsetMs, () => {
          setBlinkClosedR(true)
          schedule(durR, () => setBlinkClosedR(false))
        })

        schedule(Math.max(durL, offsetMs + durR) + 40, () => startCycleFrosh())
      })
    }

    if (portrait.kind === 'frosh') startCycleFrosh()
    else startCycleSimple()
    return () => {
      cancelled = true
      for (const id of timeoutIds) window.clearTimeout(id)
    }
  }, [
    characterId,
    portrait?.kind,
    portraitEyesSrc,
    portraitEyesSrcL,
    portraitEyesSrcR,
  ])

  useEffect(() => {
    if (!portraitBaseSrc) return
    let cancelled = false
    loadImage(portraitBaseSrc)
      .then((img) => {
        if (cancelled) return
        const w = img.naturalWidth || 0
        const h = img.naturalHeight || 0
        if (w > 0 && h > 0) setPortraitAr(w / h)
      })
      .catch(() => {
        // Keep previous AR; the portrait will still render via <img>.
      })
    return () => {
      cancelled = true
    }
  }, [portraitBaseSrc])

  useEffect(() => {
    if (!portrait) return
    if (portrait.kind === 'frosh') {
      prefetchImages([portraitBaseSrc, portraitEyesSrcL, portraitEyesSrcR, portraitEyesInspectSrc, portraitMouthSrc, portraitIdleSrc])
    } else {
      prefetchImages([portraitBaseSrc, portraitEyesSrc, portraitEyesInspectSrc, portraitMouthSrc, portraitIdleSrc])
    }
  }, [
    portrait?.kind,
    portraitBaseSrc,
    portraitEyesSrc,
    portraitEyesSrcL,
    portraitEyesSrcR,
    portraitEyesInspectSrc,
    portraitMouthSrc,
    portraitIdleSrc,
  ])

  useEffect(() => {
    if (!portraitIdleSrc) return
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
    portraitIdleSrc,
    state.render.portraitIdleGapMinMs,
    state.render.portraitIdleGapMaxMs,
    state.render.portraitIdleFlashMinMs,
    state.render.portraitIdleFlashMaxMs,
  ])

  const isHoveringEyes =
    cursor.state.dragging?.started &&
    cursor.state.hoverTarget?.kind === 'portrait' &&
    cursor.state.hoverTarget.characterId === characterId &&
    cursor.state.hoverTarget.target === 'eyes'
  const isHoveringMouth =
    cursor.state.dragging?.started &&
    cursor.state.hoverTarget?.kind === 'portrait' &&
    cursor.state.hoverTarget.characterId === characterId &&
    cursor.state.hoverTarget.target === 'mouth'
  const mouthCue = state.ui.portraitMouth?.characterId === characterId && state.ui.portraitMouth.untilMs > nowMs ? state.ui.portraitMouth : null
  const isMouthCueActive = !!mouthCue
  const mouthAnimKey = isMouthCueActive ? `mouth_${mouthCue?.startedAtMs ?? 0}` : 'mouth_idle'

  const flickerHz = Math.max(0, Number(state.render.portraitMouthFlickerHz ?? 0))
  const flickerAmount = Math.max(0, Math.round(Number(state.render.portraitMouthFlickerAmount ?? 0)))
  // Amount is interpreted as number of visible “chomps” (mouth-on pulses).
  const flickerSteps = flickerAmount * 2
  const flickerEnabled = flickerHz > 0 && flickerSteps > 0
  const cueFlickerOn = (() => {
    if (!mouthCue) return false
    if (!flickerEnabled) return true
    const startedAtMs = mouthCue.startedAtMs ?? nowMs
    const totalMs = Math.max(1, mouthCue.untilMs - startedAtMs)
    const elapsedMs = Math.max(0, nowMs - startedAtMs)

    // Stretch the discrete on/off steps across the whole burst window so we don't “finish early”
    // when `untilMs` is clamped up (e.g. minimum burst duration for capture-to-texture).
    const t = Math.max(0, Math.min(0.999999, elapsedMs / totalMs))
    const tick = Math.floor(t * flickerSteps)
    return tick % 2 === 0
  })()
  // Hover should show the mouth steadily as an affordance.
  // But once a feed cue is active, flicker should be visible even if the cursor is still hovering.
  // In capture HUD mode, portrait interactions are rendered via compositor overlays (not capture-limited).
  const showMouth = captureForPostprocess ? false : isMouthCueActive ? cueFlickerOn : isHoveringMouth
  const showEyesInspect = captureForPostprocess ? false : isHoveringEyes && !!portrait && !!portrait.eyesInspectSrc
  const blinkHideEyes = blinkClosed && !showEyesInspect
  const blinkHideEyesL = blinkClosedL && !showEyesInspect
  const blinkHideEyesR = blinkClosedR && !showEyesInspect
  const __debug =
    import.meta.env.DEV && state.ui.debugOpen
      ? {
          nowMs: Math.round(nowMs),
          globalCueChar: state.ui.portraitMouth?.characterId ?? null,
          startedAtMs: state.ui.portraitMouth?.startedAtMs != null ? Math.round(state.ui.portraitMouth.startedAtMs) : null,
          untilMs: state.ui.portraitMouth?.untilMs != null ? Math.round(state.ui.portraitMouth.untilMs) : null,
          isMouthCueActive,
          cueFlickerOn,
          showMouth,
          hoveringMouth: isHoveringMouth,
        }
      : null

  const ps = state.ui.portraitShake
  const portraitShakeStyle =
    ps && ps.characterId === characterId && ps.untilMs > nowMs
      ? {
          transform: shakeTransform(
            nowMs,
            ps.startedAtMs ?? ps.untilMs - 160,
            ps.untilMs,
            ps.magnitude * state.render.portraitShakeMagnitudeScale,
            state.render.portraitShakeLengthMs,
            state.render.portraitShakeDecayMs,
            state.render.portraitShakeHz,
          ),
        }
      : undefined

  if (!c) return null

  const statuses = c.statuses.map((s) => s.id)
  const statusText = statuses.length ? `Status: ${statuses.join(', ')}` : 'Status: —'

  const pulse = state.ui.portraitIdlePulse
  const pulseIdle = pulse?.characterId === characterId && pulse.untilMs > nowMs
  // Idle art itself is compositor-rendered in capture mode, but the base portrait eye sprites
  // still need to hide during idle so the composition matches the original DOM behavior.
  const showIdleForEyes = idleFlash || pulseIdle
  const showIdleSprite = captureForPostprocess ? false : showIdleForEyes
  const idleHideEyes = showIdleForEyes && !showEyesInspect

  return (
    <div
      className={styles.root}
      onPointerMove={cursor.onPointerMove}
      onPointerCancel={cursor.cancelDrag}
      onPointerUp={(e) => {
        const result = cursor.endPointerUp(e)
        if (result) dispatch({ type: 'drag/drop', payload: result.payload, target: result.target, nowMs: performance.now() })
      }}
    >
      <div
        className={styles.portrait}
        data-portrait-box="true"
        data-portrait-character-id={characterId}
        role="button"
        tabIndex={0}
        aria-label={`${c.name}, ${c.species}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            dispatch({ type: 'ui/portraitFrameTap', characterId })
          }
        }}
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
            {showEyesInspect ? (
              <img className={styles.sprite} src={portrait.eyesInspectSrc} alt="" draggable={false} />
            ) : portrait.kind === 'frosh' ? (
              <>
                <img
                  className={`${styles.sprite} ${blinkHideEyesL || idleHideEyes ? styles.eyesHidden : ''}`}
                  src={portrait.eyesSrcL}
                  alt=""
                  draggable={false}
                />
                <img
                  className={`${styles.sprite} ${blinkHideEyesR || idleHideEyes ? styles.eyesHidden : ''}`}
                  src={portrait.eyesSrcR}
                  alt=""
                  draggable={false}
                />
              </>
            ) : (
              <img className={`${styles.sprite} ${blinkHideEyes ? styles.eyesHidden : ''}`} src={portrait.eyesSrc} alt="" draggable={false} />
            )}
            {showMouth ? (
              <img
                key={mouthAnimKey}
                className={`${styles.sprite} ${isMouthCueActive ? styles.mouthChomp : ''}`}
                src={portrait.mouthSrc}
                alt=""
                draggable={false}
              />
            ) : null}
            {portrait.idleSrc ? (
              <img
                className={`${styles.sprite} ${showIdleSprite ? '' : styles.idleHidden}`}
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

        {__debug ? (
          <div
            style={{
              position: 'absolute',
              left: 6,
              top: 6,
              zIndex: 20,
              padding: '6px 7px',
              borderRadius: 8,
              fontFamily: 'var(--mono)',
              fontSize: 10,
              lineHeight: 1.25,
              background: 'rgba(0,0,0,0.65)',
              border: '1px solid rgba(255,255,255,0.14)',
              color: 'rgba(255,255,255,0.85)',
              pointerEvents: 'none',
              whiteSpace: 'pre',
            }}
          >
            {`nowMs=${__debug.nowMs}
ui.portraitMouth.characterId=${__debug.globalCueChar}
startedAtMs=${__debug.startedAtMs}
untilMs=${__debug.untilMs}
isMouthCueActive=${String(__debug.isMouthCueActive)}
cueFlickerOn=${String(__debug.cueFlickerOn)}
showMouth=${String(__debug.showMouth)}
hoveringMouth=${String(__debug.hoveringMouth)}`}
          </div>
        ) : null}

        {__debug ? (
          <div
            style={{
              position: 'absolute',
              right: 6,
              top: 6,
              zIndex: 21,
              width: 16,
              height: 16,
              borderRadius: 4,
              border: '2px solid rgba(255,255,255,0.7)',
              background: __debug.showMouth ? 'rgba(80,220,120,0.95)' : 'rgba(220,80,80,0.9)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
            }}
            title="Debug: showMouth"
          />
        ) : null}

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

        <div className={styles.statsOverlay} data-portrait-stats="true" aria-hidden="true">
          <div className={styles.vitalGrid}>
            {PORTRAIT_VITAL_CELL_KEYS.map((key) => (
              <div key={key} className={styles.statCell}>
                <div className={styles.statBarTrack}>
                  <div className={styles.statBarFill} style={{ backgroundColor: VITAL_BAR_FILL[key] }} />
                </div>
              </div>
            ))}
          </div>
          <div className={styles.statusLine} title={statusText}>
            {statusText}
          </div>
        </div>
      </div>
    </div>
  )
}

