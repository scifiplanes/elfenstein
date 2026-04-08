import type { CursorState } from './CursorContext'

export function getPressedPortraitCharacterId(cursorState: CursorState): string | null {
  if (!cursorState.isPointerDown) return null
  const p = cursorState.pointer
  const el = document.elementFromPoint(p.x, p.y)
  const node = (el as Element | null)?.closest?.('[data-portrait-character-id]') as HTMLElement | null
  return node?.getAttribute?.('data-portrait-character-id') ?? null
}

