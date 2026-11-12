import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'
import { applyTheme, getTheme } from './lib/theme'

applyTheme(getTheme())

window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', () => {
    if (getTheme() === 'system') applyTheme('system')
  })

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
