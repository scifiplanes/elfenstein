import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
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
