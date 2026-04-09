import type { Dispatch, RefObject } from 'react'
import type { Action } from '../../game/reducer'
import type { GameState, HubNormRect } from '../../game/types'
import styles from './HubViewport.module.css'

export type HubViewportVariant = 'interactive' | 'capture'

const HUB_ART: Record<'village' | 'tavern', string> = {
  village: '/content/village.png',
  tavern: '/content/tavern_background.png',
}

const TAVERN_FG = '/content/tavern_foreground.png'

function bartenderArtUrl(nowMs: number): string {
  const blinkWindow = nowMs % 3200
  if (blinkWindow > 3040 && blinkWindow < 3180) return '/content/bartender_blink.png'
  return Math.floor(nowMs / 2400) % 2 === 0 ? '/content/bartender_base.png' : '/content/bartender_idle.png'
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n))
}

function HotspotBox(props: {
  rect: HubNormRect
  variant: HubViewportVariant
  onActivate?: () => void
}) {
  const { rect, variant, onActivate } = props
  const x = clamp01(rect.x) * 100
  const y = clamp01(rect.y) * 100
  const w = clamp01(rect.w) * 100
  const h = clamp01(rect.h) * 100
  const className = `${styles.hotspot} ${variant === 'capture' ? styles.hotspotCapture : ''}`

  if (variant === 'capture' || !onActivate) {
    return (
      <div
        className={className}
        style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }}
        aria-hidden
      />
    )
  }

  return (
    <button
      type="button"
      className={className}
      style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }}
      onClick={() => onActivate()}
    />
  )
}

export function HubViewport(props: {
  state: GameState
  dispatch: Dispatch<Action>
  viewportRef?: RefObject<HTMLDivElement | null>
  variant?: HubViewportVariant
}) {
  const { state, dispatch, viewportRef, variant = 'interactive' } = props
  const scene = state.ui.hubScene ?? 'village'
  const src = HUB_ART[scene]
  const hs = state.hubHotspots

  return (
    <div className={styles.root} ref={viewportRef}>
      <img className={styles.art} src={src} alt="" draggable={false} />
      {scene === 'village' ? (
        <>
          <HotspotBox
            rect={hs.village.tavern}
            variant={variant}
            onActivate={variant === 'interactive' ? () => dispatch({ type: 'hub/goTavern' }) : undefined}
          />
          <HotspotBox
            rect={hs.village.cave}
            variant={variant}
            onActivate={variant === 'interactive' ? () => dispatch({ type: 'hub/enterDungeon' }) : undefined}
          />
        </>
      ) : (
        <>
          <div
            className={styles.bartender}
            style={{
              left: `${clamp01(hs.tavern.innkeeper.x) * 100}%`,
              top: `${clamp01(hs.tavern.innkeeper.y) * 100}%`,
              width: `${clamp01(hs.tavern.innkeeper.w) * 100}%`,
              height: `${clamp01(hs.tavern.innkeeper.h) * 100}%`,
            }}
          >
            <img
              className={styles.bartenderImg}
              src={bartenderArtUrl(state.nowMs)}
              alt=""
              draggable={false}
              style={{
                transform: `scale(${state.render.hubInnkeeperSpriteScale})`,
                transformOrigin: 'bottom center',
              }}
            />
          </div>
          <HotspotBox
            rect={hs.tavern.innkeeper}
            variant={variant}
            onActivate={variant === 'interactive' ? () => dispatch({ type: 'hub/openTavernTrade' }) : undefined}
          />
          <HotspotBox
            rect={hs.tavern.exit}
            variant={variant}
            onActivate={variant === 'interactive' ? () => dispatch({ type: 'hub/goVillage' }) : undefined}
          />
          <img className={styles.foreground} src={TAVERN_FG} alt="" draggable={false} />
        </>
      )}
    </div>
  )
}
