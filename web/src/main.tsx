import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/jim-nightshade/latin.css'
import './index.css'
import App from './App.tsx'
import { AppErrorBoundary } from './ui/AppErrorBoundary'

const el = document.getElementById('root')
if (!el) {
  document.body.textContent = 'Missing #root (check index.html).'
} else {
  createRoot(el).render(
    <StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </StrictMode>,
  )
}
