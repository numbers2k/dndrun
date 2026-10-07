/** Dev-only fixture. localhost storage is separate from the user's 127.0.0.1 game. */
import { createRoot } from 'react-dom/client'
import App from '../src/App'
import '../src/index.css'
import { simulate } from './bot.mts'
import { emptyProfile, persist, record } from '../src/expedition/engine'
const scenario = new URLSearchParams(location.search).get('scenario')
if (location.hostname === 'localhost') {
  let profile = emptyProfile()
  profile.nickname = 'Проверка'
  let run = simulate('balance-1', 'warden')
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
} else
  document.body.textContent =
    'Открывайте тестовые сценарии через localhost, чтобы не менять сохранение игры на 127.0.0.1.'
