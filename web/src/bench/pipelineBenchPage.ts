import { formatBenchReport, runPipelineBench } from './runPipelineBench'

const pre = document.createElement('pre')
pre.style.cssText =
  'font:13px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space:pre-wrap; padding:16px; margin:0; max-width:900px;'
document.body.style.cssText = 'margin:0;background:#0a0a0c;color:#e8e6e3;'
document.body.appendChild(pre)

pre.textContent = 'Running pipeline benchmark…'

const params = new URLSearchParams(window.location.search)
const pixelRatioCap = params.has('cap') ? Number(params.get('cap')) : undefined
const frames = params.has('frames') ? Number(params.get('frames')) : undefined
const h2c = params.has('h2c') ? Number(params.get('h2c')) : undefined
const gameW = params.has('gameW') ? Number(params.get('gameW')) : undefined
const gameH = params.has('gameH') ? Number(params.get('gameH')) : undefined
const jsonOut = params.get('json') === '1'

declare global {
  interface Window {
    __pipelineBenchResult?: import('./runPipelineBench').PipelineBenchResult
  }
}

runPipelineBench({
  pixelRatioCap: Number.isFinite(pixelRatioCap) ? pixelRatioCap : undefined,
  presenterFrames: Number.isFinite(frames) ? frames : undefined,
  html2canvasIterations: Number.isFinite(h2c) ? h2c : undefined,
  gameCssW: Number.isFinite(gameW) ? gameW : undefined,
  gameCssH: Number.isFinite(gameH) ? gameH : undefined,
})
  .then((r) => {
    if (jsonOut) window.__pipelineBenchResult = r
    pre.textContent = formatBenchReport(r)
  })
  .catch((e) => {
    pre.textContent = e instanceof Error ? e.stack ?? e.message : String(e)
  })
