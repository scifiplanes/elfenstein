import { expect, test } from '@playwright/test'

/** Loads `/bench-pipeline.html` and returns the printed benchmark (GPU + html2canvas). */
test('pipeline benchmark completes and prints report', async ({ page }) => {
  test.setTimeout(240_000)
  await page.goto('/bench-pipeline.html?frames=48&h2c=3', { waitUntil: 'domcontentloaded' })
  const pre = page.locator('pre')
  await expect(pre).toContainText('=== Elfenstein pipeline benchmark ===', { timeout: 180_000 })
  const text = await pre.textContent()
  expect(text).toBeTruthy()
  expect(text).toContain('Theoretical steady VRAM')
  expect(text).toContain('GPU timing')
  expect(text).toContain('html2canvas')
  // Surface full report in test output
  console.log('\n' + text)
})
