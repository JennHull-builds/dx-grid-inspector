import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// The library's own stylesheet (prefixed dx: utilities), the same file the npm package ships.
import './lib/styles.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
