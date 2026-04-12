import { expect, test } from '@playwright/test'
import type { PipelineBenchResult } from '../src/bench/runPipelineBench'
import { PIPELINE_BENCH_MATRIX } from '../src/bench/pipelineScenarios'
import { formatBytes } from '../src/bench/pipelineEstimates'

function benchUrl(row: (typeof PIPELINE_BENCH_MATRIX)[number]): string {
  const q = new URLSearchParams()
  q.set('json', '1')
  q.set('cap', String(row.pixelRatioCap))
  q.set('frames', '40')
  q.set('h2c', '3')
  if (row.gameCssW != null) q.set('gameW', String(row.gameCssW))
  if (row.gameCssH != null) q.set('gameH', String(row.gameCssH))
  return `/bench-pipeline.html?${q.toString()}`
}

test.describe('pipeline benchmark matrix', () => {
  test('all scenarios', async ({ browser }) => {
    test.setTimeout(900_000)

    const rows: Array<{
      scenario: string
      deviceScaleFactor: number
      cap: number
      gameCss: string
      effDpr: string
      drawBuf: string
      sceneRt: string
      vramEst: string
      msPerFrame: string
      h2cMean: string
      h2cFirst: string
      h2cSteadyAvg: string
    }> = []

    for (const s of PIPELINE_BENCH_MATRIX) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: s.deviceScaleFactor,
      })
      const page = await context.newPage()
      await page.goto(benchUrl(s), { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => (window as unknown as { __pipelineBenchResult?: unknown }).__pipelineBenchResult != null, {
        timeout: 240_000,
      })
      const r = (await page.evaluate(() => (window as unknown as { __pipelineBenchResult: PipelineBenchResult }).__pipelineBenchResult)) as PipelineBenchResult
      await context.close()

      expect(r.gpu.error, s.name).toBeUndefined()
      expect(r.html2canvasBench.error, s.name).toBeUndefined()

      const g = r.gpu
      const h = r.html2canvasBench
      const times = h.timesMs
      const steady = times.length > 1 ? times.slice(1) : times
      const steadyAvg = steady.length ? steady.reduce((a, b) => a + b, 0) / steady.length : 0

      const gameLabel =
        s.gameCssW != null && s.gameCssH != null ? `${s.gameCssW}×${s.gameCssH}` : '920×518 (default)'

      rows.push({
        scenario: s.name,
        deviceScaleFactor: s.deviceScaleFactor,
        cap: s.pixelRatioCap,
        gameCss: gameLabel,
        effDpr: r.cappedDpr.toFixed(3),
        drawBuf: `${g.drawingBuffer.w}×${g.drawingBuffer.h}`,
        sceneRt: `${g.gameSceneRt.w}×${g.gameSceneRt.h}`,
        vramEst: formatBytes(r.estimatesIncludingUi.totalBytes),
        msPerFrame: g.msPerFrame.toFixed(3),
        h2cMean: h.meanMs.toFixed(0),
        h2cFirst: times[0]?.toFixed(0) ?? '—',
        h2cSteadyAvg: steadyAvg.toFixed(1),
      })
    }

    const headers = [
      'Scenario',
      'DevDPR',
      'Cap',
      'GameCSS',
      'EffDPR',
      'DrawBuf',
      'SceneRT',
      'VRAM est',
      'ms/frame',
      'h2c 1st',
      'h2c steadyAvg',
      'h2c mean',
    ]
    const sep = headers.map(() => '---')
    const table = [headers, sep, ...rows.map((x) => [
      x.scenario,
      String(x.deviceScaleFactor),
      String(x.cap),
      x.gameCss,
      x.effDpr,
      x.drawBuf,
      x.sceneRt,
      x.vramEst,
      x.msPerFrame,
      x.h2cFirst,
      x.h2cSteadyAvg,
      x.h2cMean,
    ])]

    const md = table.map((line) => '| ' + line.join(' | ') + ' |').join('\n')
    console.log('\n### Pipeline benchmark matrix\n\n' + md + '\n')
  })
})
