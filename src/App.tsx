import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { HostPage } from './pages/HostPage'
import { ControllerPage } from './pages/ControllerPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HostPage />} />
        <Route path="/controller/:sessionId" element={<ControllerPage />} />
      </Routes>
    </BrowserRouter>
  )
}
