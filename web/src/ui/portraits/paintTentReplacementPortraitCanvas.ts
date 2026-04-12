import styles from './PortraitPanel.module.css'

/** Matches `--portrait-art-nudge-y` in `PortraitPanel.module.css`. */
const PORTRAIT_ART_NUDGE_Y_PX = -30

export function spriteDrawRectForPortraitClip(
  nw: number,
  nh: number,
  cw: number,
  ch: number,
  nudgeYPx: number,
): { dx: number; dy: number; dw: number; dh: number } {
  const dh = ch
  const dw = Math.min((nw / nh) * dh, cw)
  const cx = cw * 0.5
  const cy = ch * 0.5 + nudgeYPx
  return { dx: cx - dw * 0.5, dy: cy - dh * 0.5, dw, dh }
}

/**
 * Composites visible portrait `<img>` layers (same stacking as `PortraitPanel`) and applies
 * `filterCss` in one pass so `html2canvas` sees real pixels (it often omits stack CSS filters).
 */
export function paintTentReplacementPortraitStack(
  canvas: HTMLCanvasElement,
  sourceStackEl: HTMLElement,
  filterCss: string,
): void {
  const host = canvas.parentElement
  if (!host) return
  const cw = Math.max(1, Math.round(host.clientWidth))
  const ch = Math.max(1, Math.round(host.clientHeight))
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)

  const pw = Math.max(1, Math.floor(cw * dpr))
  const ph = Math.max(1, Math.floor(ch * dpr))
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw
    canvas.height = ph
  }
  canvas.style.width = `${cw}px`
  canvas.style.height = `${ch}px`

  const scratch = document.createElement('canvas')
  scratch.width = pw
  scratch.height = ph
  const sctx = scratch.getContext('2d')
  const octx = canvas.getContext('2d')
  if (!sctx || !octx) return

  sctx.setTransform(1, 0, 0, 1, 0, 0)
  sctx.scale(dpr, dpr)
  sctx.clearRect(0, 0, cw, ch)

  const imgs = sourceStackEl.querySelectorAll('img')
  for (const node of imgs) {
    if (!(node instanceof HTMLImageElement)) continue
    if (node.classList.contains(styles.eyesHidden)) continue
    if (node.classList.contains(styles.idleHidden)) continue
    if (!node.complete || node.naturalWidth < 1 || node.naturalHeight < 1) continue
    const { dx, dy, dw, dh } = spriteDrawRectForPortraitClip(
      node.naturalWidth,
      node.naturalHeight,
      cw,
      ch,
      PORTRAIT_ART_NUDGE_Y_PX,
    )
    sctx.drawImage(node, dx, dy, dw, dh)
  }

  octx.setTransform(1, 0, 0, 1, 0, 0)
  octx.clearRect(0, 0, pw, ph)
  octx.filter = filterCss
  octx.drawImage(scratch, 0, 0)
  octx.filter = 'none'
}
