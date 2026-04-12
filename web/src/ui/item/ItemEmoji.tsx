import type { CSSProperties } from 'react'
import { useLayoutEffect, useRef } from 'react'
import type { ItemDef, ItemEmojiIcon } from '../../game/content/contentDb'
import { renderItemEmojiIconToCanvas } from '../../game/renderItemEmojiIconCanvas'

/** CSS path for emoji with no `tintFilter` (tinted icons use `ItemEmojiCanvas`). */
export function itemEmojiInlineStyle(icon: ItemEmojiIcon): CSSProperties | undefined {
  const s = icon.displayScale
  const hasScale = s !== undefined && s !== 1
  const rot = icon.rotateDeg ?? 0
  const hasRotate = ((rot % 360) + 360) % 360 !== 0
  const flipH = icon.flipHorizontal === true
  const flipV = icon.flipVertical === true
  if (!hasScale && !hasRotate && !flipH && !flipV) return undefined
  const style: CSSProperties = {}
  const parts: string[] = []
  if (hasRotate) parts.push(`rotate(${rot}deg)`)
  if (hasScale) parts.push(`scale(${s})`)
  if (flipH) parts.push('scaleX(-1)')
  if (flipV) parts.push('scaleY(-1)')
  if (parts.length) {
    style.display = 'inline-block'
    style.transform = parts.join(' ')
    style.transformOrigin = 'center'
  }
  return style
}

/** Color emoji often ignore CSS `filter` on text; rasterize with canvas so `tintFilter` is visible. */
function ItemEmojiCanvas(props: { icon: ItemEmojiIcon; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useLayoutEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const src = renderItemEmojiIconToCanvas({
      glyph: props.icon.value,
      tintFilter: props.icon.tintFilter,
      displayScale: props.icon.displayScale,
      rotateDeg: props.icon.rotateDeg,
      flipHorizontal: props.icon.flipHorizontal,
      flipVertical: props.icon.flipVertical,
    })
    canvas.width = src.width
    canvas.height = src.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(src, 0, 0)
  }, [
    props.icon.value,
    props.icon.tintFilter,
    props.icon.displayScale,
    props.icon.rotateDeg,
    props.icon.flipHorizontal,
    props.icon.flipVertical,
  ])

  return (
    <canvas
      ref={ref}
      className={props.className}
      style={{
        width: '1em',
        height: '1em',
        display: 'block',
        objectFit: 'contain',
        verticalAlign: 'middle',
      }}
      aria-hidden
    />
  )
}

/** Renders a tinted/scaled emoji when `icon` is emoji; otherwise returns `null`. */
export function ItemEmoji(props: { icon: ItemDef['icon']; className?: string }) {
  if (props.icon.kind !== 'emoji') return null
  const icon = props.icon
  if (icon.tintFilter?.trim()) {
    return <ItemEmojiCanvas icon={icon} className={props.className} />
  }
  const style = itemEmojiInlineStyle(icon)
  return (
    <span className={props.className} style={style}>
      {icon.value}
    </span>
  )
}
