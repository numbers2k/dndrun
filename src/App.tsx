import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { HowToModal } from './components/HowToModal'
import { Menu } from './components/Menu'
import { RunPage } from './components/RunPage'
import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import { HOWTO_STORAGE_KEY } from './data/site'
import { getActiveSave, type CareerSave } from './game/career'
import { createMenuState, refreshCareer, startRunFromSave } from './game/draft'
import { createSeed } from './game/rng'
import type { RunState } from './game/types'
import './App.css'

function App() {
  const [state, setState] = useState<RunState>(() => createMenuState())
  const [howtoOpen, setHowtoOpen] = useState(false)
  const [, setSlotsTick] = useState(0)

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  useEffect(() => {
    refreshCareer()
    try {
      if (!localStorage.getItem(HOWTO_STORAGE_KEY)) {
        setHowtoOpen(true)
      }
    } catch {
      setHowtoOpen(true)
    }
  }, [])

  useEffect(() => {
    if (state.screen === 'menu') {
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [state.screen])

  const closeHowto = useCallback(() => {
    try {
      localStorage.setItem(HOWTO_STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    setHowtoOpen(false)
  }, [])

  const onStartSave = useCallback((save: CareerSave) => {
    refreshCareer()
    setState((s) => startRunFromSave(s, save, createSeed()))
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  const onMenu = useCallback(() => {
    refreshCareer()
    setState(() => createMenuState())
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  const onAgain = useCallback(() => {
    refreshCareer()
    setState((s) => {
      const save = getActiveSave()
      if (!save) return createMenuState()
      return startRunFromSave(s, save, createSeed())
    })
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  let screen: ReactNode
  if (state.screen === 'menu') {
    screen = (
      <div className="app-shell menu-shell">
        <Menu
          onStartSave={onStartSave}
          onSlotsChanged={() => setSlotsTick((n) => n + 1)}
        />
      </div>
    )
  } else if (state.screen === 'draft' || state.screen === 'campaign') {
    screen = (
      <div className="app-shell draft-shell">
        <RunPage
          state={state}
          onChange={setState}
          onAbandon={onMenu}
          onAgain={onAgain}
          onMenu={onMenu}
        />
      </div>
    )
  } else {
    screen = (
      <div className="app-shell menu-shell">
        <Menu
          onStartSave={onStartSave}
          onSlotsChanged={() => setSlotsTick((n) => n + 1)}
        />
      </div>
    )
  }

  return (
    <div className="app-root">
      <SiteHeader onHome={onMenu} onHowTo={() => setHowtoOpen(true)} />
      <main className="app-main">{screen}</main>
      <SiteFooter />
      {howtoOpen && <HowToModal onClose={closeHowto} />}
    </div>
  )
}

export default App
