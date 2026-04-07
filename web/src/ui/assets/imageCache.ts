type LoadOpts = {
  crossOrigin?: '' | 'anonymous' | 'use-credentials'
}

type CacheEntry = {
  img: HTMLImageElement
  lastUsedAt: number
}

const DEFAULT_MAX_IMAGES = 96

const loaded = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<HTMLImageElement>>()

function pruneIfNeeded(maxImages: number) {
  const max = Math.max(1, Math.floor(maxImages))
  if (loaded.size <= max) return

  // Evict least-recently-used entries.
  const entries = Array.from(loaded.entries())
  entries.sort((a, b) => a[1].lastUsedAt - b[1].lastUsedAt)
  const evictCount = Math.max(0, entries.length - max)
  for (let i = 0; i < evictCount; i++) {
    loaded.delete(entries[i][0])
  }
}

function touch(src: string) {
  const e = loaded.get(src)
  if (!e) return
  e.lastUsedAt = performance.now()
}

export function loadImage(src: string, opts: LoadOpts = {}): Promise<HTMLImageElement> {
  if (!src) return Promise.reject(new Error('loadImage: empty src'))

  const cached = loaded.get(src)
  if (cached) {
    touch(src)
    return Promise.resolve(cached.img)
  }

  const existing = inflight.get(src)
  if (existing) return existing

  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    if (opts.crossOrigin != null) img.crossOrigin = opts.crossOrigin
    img.onload = () => {
      inflight.delete(src)
      loaded.set(src, { img, lastUsedAt: performance.now() })
      pruneIfNeeded(DEFAULT_MAX_IMAGES)
      resolve(img)
    }
    img.onerror = () => {
      inflight.delete(src)
      reject(new Error(`loadImage: failed to load ${src}`))
    }
    img.src = src
  })

  inflight.set(src, p)
  return p
}

export function prefetchImages(srcs: Array<string | undefined | null>) {
  for (const src of srcs) {
    if (!src) continue
    // Fire-and-forget; errors are intentionally ignored for prefetch.
    void loadImage(src).catch(() => {})
  }
}

