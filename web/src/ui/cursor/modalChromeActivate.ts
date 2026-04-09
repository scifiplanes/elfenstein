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
    // #region agent log
    fetch('http://127.0.0.1:7778/ingest/894c4eea-1ecd-42c9-95f9-1525a8a4b392', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '9e1d47' },
      body: JSON.stringify({
        sessionId: '9e1d47',
        runId: 'post-fix3',
        hypothesisId: 'V3',
        location: 'modalChromeActivate.ts:pointerUp',
        message: 'modal chrome: cancelDrag then activate (was active drag)',
        data: { tag: (e.target as HTMLElement)?.tagName },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
  }
  suppressClickRef.current = true
  activate()
  // #region agent log
  fetch('http://127.0.0.1:7778/ingest/894c4eea-1ecd-42c9-95f9-1525a8a4b392', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '9e1d47' },
    body: JSON.stringify({
      sessionId: '9e1d47',
      runId: 'post-fix3',
      hypothesisId: 'V1',
      location: 'modalChromeActivate.ts:pointerUp',
      message: 'modal chrome activated on pointerup',
      data: { tag: (e.target as HTMLElement)?.tagName },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7778/ingest/894c4eea-1ecd-42c9-95f9-1525a8a4b392', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '9e1d47' },
      body: JSON.stringify({
        sessionId: '9e1d47',
      runId: 'post-fix3',
      hypothesisId: 'V2',
        location: 'modalChromeActivate.ts:click',
        message: 'modal chrome click deduped after pointerup',
        data: { tag: (e.target as HTMLElement)?.tagName },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
    return
  }
  activate()
}
