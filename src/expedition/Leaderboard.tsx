import { useState } from 'react'
import { dailySeed } from './engine'
import type { Profile, Run } from './types'
import { Icon } from './Art'
export function Leaderboard({
  profile,
  onName,
}: {
  profile: Profile
  onName: (name: string) => void
}) {
  const [mode, setMode] = useState<Run['mode']>('normal'),
    [scope, setScope] = useState<'all' | 'today'>('today')
  const entries = profile.records
    .filter(
      (h) => h.mode === mode && (mode !== 'daily' || scope === 'all' || h.seed === dailySeed()),
    )
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (b.cleared ?? 0) - (a.cleared ?? 0))
    .slice(0, 20)
  return (
    <div className="leaderboard">
      <p className="muted">
        Таблица этого браузера. Дайте каждому игроку своё имя и соревнуйтесь на одном устройстве.
        Записи сохраняются только после завершения похода.
      </p>
      <label className="name-field">
        Имя для следующего результата
        <input
          maxLength={24}
          value={profile.nickname}
          onChange={(e) => onName(e.target.value)}
          placeholder="Странник"
        />
      </label>
      <div className="board-tabs">
        {(['normal', 'hard', 'daily'] as const).map((m) => (
          <button
            key={m}
            className={mode === m ? 'secondary chosen' : 'text-button'}
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
          >
            {m === 'normal' ? 'Обычный' : m === 'hard' ? 'Опасный' : 'Дневной'}
          </button>
        ))}
        {mode === 'daily' && (
          <button
            className="text-button"
            onClick={() => setScope(scope === 'today' ? 'all' : 'today')}
          >
            {scope === 'today' ? 'Сегодня · показать все дни' : 'Все дни · показать сегодня'}
          </button>
        )}
      </div>
      <div className="board-head">
        <span>Место / игрок</span>
        <span>Пройдено</span>
        <span>Очки</span>
      </div>
      {entries.length ? (
        entries.map((h, i) => (
          <div
            className={`board-row ${i === 0 ? 'top-record' : ''}`}
            key={h.runId + String(h.player)}
          >
            <span className="rank">
              {i === 0 ? <Icon name="star" size={18} /> : String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <strong>{h.player || 'Странник'}</strong>
              <small>
                {h.won ? 'Дракон повержен' : 'Отряд погиб'} ·{' '}
                {new Date(h.date).toLocaleDateString('ru-RU')}
                {mode === 'daily' ? ` · ${h.seed.replace('daily-', '')}` : ''}
              </small>
            </div>
            <span className="board-depth">
              {h.cleared ?? h.depth} <small>узлов</small>
            </span>
            <strong className="board-score">{(h.score ?? 0).toLocaleString('ru-RU')}</strong>
          </div>
        ))
      ) : (
        <div className="empty-board">
          <Icon name="flag" size={35} />
          <h3>Первое место ещё свободно.</h3>
          <p>Завершите поход, чтобы оставить здесь своё имя.</p>
        </div>
      )}
      <details className="score-rules">
        <summary>За что начисляются очки</summary>
        <p>
          Стычка: 100 · элита: 250 · босс: 600. За каждый оставшийся ход до шестого: +25. Бой без
          потери здоровья: +100. Самая длинная серия разных героев: +20 за карту, максимум +200 за
          бой. Мирная остановка: 25. Награда умножается на 1 + 0,4 за каждый круг бездны; опасный
          режим дополнительно ×1,5. Урон, лечение и повторные карты сами по себе очков не дают.
        </p>
      </details>
    </div>
  )
}
