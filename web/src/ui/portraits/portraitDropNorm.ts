import type { DragTarget } from '../../game/types'

/** Normalized pointer position (0–1) within the character's `.portrait` frame, or null if not measurable. */
export function computePortraitDropNorm(characterId: string, clientX: number, clientY: number): { u: number; v: number } | null {
  if (typeof document === 'undefined') return null
  const safeId = typeof CSS !== 'undefined' && 'escape' in CSS ? CSS.escape(characterId) : characterId.replace(/"/g, '\\"')
  const el = document.querySelector(`[data-portrait-character-id="${safeId}"]`) as HTMLElement | null
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width <= 0 || r.height <= 0) return null
  return { u: (clientX - r.left) / r.width, v: (clientY - r.top) / r.height }
}

export function portraitDropNormForDragDrop(
  target: DragTarget,
  clientX: number,
  clientY: number,
): { portraitDropNorm?: { u: number; v: number } } {
  if (target.kind !== 'portrait' || target.target !== 'body') return {}
  const norm = computePortraitDropNorm(target.characterId, clientX, clientY)
  if (!norm) return {}
  return { portraitDropNorm: norm }
}
