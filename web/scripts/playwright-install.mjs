import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(webRoot, 'node_modules', '.cache', 'ms-playwright')

const installArgs = ['playwright', 'install', 'chromium']
if (process.env.CI) installArgs.push('--with-deps')

const r = spawnSync('npx', installArgs, {
  cwd: webRoot,
  stdio: 'inherit',
  env: process.env,
  shell: true,
})
process.exit(r.status ?? 1)
