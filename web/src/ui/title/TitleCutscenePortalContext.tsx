import { createContext, useContext } from 'react'

/** DOM mount for the visible Bobr intro (above `presentCanvas`, outside `opacity: 0` interactive HUD); hub runs underneath during the intro. */
export const TitleCutscenePortalContext = createContext<HTMLDivElement | null>(null)

export function useTitleCutscenePortalEl(): HTMLDivElement | null {
  return useContext(TitleCutscenePortalContext)
}
