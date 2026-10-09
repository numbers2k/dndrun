import { useState } from 'react'
import { dailySeed } from './engine'
import type { ContractId, Profile, Run } from './types'
import { Icon } from './Art'
import { CONTRACTS, CONTRACT_IDS, DEFAULT_PARTY, partyIdentity } from './contracts'
import { HEROES } from './data'
export function Leaderboard({
  profile,
  onName,
}: {
  profile: Profile
  onName: (name: string) => void
}) {
  const [mode, setMode] = useState<Run['mode']>('normal'),
    [rules, setRules] = useState(6),
    [scope, setScope] = useState<'all' | 'today'>('today'),
    [contract, setContract] = useState<ContractId>('standard'),
    [partyKey, setPartyKey] = useState(partyIdentity(DEFAULT_PARTY))
  const parties = [
    ...new Set(
      profile.records
        .filter(
          (h) => h.rules === rules && h.mode === mode && (h.contract ?? 'standard') === contract,
        )
        .map((h) => partyIdentity(h.party)),
    ),
  ]
  const activePartyKey = parties.includes(partyKey)
    ? partyKey
    : (parties[0] ?? partyIdentity(DEFAULT_PARTY))
  const entries = profile.records
    .filter(
      (h) =>
        h.rules === rules &&
        h.mode === mode &&
        (h.contract ?? 'standard') === contract &&
        partyIdentity(h.party) === activePartyKey &&
        (mode !== 'daily' || scope === 'all' || h.seed === dailySeed()),
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
        <label className="board-version">
          Правила{' '}
          <select
            aria-label="Версия правил рекордов"
            value={rules}
            onChange={(e) => setRules(Number(e.target.value))}
          >
            <option value={6}>v0.6 · свободный состав</option>
            <option value={5}>v0.5 · архив</option>
            <option value={4}>v0.4 · архив</option>
          </select>
        </label>
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
        <label>
          Испытание{' '}
          <select
            aria-label="Испытание рекордов"
            value={contract}
            onChange={(e) => setContract(e.target.value as typeof contract)}
          >
            {CONTRACT_IDS.map((id) => (
              <option key={id} value={id}>
                {CONTRACTS[id].name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Отряд{' '}
          <select
            aria-label="Состав для сравнения"
            value={activePartyKey}
            onChange={(e) => setPartyKey(e.target.value)}
          >
            {(parties.length ? parties : [partyIdentity(DEFAULT_PARTY)]).map((key) => (
              <option key={key} value={key}>
                {key
                  .split(',')
                  .map((id) => HEROES[id as keyof typeof HEROES].role)
                  .join(' · ')}
              </option>
            ))}
          </select>
        </label>
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
            key={String(h.rules) + h.runId + String(h.player)}
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
          режим дополнительно ×1,5; условия похода — на свой объявленный множитель. Лучшее добивание
          после связки 3 даёт до +150 за бой. Урон, лечение и повторные карты сами по себе очков не
          дают.
        </p>
      </details>
    </div>
  )
}
