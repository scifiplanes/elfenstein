/**
 * Interactive portaled modals (death, NPC dialog) must match the **capture** subtree laid out in
 * `HudLayout`’s `.npcCaptureLayer` (see `captureNpcOverlay`). That layer uses padding; the raw
 * `GameViewport` ref fills the whole `.panel.game` cell, which is **larger** than the padded box.
 *
 * Keep padding in sync with `HudLayout.module.css` `.npcCaptureLayer`.
 */
export const NPC_CAPTURE_LAYER_PADDING = { top: 10, left: 6, right: 6, bottom: 0 } as const

export type ModalViewportRect = { left: number; top: number; width: number; height: number }

/** `gameViewportEl` = `GameViewport` / hub viewport root; its parent is `.panel.game`. */
export function npcCaptureInteractiveRectFromGameViewportEl(gameViewportEl: HTMLElement | null): ModalViewportRect | null {
  const panel = gameViewportEl?.parentElement
  if (!panel) return null
  const r = panel.getBoundingClientRect()
  const pad = NPC_CAPTURE_LAYER_PADDING
  const w = r.width - pad.left - pad.right
  const h = r.height - pad.top - pad.bottom
  if (!(w > 0 && h > 0)) return null
  return {
    left: r.left + pad.left,
    top: r.top + pad.top,
    width: w,
    height: h,
  }
}
