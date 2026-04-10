import type { MutableRefObject } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { CursorApi } from './CursorContext'

/** Mark modal header/footer chrome buttons so `endPointerUp` can retarget `click` when `pointerup` hits a captured drag source instead. */
export const MODAL_CHROME_HIT_ATTR = 'data-modal-chrome-hit'

/**
 * Modal chrome (`button`) actions must not rely on synthetic `click` alone: ancestors (trade panel,
 * NPC/paperdoll backdrop) call `cursor.endPointerUp` on `pointerup`, which can drop the follow-up
 * `click` — same class of bug as portrait-frame taps (see `HudLayout` comment). Activate on
 * `pointerup` after `stopPropagation`, and ignore the redundant `click` via `suppressClickRef`.
 *
 * If a drag is active, we still handle chrome: **`stopPropagation`** (so parents don’t steal the
 * stream), **`cancelDrag`** (release capture / clear cursor state), then **activate** — the old
 * early-return left propagation enabled and never ran the action.
 */
export function modalChromePointerUpActivate(
  cursor: CursorApi,
  e: ReactPointerEvent<Element>,
  activate: () => void,
  suppressClickRef: MutableRefObject<boolean>,
): void {
  if (e.button !== 0) return
  e.stopPropagation()
  if (cursor.state.dragging?.started) {
    cursor.cancelDrag()
  }
  suppressClickRef.current = true
  activate()
  requestAnimationFrame(() => {
    suppressClickRef.current = false
  })
}

export function modalChromeClickActivate(
  e: ReactMouseEvent<Element>,
  activate: () => void,
  suppressClickRef: MutableRefObject<boolean>,
): void {
  e.stopPropagation()
  if (suppressClickRef.current) {
    e.preventDefault()
    return
  }
  activate()
}
