import { createContext, useContext } from 'react'

/** Uniform `transform: scale` factor from `FixedStageViewport` (same on X and Y). */
export const FixedStageOuterScaleContext = createContext(1)

export function useFixedStageOuterScale(): number {
  return useContext(FixedStageOuterScaleContext)
}
