/** Total Bobr intro duration; keep in sync with `TitleScreen.module.css` `bobrIntroOpacity` (8.6s). */
export const BOBR_INTRO_TOTAL_MS = 8600

/** True while the Bobr intro after title Start is playing (`ui.bobrIntroUntilMs` vs `nowMs`). */
export function isBobrIntroActive(state: { nowMs: number; ui: { bobrIntroUntilMs?: number } }): boolean {
  const until = state.ui.bobrIntroUntilMs
  return until != null && state.nowMs < until
}
