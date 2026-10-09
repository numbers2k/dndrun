/** Dev-only fixture. localhost storage is separate from the user's 127.0.0.1 game. */
import { createRoot } from 'react-dom/client'
import App from '../src/App'
import '../src/index.css'
import { simulate } from './bot.mts'
import { HEROES } from '../src/expedition/data'
import type { HeroId } from '../src/expedition/types'
import {
  emptyProfile,
  persist,
  record,
  newRun,
  chooseNode,
  makeRoutes,
  playCard,
} from '../src/expedition/engine'
const scenario = new URLSearchParams(location.search).get('scenario')
if (location.hostname === 'localhost') {
  if (scenario === 'first-visit') {
    persist(null, emptyProfile())
    createRoot(document.getElementById('root')!).render(<App />)
  } else {
    let profile = emptyProfile()
    if (scenario === 'veteran') {
      profile.wins = 2
      profile.runs = 3
      profile.unlockedHeroes = Object.keys(HEROES) as HeroId[]
    }
    profile.nickname = 'Проверка'
    let run = simulate('balance-1', 'warden')
    if (['weaver', 'pact', 'manuscript'].includes(scenario ?? '')) {
      run = newRun('mage', 'ui-new-encounters', 'normal', ['mage', 'ranger', 'warden'])
      run.depth = run.cleared = 6
      run.routeHistory = Array(6).fill('battle')
      run.nodes = [
        {
          id: 'fixture',
          kind: 'battle',
          name: 'Ткань под сводами',
          description: '',
          encounter: 'ruins-veil',
        },
      ]
      run = chooseNode(run, 'fixture')
      if (scenario === 'weaver') {
        run.combat!.enemies.forEach((e) => {
          e.hp = e.maxHp = 100
          e.block = 0
        })
        run.combat!.hand = ['nova', 'volley', 'slash', 'shield', 'mark'].map((id, i) => ({
          id,
          uid: 'weaver' + i,
          upgraded: false,
        }))
        run.combat!.energy = 7
      } else {
        run.phase = 'event'
        run.eventId = scenario === 'pact' ? 11 : 10
        run.combat = null
      }
      profile.tutorialDone = true
    }
    if (['ritual', 'boss', 'visitor', 'reward'].includes(scenario ?? '')) {
      run = newRun('alchemist', 'ui-variety')
      run.depth = 4
      run.cleared = 4
      run.routeHistory = Array(4).fill('battle')
      run.nodes = [
        {
          id: 'fixture',
          kind: ['boss', 'reward'].includes(scenario!) ? 'boss' : 'battle',
          name: scenario === 'boss' ? 'Хранитель печати' : 'Круг под соснами',
          description: '',
          ...(['boss', 'reward'].includes(scenario!)
            ? { bossId: 'guardian' }
            : { encounter: 'forest-ritual' }),
        },
      ]
      run = chooseNode(run, 'fixture')
      run.relics.push('memory')
      run.combat!.hand = ['acid', 'slash', 'venom', 'catalyst', 'antidote'].map((id, i) => ({
        id,
        uid: 'fixture' + i,
        upgraded: false,
      }))
      if (scenario === 'visitor') {
        run.phase = 'event'
        run.eventId = 4
        run.visitor = 'oracle'
        run.combat = null
      }
      if (scenario === 'reward') {
        run.combat!.enemies[0].hp = 1
        run.combat!.enemies[0].block = 0
        run = playCard(run, 'fixture1', 0)
      }
    }
    if (scenario === 'route') {
      run = newRun('duelist', 'ui-route')
      run.depth = run.cleared = 2
      run.routeHistory = ['battle', 'event']
      run.nodes = makeRoutes(run)
    }
    if (scenario === 'combo') {
      run = chooseNode(newRun('duelist', 'ui-combo'), 'battle-1')
      run.relics.push('guardbond', 'conductor')
      run.combat!.enemies[0].hp = run.combat!.enemies[0].maxHp = 120
      run.combat!.energy = 5
      run.combat!.draw = []
      run.combat!.hand = ['parry', 'omen', 'riposte', 'lunge'].map((id, i) => ({
        id,
        uid: 'combo' + i,
        upgraded: false,
      }))
      profile.tutorialDone = true
    }
    if (scenario === 'supplies') {
      run = newRun('warden', 'ui-supplies')
      run.phase = 'event'
      run.eventId = 6
      run.party[0].hp = 45
    }
    if (scenario === 'upgrade') {
      run = newRun('warden', 'ui-upgrade')
      run.phase = 'event'
      run.eventId = 3
      run.gold = 40
    }
    if (scenario === 'dragon-audit') {
      run = newRun('warden', 'ui-dragon-audit')
      run.depth = 14
      run.cleared = 14
      run.routeHistory = Array(14).fill('battle')
      run.nodes = makeRoutes(run)
      run.relics.push('quiver', 'ember', 'hourglass')
      run = chooseNode(run, run.nodes[0].id)
      profile.tutorialDone = true
    }
    if (scenario === 'forecast') {
      run = chooseNode(newRun('warden', 'ui-forecast'), 'battle-1')
      run.party[0].hp = 4
      run.party[0].block = 0
      run.combat!.enemies[0].hp = 5
      run.combat!.enemies[0].poison = 6
      run.combat!.enemies[1].intent.target = 0
      run.combat!.hand = ['shield', 'mend', 'shot'].map((id, i) => ({
        id,
        uid: 'forecast' + i,
        upgraded: false,
      }))
      profile.tutorialDone = true
    }
    if (scenario === 'checkpoint') {
      run.phase = 'checkpoint'
      run.recorded = false
    }
    if (scenario === 'board') {
      for (const [i, leader] of (['warden', 'ranger', 'mage'] as const).entries()) {
        profile.nickname = ['Север', 'Ворон', 'Пепел'][i]
        profile = record(simulate('balance-' + (i + 1), leader), profile).profile
      }
      profile.nickname = 'Проверка'
    }
    persist(run, profile)
    createRoot(document.getElementById('root')!).render(<App />)
  }
} else
  document.body.textContent =
    'Открывайте тестовые сценарии через localhost, чтобы не менять сохранение игры на 127.0.0.1.'
