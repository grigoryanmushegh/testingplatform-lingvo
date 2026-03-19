import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App, { initDB } from './App.jsx'

initDB().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
