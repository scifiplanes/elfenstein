import type { Dispatch } from 'react'
import { useEffect } from 'react'
import type { Action } from '../../game/reducer'
import type { GameState } from '../../game/types'
import styles from './NavigationPanel.module.css'

const NAV = '/content/ui/navigation'

/** Stable ids so the dual HUD (interactive + capture) can share “pushed” visuals. */
export type NavPadButtonId = 'turnLeft' | 'forward' | 'turnRight' | 'strafeLeft' | 'back' | 'strafeRight'

const navigationAssets = {
  defaultBg: `${NAV}/ui_navigationbutton_default.png`,
  pushedBg: `${NAV}/ui_navigationbutton_pushed.png`,
  forward: `${NAV}/ui_navigationbutton_direction_arrowup.png`,
  back: `${NAV}/ui_navigationbutton_direction_arrowdown.png`,
  strafeLeft: `${NAV}/ui_navigationbutton_direction_arrowleft.png`,
  strafeRight: `${NAV}/ui_navigationbutton_direction_arrowright.png`,
  turnLeft: `${NAV}/ui_navigationbutton_direction_arrowturnleft.png`,
  turnRight: `${NAV}/ui_navigationbutton_direction_arrowturnright.png`,
} as const

const preloadUrls = Object.values(navigationAssets)

function NavPadButton(props: {
  busy: boolean
  buttonId: NavPadButtonId
  pressedButtonId: NavPadButtonId | null
  directionSrc: string
  title: string
  ariaLabel: string
  onPress: () => void
}) {
  const { busy, buttonId, pressedButtonId, directionSrc, title, ariaLabel, onPress } = props
  const pushed = pressedButtonId === buttonId

  return (
    <button
      type="button"
      className={styles.navBtn}
      data-navpad-button-id={buttonId}
      disabled={busy}
      title={title}
      aria-label={ariaLabel}
      onClick={() => {
        if (busy) return
        onPress()
      }}
    >
      <span
        className={styles.btnBg}
        style={{
          backgroundImage: `url(${pushed ? navigationAssets.pushedBg : navigationAssets.defaultBg})`,
        }}
        aria-hidden
      />
      <span
        className={styles.direction}
        style={{ backgroundImage: `url(${directionSrc})` }}
        role="presentation"
        aria-hidden
      />
    </button>
  )
}

export function NavigationPanel(props: {
  state: GameState
  dispatch: Dispatch<Action>
  /** Which pad cell shows `ui_navigationbutton_pushed.png` (must be shared by interactive + capture HUD). */
  pressedButtonId: NavPadButtonId | null
  /** Called before dispatch so both HUD trees update the same pressed id. */
  onNavPadVisualPress: (id: NavPadButtonId) => void
}) {
  const { state, dispatch, pressedButtonId, onNavPadVisualPress } = props
  const busy = Boolean(state.view.anim)

  useEffect(() => {
    for (const src of preloadUrls) {
      const img = new Image()
      img.decoding = 'async'
      img.src = src
    }
  }, [])

  const press = (id: NavPadButtonId, activate: () => void) => {
    onNavPadVisualPress(id)
    activate()
  }

  return (
    <div className={styles.root} aria-label="On-screen movement">
      <div className={styles.grid}>
        <NavPadButton
          busy={busy}
          buttonId="turnLeft"
          pressedButtonId={pressedButtonId}
          directionSrc={navigationAssets.turnLeft}
          title="Turn left (Q)"
          ariaLabel="Turn left"
          onPress={() => press('turnLeft', () => dispatch({ type: 'player/turn', dir: -1 }))}
        />
        <NavPadButton
          busy={busy}
          buttonId="forward"
          pressedButtonId={pressedButtonId}
          directionSrc={navigationAssets.forward}
          title="Forward (W)"
          ariaLabel="Step forward"
          onPress={() => press('forward', () => dispatch({ type: 'player/step', forward: 1 }))}
        />
        <NavPadButton
          busy={busy}
          buttonId="turnRight"
          pressedButtonId={pressedButtonId}
          directionSrc={navigationAssets.turnRight}
          title="Turn right (E)"
          ariaLabel="Turn right"
          onPress={() => press('turnRight', () => dispatch({ type: 'player/turn', dir: 1 }))}
        />
        <NavPadButton
          busy={busy}
          buttonId="strafeLeft"
          pressedButtonId={pressedButtonId}
          directionSrc={navigationAssets.strafeLeft}
          title="Strafe left (A)"
          ariaLabel="Strafe left"
          onPress={() => press('strafeLeft', () => dispatch({ type: 'player/strafe', side: -1 }))}
        />
        <NavPadButton
          busy={busy}
          buttonId="back"
          pressedButtonId={pressedButtonId}
          directionSrc={navigationAssets.back}
          title="Back (S)"
          ariaLabel="Step back"
          onPress={() => press('back', () => dispatch({ type: 'player/step', forward: -1 }))}
        />
        <NavPadButton
          busy={busy}
          buttonId="strafeRight"
          pressedButtonId={pressedButtonId}
          directionSrc={navigationAssets.strafeRight}
          title="Strafe right (D)"
          ariaLabel="Strafe right"
          onPress={() => press('strafeRight', () => dispatch({ type: 'player/strafe', side: 1 }))}
        />
      </div>
    </div>
  )
}
