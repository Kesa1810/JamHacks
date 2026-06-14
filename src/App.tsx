import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { HostPage } from './pages/HostPage'
import { ControllerPage } from './pages/ControllerPage'
import Menu from './Menu'

function MenuPage() {
  const navigate = useNavigate()
  return <Menu onPlay={(map) => navigate('/game', { state: { map } })} />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MenuPage />} />
        <Route path="/game" element={<HostPage />} />
        <Route path="/controller/:sessionId" element={<ControllerPage />} />
      </Routes>
    </BrowserRouter>
  )
}