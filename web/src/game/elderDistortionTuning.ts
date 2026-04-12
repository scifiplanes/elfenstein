import type { ElderDistortionTuning } from './types'

export const DEFAULT_ELDER_DISTORTION: ElderDistortionTuning = {
  billboardAspect: 1,
  timeScale: 1,
  ellipseRx: 0.42,
  ellipseRy: 0.5,
  bodyEdgeStart: 0.72,
  bodyEdgeEnd: 1.05,
  noiseUvScale: 18,
  noiseTimeSpeed: 0.7,
  warpSinAmp: 0.028,
  warpCosAmp: 0.026,
  warpNoiseAmp: 0.018,
  warpPhaseX: 2.2,
  warpFreqY: 14,
  warpPhaseY: 1.9,
  warpFreqX: 11,
  sweepPhase: 3.1,
  sweepFreqY: 22,
  sweepFreqX: 16,
  pulsePhase: 4.7,
  pulseRadialFreq: 8,
  iridPhase: 1.8,
  iridFreqX: 9,
  baseTintMin: 0.35,
  baseTintBodyMul: 0.4,
  shimmerLow: 0.25,
  shimmerSweepMul: 0.55,
  shimmerPulseBase: 0.7,
  shimmerPulseAmp: 0.3,
  alphaEdgeStart: 0.88,
  alphaEdgeEnd: 1.12,
  alphaBase: 0.55,
  alphaBodyMul: 0.35,
  alphaSweepMul: 0.15,
  alphaMax: 0.92,
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Number(n)))
}

/** Clamps F2 / JSON values for the Elder procedural billboard shader. */
export function clampElderDistortion(
  input: Partial<ElderDistortionTuning> | ElderDistortionTuning,
): ElderDistortionTuning {
  const a = { ...DEFAULT_ELDER_DISTORTION, ...input }
  const bodyEdgeStart = clamp(a.bodyEdgeStart, 0.2, 1.5)
  let bodyEdgeEnd = clamp(a.bodyEdgeEnd, 0.4, 1.8)
  if (bodyEdgeEnd < bodyEdgeStart + 0.02) bodyEdgeEnd = bodyEdgeStart + 0.02
  let alphaEdgeStart = clamp(a.alphaEdgeStart, 0.5, 1.5)
  let alphaEdgeEnd = clamp(a.alphaEdgeEnd, 0.8, 1.8)
  if (alphaEdgeEnd < alphaEdgeStart + 0.02) alphaEdgeEnd = alphaEdgeStart + 0.02

  return {
    billboardAspect: clamp(a.billboardAspect, 0.25, 2),
    timeScale: clamp(a.timeScale, 0, 3),
    ellipseRx: clamp(a.ellipseRx, 0.15, 0.9),
    ellipseRy: clamp(a.ellipseRy, 0.15, 0.9),
    bodyEdgeStart,
    bodyEdgeEnd,
    noiseUvScale: clamp(a.noiseUvScale, 4, 48),
    noiseTimeSpeed: clamp(a.noiseTimeSpeed, 0, 2.5),
    warpSinAmp: clamp(a.warpSinAmp, 0, 0.12),
    warpCosAmp: clamp(a.warpCosAmp, 0, 0.12),
    warpNoiseAmp: clamp(a.warpNoiseAmp, 0, 0.08),
    warpPhaseX: clamp(a.warpPhaseX, 0, 8),
    warpFreqY: clamp(a.warpFreqY, 2, 40),
    warpPhaseY: clamp(a.warpPhaseY, 0, 8),
    warpFreqX: clamp(a.warpFreqX, 2, 40),
    sweepPhase: clamp(a.sweepPhase, 0, 10),
    sweepFreqY: clamp(a.sweepFreqY, 4, 60),
    sweepFreqX: clamp(a.sweepFreqX, 4, 60),
    pulsePhase: clamp(a.pulsePhase, 0, 12),
    pulseRadialFreq: clamp(a.pulseRadialFreq, 0, 24),
    iridPhase: clamp(a.iridPhase, 0, 6),
    iridFreqX: clamp(a.iridFreqX, 2, 40),
    baseTintMin: clamp(a.baseTintMin, 0, 1),
    baseTintBodyMul: clamp(a.baseTintBodyMul, 0, 1.2),
    shimmerLow: clamp(a.shimmerLow, 0, 1),
    shimmerSweepMul: clamp(a.shimmerSweepMul, 0, 1.2),
    shimmerPulseBase: clamp(a.shimmerPulseBase, 0, 1.2),
    shimmerPulseAmp: clamp(a.shimmerPulseAmp, 0, 0.8),
    alphaEdgeStart,
    alphaEdgeEnd,
    alphaBase: clamp(a.alphaBase, 0.1, 1),
    alphaBodyMul: clamp(a.alphaBodyMul, 0, 0.8),
    alphaSweepMul: clamp(a.alphaSweepMul, 0, 0.5),
    alphaMax: clamp(a.alphaMax, 0.2, 1),
  }
}
