import type { Dispatch, RefObject } from 'react'
import type { Action } from '../../game/reducer'
import type { GameState, HubNormRect } from '../../game/types'
import popup from '../shared/GamePopup.module.css'
import styles from './HubViewport.module.css'

export type HubViewportVariant = 'interactive' | 'capture'

const START_HUB_ART: Record<'village' | 'tavern', string> = {
  village: '/content/village.png',
  tavern: '/content/tavern_background.png',
}

const CAMP_HUB_ART: Record<'village' | 'tavern', string> = {
  village: '/content/camp_village.png',
  tavern: '/content/camp_tavern_background.png',
}

const TAVERN_FG_START = '/content/tavern_foreground.png'
const TAVERN_FG_CAMP = '/content/camp_tavern_foreground.png'

function bartenderArtUrl(nowMs: number, camp: boolean): string {
  const blinkWindow = nowMs % 3200
  const base = camp ? '/content/camp_bartender' : '/content/bartender'
  if (blinkWindow > 3040 && blinkWindow < 3180) return `${base}_blink.png`
  return Math.floor(nowMs / 2400) % 2 === 0 ? `${base}_base.png` : `${base}_idle.png`
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n))
}

function HotspotBox(props: {
  rect: HubNormRect
  variant: HubViewportVariant
  className?: string
  onActivate?: () => void
}) {
  const { rect, variant, className: extraClass, onActivate } = props
  const x = clamp01(rect.x) * 100
  const y = clamp01(rect.y) * 100
  const w = clamp01(rect.w) * 100
  const h = clamp01(rect.h) * 100
  const className = [styles.hotspot, variant === 'capture' ? styles.hotspotCapture : '', extraClass].filter(Boolean).join(' ')

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
  const camp = state.ui.hubKind === 'camp'
  const artMap = camp ? CAMP_HUB_ART : START_HUB_ART
  const src = artMap[scene]
  const hs = state.hubHotspots
  const tavernFg = camp ? TAVERN_FG_CAMP : TAVERN_FG_START

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
              src={bartenderArtUrl(state.nowMs, camp)}
              alt=""
              draggable={false}
              style={{
                transform: `scale(${state.render.hubInnkeeperSpriteScale})`,
                transformOrigin: 'bottom center',
              }}
            />
          </div>
          <img className={styles.foreground} src={tavernFg} alt="" draggable={false} />
          <HotspotBox
            rect={hs.tavern.innkeeperTrade}
            variant={variant}
            className={styles.hotspotTrade}
            onActivate={variant === 'interactive' ? () => dispatch({ type: 'hub/openTavernTrade' }) : undefined}
          />
          <button
            type="button"
            className={`${popup.close} ${styles.tavernLeaveBtn}`}
            aria-label="Leave tavern"
            tabIndex={variant === 'capture' ? -1 : 0}
            disabled={variant === 'capture'}
            onClick={variant === 'interactive' ? () => dispatch({ type: 'hub/goVillage' }) : undefined}
          >
            Leave tavern
          </button>
        </>
      )}
    </div>
  )
}
