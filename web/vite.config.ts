import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

type BundleOutputOptions = { dir?: string }

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONTENT_ROOT = (() => {
  // Locate repo-level `Content/` regardless of where Vite resolves this config from.
  // We anchor by checking for a known texture name.
  const anchors = ['cave_floor.png', 'ruins_floor.png']
  let cur = __dirname
  for (let i = 0; i < 4; i++) {
    const cand = path.join(cur, 'Content')
    if (fs.existsSync(cand) && anchors.some((f) => fs.existsSync(path.join(cand, f)))) return cand
    cur = path.dirname(cur)
  }
  // Final fallback (won't crash build; dev will just 404 /content/*).
  return path.join(__dirname, 'Content')
})()

function safeJoin(root: string, relPath: string) {
  const cleaned = relPath.replace(/^\/+/, '')
  const p = path.resolve(root, cleaned)
  // Prevent path traversal outside the content root.
  if (p !== root && !p.startsWith(root + path.sep)) return null
  return p
}

function ensureDirSync(p: string) {
  fs.mkdirSync(p, { recursive: true })
}

function copyDirSync(srcDir: string, dstDir: string) {
  ensureDirSync(dstDir)
  for (const ent of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, ent.name)
    const dst = path.join(dstDir, ent.name)
    if (ent.isDirectory()) {
      copyDirSync(src, dst)
      continue
    }
    if (!ent.isFile()) continue
    fs.copyFileSync(src, dst)
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Keep react + react-dom in one pre-bundle graph so `react-dom_client.js` and
  // `react-dom.js` always share the same Rolldown CJS-interop shape (`export { … as t }`).
  // Stale/mixed `.vite/deps` (e.g. interrupted writes, cloud-synced node_modules) otherwise
  // triggers: "does not provide an export named 't'".
  optimizeDeps: {
    include: [
      'react',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-dom',
      'react-dom/client',
    ],
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/examples/')) return 'three-examples'
          if (id.includes('node_modules/three/')) return 'three'
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    // If 5173 is taken (stale tab, another project), pick the next free port instead of exiting.
    strictPort: false,
    watch: {
      // FSEvents sometimes misses edits under Desktop/iCloud or with certain save/atomic-replace
      // patterns; polling keeps HMR reliable without needing manual restarts.
      usePolling: true,
      interval: 300,
    },
  },
  plugins: [
    react(),
    // Expose the repo-level `Content/` directory at `/content/*` for both dev + build.
    // This avoids keeping a duplicated `web/public/content/` mirror in sync.
    {
      name: 'repo-content-folder',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.method !== 'GET' && req.method !== 'HEAD') return next()
          const url = req.url || ''
          if (!url.startsWith('/content/')) return next()

          const rel = url.slice('/content/'.length).split('?')[0]?.split('#')[0] ?? ''
          const filePath = safeJoin(CONTENT_ROOT, rel)
          if (!filePath) return next()
          if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return next()

          res.statusCode = 200
          res.setHeader('Cache-Control', 'no-cache')
          fs.createReadStream(filePath).pipe(res)
        })
      },
      // Runs after Vite has written bundles + copied `public/`, so we can safely overlay `Content/`.
      writeBundle(outputOptions: BundleOutputOptions) {
        const outDir = outputOptions.dir ? String(outputOptions.dir) : path.resolve(__dirname, 'dist')
        const dest = path.join(outDir, 'content')
        if (!fs.existsSync(CONTENT_ROOT)) return
        copyDirSync(CONTENT_ROOT, dest)
      },
    },
    {
      name: 'persist-debug-settings',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.method !== 'POST' || req.url !== '/__debug_settings/save') {
            next()
            return
          }
          const chunks: Buffer[] = []
          req.on('data', (c: Buffer) => {
            chunks.push(c)
          })
          req.on('end', () => {
            try {
              const raw = Buffer.concat(chunks).toString('utf8')
              const data = JSON.parse(raw) as unknown
              const outPath = path.join(__dirname, 'public/debug-settings.json')
              fs.writeFileSync(outPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
              res.statusCode = 204
              res.end()
            } catch (e) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'text/plain; charset=utf-8')
              res.end(e instanceof Error ? e.message : String(e))
            }
          })
        })
      },
    },
  ],
})
