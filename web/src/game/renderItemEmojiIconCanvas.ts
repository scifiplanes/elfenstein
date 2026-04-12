/** Square texture for item emoji billboards and tinted HUD canvases. */
export const ITEM_ICON_CANVAS_SIZE = 128

/** Match `index.css` `--sans` + emoji fallbacks (inventory uses emoji at ~55px; canvas uses fixed px size). */
export const ITEM_ICON_CANVAS_FONT =
  '96px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, "Apple Color Emoji", "Segoe UI Emoji", sans-serif'

export type RenderItemEmojiIconOpts = {
  glyph: string
  tintFilter?: string
  displayScale?: number
  rotateDeg?: number
  flipHorizontal?: boolean
  flipVertical?: boolean
}

/**
 * Renders item emoji + faux drop shadow into a square canvas.
 * When `tintFilter` is set, applies CSS filters in a **second** `drawImage` pass.
 * Filtering only during `fillText` often fails to recolor platform color emoji; filtering
 * the composed bitmap matches browser behavior for inventory CSS `filter` on raster content.
 */
export function renderItemEmojiIconToCanvas(opts: RenderItemEmojiIconOpts): HTMLCanvasElement {
  const { glyph, tintFilter, displayScale, rotateDeg, flipHorizontal, flipVertical } = opts
  const W = ITEM_ICON_CANVAS_SIZE
  const H = ITEM_ICON_CANVAS_SIZE
  const cx = W / 2
  const cy = H / 2

  const scratch = document.createElement('canvas')
  scratch.width = W
  scratch.height = H
  const sctx = scratch.getContext('2d')
  if (!sctx) throw new Error('2D canvas unavailable')

  sctx.clearRect(0, 0, W, H)
  sctx.textAlign = 'center'
  sctx.textBaseline = 'middle'
  sctx.font = ITEM_ICON_CANVAS_FONT
  sctx.filter = 'none'

  const scale = displayScale != null && displayScale !== 1 ? displayScale : 1
  const rotDeg = rotateDeg ?? 0
  const rotRad = ((rotDeg % 360) + 360) % 360 !== 0 ? (rotDeg * Math.PI) / 180 : 0

  sctx.save()
  sctx.translate(cx, cy)
  if (rotRad !== 0) sctx.rotate(rotRad)
  sctx.scale(scale, scale)
  if (flipHorizontal) sctx.scale(-1, 1)
  if (flipVertical) sctx.scale(1, -1)
  sctx.translate(-cx, -cy)

  sctx.fillStyle = 'rgba(0,0,0,0.55)'
  sctx.fillText(glyph, cx + 4, cy + 6)
  sctx.fillStyle = 'rgba(255,255,255,0.92)'
  sctx.fillText(glyph, cx, cy)
  sctx.restore()

  const tint = tintFilter?.trim()
  if (!tint) return scratch

  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  const octx = out.getContext('2d')
  if (!octx) throw new Error('2D canvas unavailable')
  octx.filter = tint
  octx.drawImage(scratch, 0, 0)
  octx.filter = 'none'

  return out
}
