import { createContext, useContext } from 'react'

/** DOM mount for the visible title Bobr intro (above `presentCanvas`, outside `opacity: 0` interactive HUD). */
export const TitleCutscenePortalContext = createContext<HTMLDivElement | null>(null)

export function useTitleCutscenePortalEl(): HTMLDivElement | null {
  return useContext(TitleCutscenePortalContext)
}
