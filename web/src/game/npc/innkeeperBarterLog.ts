/** Pushed once when entering the **starting** hub **tavern** scene (`hub/goTavern`), before the trade modal. */
export const INNKEEPER_OPEN_TRADE_ACTIVITY_LOG =
  'The innkeeper lingers in quiet suspension, waiting for a deal to be struck.'

/** Activity-log lines after each successful hub innkeeper barter (offer + request). After 10, use `DEAL_DONE`. */
const LINES: readonly string[] = [
  'You made a trade — now wear the name of businessman with pride.',
  'Two deals done, and the market begins to whisper your name.',
  "Three trades deep — you're no longer testing the waters, you're sailing them.",
  'Four moves made, each one sharper than the last — the board is yours to study.',
  'Halfway to mastery, and the numbers speak where words once stumbled.',
  "Six trades forged — you've tasted loss and profit both, and hunger still.",
  'Seven exchanges carved into your record — rivals are starting to take notes.',
  'Eight deals closed, and the market no longer feels like a storm — it feels like a rhythm.',
  'Nine trades in, and the boardroom door stands just one move away.',
  'Ten trades. Ten lessons. Ten victories written in ink and instinct. Welcome, MBA.',
]

export const INNKEEPER_BARTER_LOG_AFTER_TEN = 'Deal has been done.'

/** `completedBarterCount` is 1-based (first successful barter → 1). */
export function innkeeperBarterActivityLogLine(completedBarterCount: number): string {
  if (completedBarterCount < 1) return LINES[0]!
  if (completedBarterCount > 10) return INNKEEPER_BARTER_LOG_AFTER_TEN
  return LINES[completedBarterCount - 1]!
}
