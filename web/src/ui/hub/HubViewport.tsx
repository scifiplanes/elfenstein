import { useEffect, useState, type Dispatch, type RefObject } from 'react'
import type { Action } from '../../game/reducer'
import type { FloorType } from '../../procgen/types'
import type { GameState, HubNormRect } from '../../game/types'
import popup from '../shared/GamePopup.module.css'
import styles from './HubViewport.module.css'

export type HubViewportVariant = 'interactive' | 'capture'

const START_HUB_ART: Record<'village' | 'tavern', string> = {
  village: '/content/village.png',
  tavern: '/content/tavern_background.png',
}

const CAMP_TAVERN_BG = '/content/camp_tavern_background.png'

function campVillageSkinId(floorType: FloorType): 'village' | 'cave' | 'dungeon' {
  if (floorType === 'Cave') return 'cave'
  if (floorType === 'Dungeon') return 'dungeon'
  return 'village'
}

const START_VILLAGE_HOVER: Record<'tavern' | 'dungeon', string> = {
  tavern: '/content/village_tavern_hover.png',
  dungeon: '/content/village_dungeon_hover.png',
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
  onPointerEnter?: () => void
  onPointerLeave?: () => void
}) {
  const { rect, variant, className: extraClass, onActivate, onPointerEnter, onPointerLeave } = props
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
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
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
  const campSkin = campVillageSkinId(state.floor.floorType)
  const mainArtSrc =
    scene === 'village'
      ? camp
        ? `/content/camp_${campSkin}.png`
        : START_HUB_ART.village
      : camp
        ? CAMP_TAVERN_BG
        : START_HUB_ART.tavern
  const hs = state.hubHotspots
  const tavernFg = camp ? TAVERN_FG_CAMP : TAVERN_FG_START

  const [villageHover, setVillageHover] = useState<'tavern' | 'dungeon' | null>(null)
  useEffect(() => {
    if (scene !== 'village') setVillageHover(null)
  }, [scene])

  const villageHoverSrc =
    scene === 'village' && variant === 'interactive' && villageHover
      ? camp
        ? `/content/camp_${campSkin}_${villageHover === 'tavern' ? 'tavern' : 'dungeon'}_hover.png`
        : START_VILLAGE_HOVER[villageHover]
      : null

  return (
    <div className={styles.root} ref={viewportRef}>
      <img className={styles.art} src={mainArtSrc} alt="" draggable={false} />
      {villageHoverSrc ? (
        <img className={styles.villageHoverOverlay} src={villageHoverSrc} alt="" draggable={false} />
      ) : null}
      {scene === 'village' ? (
        <>
          <HotspotBox
            rect={hs.village.tavern}
            variant={variant}
            onActivate={variant === 'interactive' ? () => dispatch({ type: 'hub/goTavern' }) : undefined}
            onPointerEnter={variant === 'interactive' ? () => setVillageHover('tavern') : undefined}
            onPointerLeave={variant === 'interactive' ? () => setVillageHover(null) : undefined}
          />
          <HotspotBox
            rect={hs.village.cave}
            variant={variant}
            onActivate={variant === 'interactive' ? () => dispatch({ type: 'hub/enterDungeon' }) : undefined}
            onPointerEnter={variant === 'interactive' ? () => setVillageHover('dungeon') : undefined}
            onPointerLeave={variant === 'interactive' ? () => setVillageHover(null) : undefined}
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
