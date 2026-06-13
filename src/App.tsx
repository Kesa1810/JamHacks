import { useState } from 'react'
import Menu from './Menu'
import { HostPage } from './pages/HostPage'

type Page = 'menu' | 'game'

function App() {
  const [page, setPage] = useState<Page>('menu')

  if (page === 'game') return <HostPage onExit={() => setPage('menu')} />
  return <Menu onPlay={() => setPage('game')} />
}

export default App