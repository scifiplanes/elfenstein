import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const webRoot = path.dirname(fileURLToPath(import.meta.url))
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(webRoot, 'node_modules', '.cache', 'ms-playwright')

const host = '127.0.0.1'
const port = 4173
const baseURL = `http://${host}:${port}`

/** `vite build` only (no `tsc -b`) so bench runs even if the TS project has unrelated errors. */
export default defineConfig({
  testDir: './e2e',
  testMatch: /pipelineBench.*\.spec\.ts/,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite build && npx vite preview --host ${host} --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 300_000,
  },
})
