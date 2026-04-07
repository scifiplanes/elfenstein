import { type PropsWithChildren, useLayoutEffect, useState } from 'react'
import { FixedStageOuterScaleContext } from './FixedStageContext'
import styles from './FixedStageViewport.module.css'
import { STAGE_CSS_HEIGHT, STAGE_CSS_WIDTH, STAGE_OUTLINE_PX } from './stageDesign'

/**
 * Uniform scale: never upscale past 1 — the game+HUD box stays **1920×1080 CSS px** on large
 * / HiDPI viewports (black margins). Smaller viewports shrink so it still fits.
 */
function viewportCssSize(): { w: number; h: number } {
  const vv = window.visualViewport
  if (vv && vv.width > 0 && vv.height > 0) {
    return { w: vv.width, h: vv.height }
  }
  return { w: window.innerWidth, h: window.innerHeight }
}

function computeScale(): number {
  const { w, h } = viewportCssSize()
  return Math.min(1, w / STAGE_CSS_WIDTH, h / STAGE_CSS_HEIGHT)
}

export function FixedStageViewport(props: PropsWithChildren) {
  const [scale, setScale] = useState(computeScale)

  useLayoutEffect(() => {
    const update = () => setScale(computeScale())
    update()
    window.addEventListener('resize', update)
    const vv = window.visualViewport
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    return () => {
      window.removeEventListener('resize', update)
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
    }
  }, [])

  return (
    <FixedStageOuterScaleContext.Provider value={scale}>
      <div className={styles.shell}>
        <div
          className={styles.clip}
          style={{
            width: STAGE_CSS_WIDTH * scale,
            height: STAGE_CSS_HEIGHT * scale,
            outline: `${STAGE_OUTLINE_PX}px solid #fff`,
            outlineOffset: -STAGE_OUTLINE_PX,
          }}
        >
          <div
            className={styles.stage}
            style={{
              width: STAGE_CSS_WIDTH,
              height: STAGE_CSS_HEIGHT,
              transform: `scale(${scale})`,
            }}
          >
            {props.children}
          </div>
        </div>
      </div>
    </FixedStageOuterScaleContext.Provider>
  )
}
