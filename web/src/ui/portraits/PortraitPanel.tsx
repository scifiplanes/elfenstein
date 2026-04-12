import type { Dispatch } from 'react'
import type React from 'react'
import type { ContentDB } from '../../game/content/contentDb'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getCharacterEquipmentHudModel } from '../../game/state/equipment'
import { useCursor } from '../cursor/useCursor'
import { getPressedPortraitCharacterId } from '../cursor/getPressedPortraitCharacterId'
import { shakeTransform } from '../feedback/shakeTransform'
import { loadImage, prefetchImages } from '../assets/imageCache'
import { hpMax, staminaMax } from '../../game/state/runProgression'
import { ItemEmoji } from '../item/ItemEmoji'
import { EquipIcon } from './EquipIcon'
import { portraitDropNormForDragDrop } from './portraitDropNorm'
import { portraitNeedsDuplicateSpeciesTint } from './duplicateSpeciesPortraitTint'
import { tentReplacementPortraitStackFilter } from './tentReplacementPortraitFilter'
import { currentTurn } from '../../game/state/combat'
import { PORTRAIT_TOAST_QUEUE_CAP } from '../../game/state/portraitToasts'
import { bumpPortraitCaptureHudRev } from './portraitCaptureHudRev'
import { paintTentReplacementPortraitStack } from './paintTentReplacementPortraitCanvas'
import styles from './PortraitPanel.module.css'

/** Per-row delay (ms) so co-timed portrait toasts do not animate in lockstep (older row = lower index = less offset). */
const PORTRAIT_TOAST_ROW_STAGGER_MS = 52

const VITAL_BAR_FILL: Record<'hp' | 'sta' | 'hun' | 'thr', string> = {
  hp: '#ff2400',
  sta: 'var(--hud-stamina-vital-fill)',
  hun: '#547d39',
  thr: '#3d75dd',
}

/** Matches feed clamp in `interactions.ts`. */
const HUNGER_THIRST_CAP = 100

/**
 * Mirrors the old `portraitToastFloat` keyframes, but as inline style samples so **html2canvas**
 * (dithered HUD capture) sees motion — cloned documents do not preserve CSS keyframe progress.
 */
function portraitToastMotion(elapsedMs: number, animMs: number, risePx: number): { opacity: number; translateY: number } {
  const d = Math.max(200, animMs)
  const u = Math.max(0, Math.min(1, elapsedMs / d))
  if (u >= 1) {
    return { opacity: 0, translateY: -risePx }
  }
  const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t)
  const ue = easeOutQuad(u)
  const y0 = risePx * 0.42
  const y1 = -risePx
  const translateY = y0 + (y1 - y0) * ue

  let opacity: number
  if (u <= 0.11) {
    opacity = easeOutQuad(u / 0.11)
  } else if (u <= 0.74) {
    opacity = 1
  } else {
    opacity = 1 - easeOutQuad((u - 0.74) / (1 - 0.74))
  }
  return { opacity, translateY }
}

/** Whole portrait column (face + vitals + equip mirror): nudge up vs grid cell. */
const PORTRAIT_COLUMN_NUDGE_UP_PX = 20

/** Order: row1 HP|STA, row2 HUN|THR. HP/STA use run-level maxima from `runProgression`. */
const PORTRAIT_VITAL_CELL_KEYS = ['hp', 'sta', 'hun', 'thr'] as const

function vitalFillRatio(key: (typeof PORTRAIT_VITAL_CELL_KEYS)[number], c: GameState['party']['chars'][number], state: GameState): number {
  const hm = Math.max(1, hpMax(state))
  const sm = Math.max(1, staminaMax(state))
  if (key === 'hp') return Math.max(0, Math.min(1, Math.min(c.hp, hm) / hm))
  if (key === 'sta') return Math.max(0, Math.min(1, Math.min(c.stamina, sm) / sm))
  if (key === 'hun') return Math.max(0, Math.min(1, c.hunger / HUNGER_THIRST_CAP))
  return Math.max(0, Math.min(1, c.thirst / HUNGER_THIRST_CAP))
}

type PortraitSprites =
  | { kind: 'simple'; baseSrc: string; eyesSrc: string; eyesInspectSrc?: string; mouthSrc: string; mouthClosedSrc?: string; idleSrc?: string }
  | {
      kind: 'frosh'
      baseSrc: string
      eyesSrcL: string
      eyesSrcR: string
      eyesInspectSrc?: string
      mouthSrc: string
      mouthClosedSrc?: string
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
  Afonso: {
    kind: 'simple',
    baseSrc: '/content/Afonso_base.png',
    eyesSrc: '/content/Afonso_eyes.png',
    eyesInspectSrc: '/content/Afonso_eyes_inspect.png',
    mouthSrc: '/content/Afonso_mouth_open.png',
    mouthClosedSrc: '/content/Afonso_mouth_closed.png',
    idleSrc: '/content/Afonso_base_idle.png',
  },
}

const SPECIES_FALLBACK_FACE: Record<string, string> = {
  Igor: '🧟',
  Mycyclops: '👁️',
  Frosch: '🐸',
  Afonso: '🧙',
}

export function PortraitPanel(props: {
  state: GameState
  dispatch: Dispatch<Action>
  content: ContentDB
  characterId: string
  captureForPostprocess?: boolean
  /** `translateX` on the whole column (portrait + vitals). `HudLayout`: **+n** left rail, **−n** right rail (mirror). */
  portraitColumnTranslateXPx?: number
}) {
  const { state, dispatch, content, characterId, captureForPostprocess = false, portraitColumnTranslateXPx } = props
  const cursor = useCursor()
  const nowMs = performance.now()
  const c = state.party.chars.find((x) => x.id === characterId) ?? null
  const isDead = c != null && c.hp <= 0
  const portrait = c ? SPECIES_PORTRAIT[c.species] : undefined
  const tentPortraitHueDeg = c?.tentReplacementPortraitHueDeg
  const tentPortraitSaturateMult = c?.tentReplacementPortraitSaturateMult
  const dupSpeciesTint =
    tentPortraitHueDeg == null && portraitNeedsDuplicateSpeciesTint(state.party.chars, characterId)
  /** Stack-level filter so hue is not masked by each `.sprite` `drop-shadow` filter. */
  const tentPortraitStackFilter =
    tentPortraitHueDeg != null && c != null
      ? tentReplacementPortraitStackFilter({
          hueDeg: tentPortraitHueDeg,
          isDead,
          saturateMultAlive: tentPortraitSaturateMult,
        })
      : undefined
  const spriteStackUsesCombinedFilter = tentPortraitStackFilter != null || dupSpeciesTint
  const portraitStackRef = useRef<HTMLDivElement | null>(null)
  const tentTintCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const tentTintSourceStackRef = useRef<HTMLDivElement | null>(null)
  const tentTintFilterRef = useRef('')
  /** `html2canvas` often drops CSS stack filters; bake pixels on a canvas for the capture HUD only. */
  const useTentTintCaptureCanvas = Boolean(tentPortraitStackFilter && captureForPostprocess)
  tentTintFilterRef.current = tentPortraitStackFilter ?? ''

  useEffect(() => {
    if (!useTentTintCaptureCanvas) return
    let id = 0
    const loop = () => {
      const canvas = tentTintCanvasRef.current
      const source = tentTintSourceStackRef.current
      const filter = tentTintFilterRef.current
      if (canvas && source && filter) {
        paintTentReplacementPortraitStack(canvas, source, filter)
      }
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [useTentTintCaptureCanvas])

  /** Dead stack/emoji tint includes grayscale; skip `.portraitDead .portraitArtClip` so it is not applied twice. */
  const suppressDeadClipGrayscale =
    isDead &&
    (spriteStackUsesCombinedFilter || (tentPortraitHueDeg != null && c != null && !portrait))
  const portraitBaseSrc = portrait?.baseSrc ?? ''
  const portraitEyesSrc = portrait && portrait.kind !== 'frosh' ? portrait.eyesSrc : ''
  const portraitEyesSrcL = portrait && portrait.kind === 'frosh' ? portrait.eyesSrcL : ''
  const portraitEyesSrcR = portrait && portrait.kind === 'frosh' ? portrait.eyesSrcR : ''
  const portraitEyesInspectSrc = portrait?.eyesInspectSrc ?? ''
  const portraitMouthSrc = portrait?.mouthSrc ?? ''
  const portraitMouthClosedSrc = portrait?.mouthClosedSrc ?? ''
  const portraitIdleSrc = portrait?.idleSrc ?? ''
  const [blinkClosed, setBlinkClosed] = useState(false)
  const [blinkClosedL, setBlinkClosedL] = useState(false)
  const [blinkClosedR, setBlinkClosedR] = useState(false)
  const [idleFlash, setIdleFlash] = useState(false)
  const [portraitAr, setPortraitAr] = useState<number>(1)
  /** Bumped via `setTimeout` at cue `untilMs` so visibility refreshes even when `time/tick` rAF is throttled. */
  const [, setPortraitClockNonce] = useState(0)

  const portraitToastSchedSig = useMemo(
    () =>
      (state.ui.portraitToasts ?? [])
        .filter((t) => t.characterId === characterId)
        .map((t) => `${t.id}:${Math.round(t.startedAtMs ?? 0)}:${Math.round(t.untilMs)}`)
        .join('|'),
    [characterId, state.ui.portraitToasts],
  )

  const bandageDecalSchedSig = useMemo(
    () =>
      (state.ui.portraitBandageDecals ?? [])
        .filter((d) => d.characterId === characterId && d.untilMs != null)
        .map((d) => `${d.id}:${Math.round(d.untilMs!)}`)
        .join('|'),
    [characterId, state.ui.portraitBandageDecals],
  )

  useEffect(() => {
    const bump = () => setPortraitClockNonce((n) => n + 1)
    const ids: number[] = []
    const scheduleWall = (untilMs: number) => {
      const delay = Math.max(0, untilMs - performance.now()) + 1
      ids.push(window.setTimeout(bump, delay))
    }

    const pulse = state.ui.portraitIdlePulse
    if (pulse?.characterId === characterId && pulse.untilMs > performance.now()) {
      scheduleWall(pulse.untilMs)
    }
    const mouth = state.ui.portraitMouth
    if (mouth?.characterId === characterId && mouth.untilMs > performance.now()) {
      scheduleWall(mouth.untilMs)
    }
    const gameNow = state.nowMs
    for (const t of state.ui.portraitToasts ?? []) {
      if (t.characterId === characterId && t.untilMs > gameNow) {
        const delay = Math.max(0, t.untilMs - gameNow) + 1
        ids.push(window.setTimeout(bump, delay))
      }
    }
    for (const d of state.ui.portraitBandageDecals ?? []) {
      if (d.characterId === characterId && d.untilMs != null && d.untilMs > gameNow) {
        const delay = Math.max(0, d.untilMs - gameNow) + 1
        ids.push(window.setTimeout(bump, delay))
      }
    }

    return () => {
      for (const id of ids) window.clearTimeout(id)
    }
    // Primitive deps only so unrelated `ui` object churn does not reset timers mid-pulse.
  }, [
    characterId,
    state.ui.portraitIdlePulse?.characterId,
    state.ui.portraitIdlePulse?.untilMs,
    state.ui.portraitMouth?.characterId,
    state.ui.portraitMouth?.untilMs,
    portraitToastSchedSig,
    bandageDecalSchedSig,
  ])

  useEffect(() => {
    let cancelled = false
    const timeoutIds: number[] = []
    if (!portrait || isDead) return

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
    isDead,
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
      prefetchImages([portraitBaseSrc, portraitEyesSrcL, portraitEyesSrcR, portraitEyesInspectSrc, portraitMouthSrc, portraitMouthClosedSrc, portraitIdleSrc])
    } else {
      prefetchImages([portraitBaseSrc, portraitEyesSrc, portraitEyesInspectSrc, portraitMouthSrc, portraitMouthClosedSrc, portraitIdleSrc])
    }
  }, [
    portrait?.kind,
    portraitBaseSrc,
    portraitEyesSrc,
    portraitEyesSrcL,
    portraitEyesSrcR,
    portraitEyesInspectSrc,
    portraitMouthSrc,
    portraitMouthClosedSrc,
    portraitIdleSrc,
  ])

  useEffect(() => {
    if (!portraitIdleSrc || isDead) return
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
    isDead,
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
  // In capture HUD mode, mouth/idle/inspect are usually compositor overlays (not capture-limited).
  /** Toasts sit above the portrait rect; compositor mouth is clipped to the portrait rect (see `CompositeShader`). */
  const compositorOwnsPortraitMouth = captureForPostprocess

  const showMouth =
    isDead
      ? false
      : compositorOwnsPortraitMouth
        ? false
        : isMouthCueActive
          ? cueFlickerOn
          : isHoveringMouth
  const mouthOpenActive = !isDead && (isMouthCueActive || isHoveringMouth)
  // When the compositor draws the mouth overlay, DOM mouth layers stay out of capture (dithered HUD path).
  // Feed flicker toggles `showMouth` while `mouthOpenActive` stays true — without this, closed mouth was gated
  // only on `!mouthOpenActive`, leaving empty frames on every flicker off-tick (Afonso `mouthClosedSrc`).
  const showClosedMouthSprite =
    !compositorOwnsPortraitMouth &&
    !!portrait?.mouthClosedSrc &&
    (!mouthOpenActive || (isMouthCueActive && !cueFlickerOn))
  const showEyesInspect = !isDead && !captureForPostprocess && isHoveringEyes && !!portrait && !!portrait.eyesInspectSrc
  const blinkHideEyes = isDead || (blinkClosed && !showEyesInspect)
  const blinkHideEyesL = isDead || (blinkClosedL && !showEyesInspect)
  const blinkHideEyesR = isDead || (blinkClosedR && !showEyesInspect)
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

  const pulse = state.ui.portraitIdlePulse
  const pulseIdle = !isDead && pulse?.characterId === characterId && pulse.untilMs > nowMs
  const pressedPortraitCharacterId = getPressedPortraitCharacterId(cursor.state)
  const pressIdle = !isDead && pressedPortraitCharacterId === characterId
  const showIdleForEyes = !isDead && (idleFlash || pulseIdle || pressIdle)
  // All idle (ambient, `portraitIdlePulse`, frame press) is rasterized in the offscreen capture HUD so
  // `uiTex` matches the interactive stack; the compositor does not draw player portrait idle (ADR-0311).
  const showIdleSprite = showIdleForEyes
  const idleHideEyes = !isDead && showIdleForEyes && !showEyesInspect
  const idleHideBase = !isDead && showIdleForEyes && !!portrait?.idleSrc && !showEyesInspect

  const prevCharacterIdForIdleCapRef = useRef(characterId)
  const prevIdleHideBaseRef = useRef(idleHideBase)
  const prevShowIdleSpriteCapRef = useRef(showIdleSprite)
  useEffect(() => {
    if (prevCharacterIdForIdleCapRef.current !== characterId) {
      prevCharacterIdForIdleCapRef.current = characterId
      prevIdleHideBaseRef.current = idleHideBase
      prevShowIdleSpriteCapRef.current = showIdleSprite
      return
    }
    const hideChanged = prevIdleHideBaseRef.current !== idleHideBase
    const spriteChanged = prevShowIdleSpriteCapRef.current !== showIdleSprite
    if (!hideChanged && !spriteChanged) return
    prevIdleHideBaseRef.current = idleHideBase
    prevShowIdleSpriteCapRef.current = showIdleSprite
    if (captureForPostprocess) {
      bumpPortraitCaptureHudRev()
    }
  }, [idleHideBase, showIdleSprite, characterId, captureForPostprocess])

  /** If mouth were baked into capture (compositor off), bump `pCapIdle` when open/closed changes; compositor path skips this. */
  const mouthCaptureBakeSigRef = useRef('')
  useEffect(() => {
    if (!captureForPostprocess || compositorOwnsPortraitMouth) return
    const sig = `${characterId}:${showMouth ? 1 : 0}:${showClosedMouthSprite ? 1 : 0}`
    if (mouthCaptureBakeSigRef.current === sig) return
    mouthCaptureBakeSigRef.current = sig
    bumpPortraitCaptureHudRev()
  }, [captureForPostprocess, compositorOwnsPortraitMouth, characterId, showMouth, showClosedMouthSprite])

  const prevIdleFlashBlinkCharRef = useRef(characterId)
  const prevIdleFlashForBlinkRef = useRef(idleFlash)
  useEffect(() => {
    if (prevIdleFlashBlinkCharRef.current !== characterId) {
      prevIdleFlashBlinkCharRef.current = characterId
      prevIdleFlashForBlinkRef.current = idleFlash
      return
    }
    if (prevIdleFlashForBlinkRef.current && !idleFlash) {
      setBlinkClosed(false)
      setBlinkClosedL(false)
      setBlinkClosedR(false)
    }
    prevIdleFlashForBlinkRef.current = idleFlash
  }, [idleFlash, characterId])

  if (!c) return null

  const turn = currentTurn(state)
  const combatActingPortrait =
    Boolean(state.combat) &&
    !state.ui.death &&
    state.ui.screen !== 'title' &&
    c.hp > 0 &&
    turn?.kind === 'pc' &&
    turn.id === characterId

  const showBandageBodyDrop = Boolean(
    !isDead &&
      cursor.state.dragging?.started &&
      state.party.items[cursor.state.dragging.payload.itemId]?.defId === 'BandageStrip',
  )
  const bandageDecals = (state.ui.portraitBandageDecals ?? []).filter(
    (d) => d.characterId === characterId && (d.untilMs == null || d.untilMs > state.nowMs),
  )

  const equipHud = getCharacterEquipmentHudModel(state, content, characterId)

  const statuses = c.statuses.map((s) => s.id)
  const statusText = statuses.length ? `Status: ${statuses.join(', ')}` : 'Status: —'

  const columnTx = portraitColumnTranslateXPx ?? 0
  const rootTransformParts: string[] = [`translateY(-${PORTRAIT_COLUMN_NUDGE_UP_PX}px)`]
  if (columnTx !== 0) rootTransformParts.unshift(`translateX(${columnTx}px)`)
  const rootNudgeStyle = { transform: rootTransformParts.join(' ') } satisfies React.CSSProperties

  const portraitToastRows = (state.ui.portraitToasts ?? [])
    .filter((t) => t.characterId === characterId && t.untilMs > state.nowMs)
    .slice(-PORTRAIT_TOAST_QUEUE_CAP)

  return (
    <div
      className={styles.root}
      style={rootNudgeStyle}
      onPointerCancel={cursor.cancelDrag}
      onPointerUp={(e) => {
        if (isDead) return
        const { drop } = cursor.endPointerUp(e)
        if (!drop) return
        dispatch({
          type: 'drag/drop',
          payload: drop.payload,
          target: drop.target,
          nowMs: performance.now(),
          ...portraitDropNormForDragDrop(drop.target, e.clientX, e.clientY),
        })
      }}
    >
      <div
        className={`${styles.portrait}${combatActingPortrait ? ` ${styles.portraitCombatActing}` : ''}${isDead ? ` ${styles.portraitDead}` : ''}${dupSpeciesTint ? ` ${styles.portraitDupSpeciesTint}` : ''}`}
        data-portrait-box="true"
        data-portrait-character-id={characterId}
        role="button"
        tabIndex={isDead ? -1 : 0}
        aria-label={c.name === c.species ? c.species : `${c.name}, ${c.species}`}
        onKeyDown={(e) => {
          if (isDead) return
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
        <div
          className={styles.portraitArtClip}
          aria-hidden="true"
          {...(suppressDeadClipGrayscale ? { 'data-portrait-dead-filter-on-stack': '' } : {})}
        >
          {portrait ? (
            <div
              ref={portraitStackRef}
              className={`${styles.spriteStack}${spriteStackUsesCombinedFilter ? ` ${styles.spriteStackCombinedFilter}` : ''}`}
              style={
                useTentTintCaptureCanvas
                  ? { filter: 'none' }
                  : tentPortraitStackFilter
                    ? { filter: tentPortraitStackFilter }
                    : undefined
              }
            >
              {useTentTintCaptureCanvas ? (
                <canvas ref={tentTintCanvasRef} className={styles.tentPortraitTintCanvas} aria-hidden />
              ) : null}
              <div
                ref={tentTintSourceStackRef}
                className={`${styles.tentPortraitSourceStack}${useTentTintCaptureCanvas ? ` ${styles.tentPortraitSourceStackHidden}` : ''}`}
              >
                <img
                  className={`${styles.sprite} ${idleHideBase ? styles.eyesHidden : ''}`}
                  src={portrait.baseSrc}
                  alt=""
                  draggable={false}
                />
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
                  <img
                    className={`${styles.sprite} ${blinkHideEyes || idleHideEyes ? styles.eyesHidden : ''}`}
                    src={portrait.eyesSrc}
                    alt=""
                    draggable={false}
                  />
                )}
                {portrait.idleSrc ? (
                  <img
                    className={`${styles.sprite} ${showIdleSprite ? '' : styles.idleHidden}`}
                    src={portrait.idleSrc}
                    alt=""
                    draggable={false}
                  />
                ) : null}
                {showClosedMouthSprite ? (
                  <img className={styles.sprite} src={portrait.mouthClosedSrc} alt="" draggable={false} />
                ) : null}
                {showMouth ? (
                  <img
                    key={mouthAnimKey}
                    className={`${styles.sprite} ${isMouthCueActive ? styles.mouthChomp : ''}`}
                    src={portrait.mouthSrc}
                    alt=""
                    draggable={false}
                  />
                ) : null}
              </div>
            </div>
          ) : (
            <div
              className={styles.layer}
              style={
                tentPortraitHueDeg != null && c != null
                  ? {
                      filter: tentReplacementPortraitStackFilter({
                        hueDeg: tentPortraitHueDeg,
                        isDead,
                        saturateMultAlive: tentPortraitSaturateMult,
                      }),
                    }
                  : undefined
              }
            >
              {SPECIES_FALLBACK_FACE[c.species] ?? '🙂'}
            </div>
          )}
        </div>

        {bandageDecals.length ? (
          <div className={styles.bandageDecalLayer} aria-hidden>
            {bandageDecals.map((d) => (
              <div
                key={d.id}
                className={styles.bandageDecal}
                style={{
                  left: `${d.u * 100}%`,
                  top: `${d.v * 100}%`,
                  transform: `translate(-50%, -50%) rotate(${d.rotateDeg}deg)`,
                }}
              >
                <ItemEmoji className={styles.bandageDecalEmoji} icon={{ kind: 'emoji', value: '🩹' }} />
              </div>
            ))}
          </div>
        ) : null}

        {showBandageBodyDrop ? (
          <div
            className={styles.bandageBodyDrop}
            data-drop-kind="portrait"
            data-drop-character-id={characterId}
            data-drop-portrait-target="body"
            aria-hidden
          />
        ) : null}

        {equipHud && equipHud.headDef && equipHud.headItem ? (
          <div
            className={styles.equipHat}
            aria-hidden="true"
            style={{
              height: `${state.render.portraitHatSlotHeightPctByDefId[equipHud.headDef.id] ?? 16}%`,
              left: `calc(8% + ${state.render.portraitHatOffsetXPctByDefId[equipHud.headDef.id] ?? 0}%)`,
              top: `${state.render.portraitHatOffsetYPctByDefId[equipHud.headDef.id] ?? 0}%`,
            }}
          >
            <EquipIcon def={equipHud.headDef} emojiClass={styles.equipHatEmoji} imgClass={styles.equipHatImg} />
          </div>
        ) : null}

        {equipHud?.showEquipHandsBand ? (
          <div className={styles.equipHandsBand} aria-hidden="true">
            <div className={styles.equipHandSlotLeft}>
              {equipHud.showEquipHandLeft && equipHud.leftHandDef && equipHud.leftHandItem ? (
                <EquipIcon def={equipHud.leftHandDef} emojiClass={styles.equipHandEmoji} imgClass={styles.equipHandImg} />
              ) : null}
            </div>
            <div className={styles.equipHandSlotRight}>
              {equipHud.showEquipHandRightTwoHand && equipHud.leftHandDef && equipHud.leftHandItem ? (
                <EquipIcon
                  def={equipHud.leftHandDef}
                  emojiClass={styles.equipHandEmojiTwoHand}
                  imgClass={styles.equipHandImgTwoHand}
                />
              ) : equipHud.showEquipHandRightOneHand && equipHud.rightHandDef && equipHud.rightHandItem ? (
                <EquipIcon def={equipHud.rightHandDef} emojiClass={styles.equipHandEmoji} imgClass={styles.equipHandImg} />
              ) : null}
            </div>
          </div>
        ) : null}

        {__debug ? (
          <div
            style={{
              position: 'absolute',
              left: 6,
              bottom: 6,
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
              bottom: 6,
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

        <div
          className={styles.statsOverlay}
          data-portrait-stats="true"
          aria-hidden="true"
        >
          <div className={styles.vitalGrid}>
            {PORTRAIT_VITAL_CELL_KEYS.map((key) => (
              <div key={key} className={styles.statCell}>
                <div className={styles.statBarTrack}>
                  <div
                    className={styles.statBarFill}
                    style={{
                      backgroundColor: VITAL_BAR_FILL[key],
                      width: `${Math.round(vitalFillRatio(key, c, state) * 10_000) / 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className={styles.statusLine} title={statusText}>
            {statusText}
          </div>
        </div>
        {portraitToastRows.length ? (
          <div
            className={styles.portraitToastStack}
            aria-hidden="true"
            style={{
              left: '50%',
              bottom: `calc(100% + ${state.render.portraitToastGapPx}px)`,
              transform: `translateX(calc(-50% + ${state.render.portraitToastOffsetXPx}px))`,
            }}
          >
            {portraitToastRows.map((t, rowIndex) => {
              const rise = Math.max(8, Math.round(state.render.portraitToastFloatPx))
              const animMs = Math.max(200, Math.round(state.render.portraitToastAnimMs))
              const ttlGuess = Math.max(400, Math.round(Number(state.render.portraitToastTtlMs ?? 1600)))
              const startMs = t.startedAtMs ?? Math.max(0, t.untilMs - ttlGuess)
              const elapsed = Math.max(0, state.nowMs - startMs - rowIndex * PORTRAIT_TOAST_ROW_STAGGER_MS)
              // Transforms don't affect flex layout; omit finished rows so invisible ghosts don't push the stack.
              if (elapsed >= animMs) return null
              const { opacity, translateY } = portraitToastMotion(elapsed, animMs, rise)
              return (
                <div
                  key={t.id}
                  className={`${styles.portraitToast} ${
                    t.kind === 'statDelta'
                      ? styles.portraitToast_statDelta
                      : t.kind === 'lowStat'
                        ? styles.portraitToast_lowStat
                        : styles.portraitToast_status
                  }`}
                  style={{
                    fontSize: state.render.portraitToastFontPx,
                    opacity,
                    transform: `translateY(${translateY}px)`,
                  }}
                >
                  {t.text}
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}

