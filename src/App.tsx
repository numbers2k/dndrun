import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { HowToModal } from './components/HowToModal'
import { Menu } from './components/Menu'
import { RunPage } from './components/RunPage'
import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import { getActiveSave, type CareerSave } from './game/career'
import { createMenuState, refreshCareer, startRunFromSave } from './game/draft'
import { dailySeed } from './game/meta'
import { createSeed } from './game/rng'
import { clearRunState, saveRunState } from './game/runSave'
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
  }, [])

  useEffect(() => {
    if (state.screen === 'menu') {
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [state.screen])

  useEffect(() => {
    if (state.screen === 'draft' || state.screen === 'campaign') {
      saveRunState(state)
    }
  }, [state])

  const closeHowto = useCallback(() => {
    setHowtoOpen(false)
  }, [])

  const beginSave = useCallback((save: CareerSave, seed: string) => {
    refreshCareer()
    clearRunState(save.id)
    setState((s) => startRunFromSave(s, save, seed))
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  const onStartSave = useCallback(
    (save: CareerSave) => {
      beginSave(save, createSeed())
    },
    [beginSave],
  )

  const onStartDaily = useCallback(
    (save: CareerSave) => {
      beginSave(save, dailySeed())
    },
    [beginSave],
  )

  const onContinueSave = useCallback((run: RunState) => {
    refreshCareer()
    setState(run)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  const onAbandonRun = useCallback((saveId: string) => {
    clearRunState(saveId)
  }, [])

  const onMenu = useCallback(() => {
    refreshCareer()
    if (state.activeSaveId) {
      saveRunState(state)
    }
    setState(() => createMenuState())
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [state])

  const onAgain = useCallback(() => {
    refreshCareer()
    setState((s) => {
      const save = getActiveSave()
      if (!save) return createMenuState()
      clearRunState(save.id)
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
          onStartDaily={onStartDaily}
          onContinueSave={onContinueSave}
          onAbandonRun={onAbandonRun}
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
          onStartDaily={onStartDaily}
          onContinueSave={onContinueSave}
          onAbandonRun={onAbandonRun}
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
