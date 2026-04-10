/** Bumped when capture-HUD portrait art changes outside `GameState` (e.g. random idle flash). */
let portraitCaptureHudRev = 0

export function bumpPortraitCaptureHudRev(): void {
  portraitCaptureHudRev += 1
}

export function getPortraitCaptureHudRev(): number {
  return portraitCaptureHudRev
}
