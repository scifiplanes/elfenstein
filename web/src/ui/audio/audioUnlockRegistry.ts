const unlockers: Array<() => void> = []

/** Subscribe for synchronous Web Audio unlock on a user gesture; returns unsubscribe. */
export function registerAudioUnlock(fn: () => void): () => void {
  unlockers.push(fn)
  return () => {
    const i = unlockers.indexOf(fn)
    if (i >= 0) unlockers.splice(i, 1)
  }
}

/** Call from a pointer/key handler only — must not await before contexts resume (iOS Safari). */
export function unlockAudioFromUserGesture(): void {
  for (const fn of unlockers) fn()
}
