/**
 * Scenarios for `pipelineBenchMatrix.spec.ts` (Playwright `deviceScaleFactor` + bench URL params).
 * Keep names stable; they appear in the matrix summary table.
 */
export type PipelineBenchMatrixRow = {
  name: string
  /** Playwright `browser.newContext({ deviceScaleFactor })` */
  deviceScaleFactor: number
  /** Passed to `runPipelineBench` / URL `cap` */
  pixelRatioCap: number
  gameCssW?: number
  gameCssH?: number
}

export const PIPELINE_BENCH_MATRIX: PipelineBenchMatrixRow[] = [
  { name: '1× DPR, cap 1.5 (default)', deviceScaleFactor: 1, pixelRatioCap: 1.5 },
  { name: '1× DPR, cap 1.0 (low tier)', deviceScaleFactor: 1, pixelRatioCap: 1.0 },
  { name: '2× DPR, cap 1.5 (Retina, high tier)', deviceScaleFactor: 2, pixelRatioCap: 1.5 },
  { name: '2× DPR, cap 1.25 (balanced tier)', deviceScaleFactor: 2, pixelRatioCap: 1.25 },
  { name: '2× DPR, cap 1.0 (clamp DPR)', deviceScaleFactor: 2, pixelRatioCap: 1.0 },
  { name: '2× DPR, large game rect', deviceScaleFactor: 2, pixelRatioCap: 1.5, gameCssW: 1400, gameCssH: 790 },
  { name: '3× DPR, cap 1.5 (dense mobile-class)', deviceScaleFactor: 3, pixelRatioCap: 1.5 },
]
