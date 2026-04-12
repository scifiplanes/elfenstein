import * as THREE from 'three'

type TexUserData = { paintVersion?: string }

function readBitmapSize(image: unknown): { w: number; h: number } {
  if (!image) return { w: 0, h: 0 }
  if (image instanceof HTMLImageElement) {
    return { w: image.naturalWidth || 0, h: image.naturalHeight || 0 }
  }
  if (image instanceof HTMLCanvasElement || (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap)) {
    return { w: image.width || 0, h: image.height || 0 }
  }
  return { w: 0, h: 0 }
}

/**
 * For tent-replacement portraits, compositor overlay sprites (mouth, eyes inspect) must match the
 * same CSS color recipe as `tentReplacementPortraitFilterCss` — raw PNGs would read as a different hue
 * than the baked / CSS-tinted portrait stack (`DitheredFrameRoot` + `CompositeShader`).
 */
export function ensureTentTintedPortraitOverlayTexture(
  baseTex: THREE.Texture | null,
  filterCss: string,
  stableCacheKey: string,
  cache: Map<string, THREE.CanvasTexture>,
): THREE.Texture | null {
  if (!baseTex) return null
  const { w, h } = readBitmapSize(baseTex.image)
  if (w < 1 || h < 1) return baseTex

  let out = cache.get(stableCacheKey)
  if (!out) {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    out = new THREE.CanvasTexture(canvas)
    out.colorSpace = THREE.SRGBColorSpace
    out.minFilter = THREE.LinearFilter
    out.magFilter = THREE.LinearFilter
    out.generateMipmaps = false
    cache.set(stableCacheKey, out)
  } else {
    const canvas = out.image as HTMLCanvasElement
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
  }

  const paintVersion = `${stableCacheKey}@${w}x${h}@${baseTex.version}`
  const ud = out.userData as TexUserData
  if (ud.paintVersion === paintVersion) return out

  const canvas = out.image as HTMLCanvasElement
  const ctx = canvas.getContext('2d')
  if (!ctx) return baseTex

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.filter = filterCss
  ctx.drawImage(baseTex.image as CanvasImageSource, 0, 0, w, h)
  ctx.filter = 'none'
  ud.paintVersion = paintVersion
  out.needsUpdate = true
  return out
}
