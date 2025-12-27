import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import DesignSystem from './DesignSystem.jsx'
import RafaelAI from './pages/rafael-ai/index.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/design-system" element={<DesignSystem />} />
        <Route path="/rafael-ai" element={<RafaelAI />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
