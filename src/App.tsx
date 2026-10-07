import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AREAS,
  CARDS,
  CARD_MAP,
  EVENTS,
  HEROES,
  KIND_LABEL,
  RELICS,
  RELIC_MAP,
  STARTERS,
  STARTER_PARTIES,
} from './expedition/data'
import {
  areaIndex,
  cycleIndex,
  continueEndless,
  retire,
  canUpgrade,
  buy,
  chooseNode,
  dailySeed,
  endTurn,
  eventChoice,
  leaveShop,
  newRun,
  persist,
  playCard,
  playable,
  readProfile,
  readRun,
  record,
  recruit,
  rest,
  takeReward,
  targetDamage,
} from './expedition/engine'
import { EnemyArt, Icon, Landscape, Portrait } from './expedition/Art'
import type { Card, HeroId, Run } from './expedition/types'
import { Leaderboard } from './expedition/Leaderboard'
import { BOONS, OMEN_MAP } from './expedition/endless'
import { ActionCard, Meter, Modal } from './expedition/ui'
import './App.css'

const modes = { normal: 'Свободный поход', daily: 'Приключение дня', hard: 'Опасный поход' }
const routeIcons = {
  battle: 'sword',
  elite: 'skull',
  boss: 'skull',
  rest: 'camp',
  event: 'eye',
  shop: 'bag',
}
const partyTips = {
  warden:
    'Защита и лечение прощают ошибки. Лина помечает врага, Бран прикрывает отряд, Мира возвращает здоровье.',
  ranger:
    'Метка Лины усиливает удары Рена. Яд обходит броню. Быстро устраняйте врагов, пока Бран держит строй.',
  mage: 'Том даёт энергию и новые карты. Эли поражает сразу несколько врагов. Бран защищает тех, кто под ударом.',
}
function App() {
  const [profile, setProfile] = useState(readProfile),
    [run, setRun] = useState(readRun)
  const [view, setView] = useState<'home' | 'start' | 'run'>('home'),
    [mode, setMode] = useState<Run['mode']>('normal'),
    [leader, setLeader] = useState<HeroId>('warden')
  const [selected, setSelected] = useState<string | null>(null),
    [modal, setModal] = useState<
      'help' | 'deck' | 'journal' | 'replace' | 'relics' | 'leaderboard' | null
    >(null)
  const [panel, setPanel] = useState<'upgrade' | 'remove' | null>(null),
    [notice, setNotice] = useState(''),
    [storageError, setStorageError] = useState(false),
    [sound, setSound] = useState(false)
  const audio = useRef<AudioContext | null>(null)
  const active = run && !['victory', 'defeat'].includes(run.phase)
  useEffect(() => {
    setStorageError(!persist(run, profile))
  }, [run, profile])
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [view, run?.phase])
  function tone() {
    if (!sound) return
    try {
      audio.current ??= new AudioContext()
      const ctx = audio.current
      void ctx.resume()
      const osc = ctx.createOscillator(),
        gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(420, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 0.12)
      gain.gain.setValueAtTime(0.045, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.16)
    } catch {
      /* Audio is optional. */
    }
  }
  function change(next: Run) {
    const result = record(next, profile)
    setRun(result.run)
    setProfile(result.profile)
    setSelected(null)
    setPanel(null)
    tone()
  }
  function begin(nextMode: Run['mode']) {
    setMode(nextMode)
    if (nextMode === 'daily') setLeader('warden')
    if (active) setModal('replace')
    else setView('start')
  }
  function start() {
    const seed =
      mode === 'daily'
        ? dailySeed()
        : `trail-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`
    change(newRun(mode === 'daily' ? 'warden' : leader, seed, mode))
    setView('run')
    setNotice('')
  }
  function selectCard(c: Card) {
    if (!run || !playable(run, c)) return
    const d = CARD_MAP[c.id]
    if (d.target === 'all' || d.target === 'self') change(playCard(run, c.uid, 0))
    else {
      setSelected(selected === c.uid ? null : c.uid)
      if (selected !== c.uid && window.matchMedia('(max-width: 620px)').matches) {
        requestAnimationFrame(() =>
          document
            .querySelector(d.target === 'ally' ? '.battlefield .team' : '.enemy-row')
            ?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
        )
      }
    }
  }
  const selectedCard = run?.combat?.hand.find((c) => c.uid === selected),
    target = selectedCard ? CARD_MAP[selectedCard.id].target : null
  function team(compact = false) {
    if (!run) return null
    return (
      <div className={`team ${compact ? 'compact-team' : ''}`}>
        {run.party.map((h, i) => {
          const d = HEROES[h.id],
            incoming =
              run.phase === 'combat'
                ? run
                    .combat!.enemies.filter(
                      (e) => e.hp > 0 && (e.intent.target === i || e.intent.target === -1),
                    )
                    .reduce(
                      (n, e) =>
                        n +
                        e.intent.damage +
                        (e.intent.damage ? Math.max(0, run.combat!.turn - 7) * 2 : 0),
                      0,
                    )
                : 0
          return (
            <button
              key={h.id}
              className={`hero-unit ${h.hp <= 0 ? 'fallen' : ''} ${target === 'ally' && h.hp > 0 ? 'targetable' : ''}`}
              disabled={target !== 'ally' || h.hp <= 0}
              onClick={() => change(playCard(run, selected!, i))}
              title={d.passive}
              aria-label={`${d.name}, ${d.role}, здоровье ${h.hp} из ${h.maxHp}${target === 'ally' ? ', применить карту' : ''}`}
            >
              <Portrait hero={h.id} small={compact} />
              <div className="hero-details">
                <div className="unit-name">
                  {d.name}
                  <span>{d.role}</span>
                </div>
                <Meter value={h.hp} max={h.maxHp} shield={run.phase === 'combat' ? h.block : 0} />
                <p>
                  {h.hp <= 0 ? (
                    'Пал · карты недоступны'
                  ) : incoming > 0 ? (
                    <>
                      <Icon name="sword" size={13} />
                      {incoming} входящего · {Math.max(0, incoming - h.block)} после защиты
                    </>
                  ) : run.phase === 'combat' ? (
                    'В безопасности в этом ходу'
                  ) : (
                    d.passive
                  )}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    )
  }
  let content: ReactNode
  if (view === 'home')
    content = (
      <>
        <section className="home-hero">
          <Landscape />
          <div className="hero-copy">
            <div className="eyebrow">КАРТОЧНОЕ ПРИКЛЮЧЕНИЕ · ROGUELIKE</div>
            <h1>
              За последним костром
              <br />
              дорога продолжается.
            </h1>
            <p>
              Три героя. Одна колода. Ни одного безопасного пути.
              <br />
              Победите дракона — и решите, как далеко зайдёте во тьму.
            </p>
            <div className="hero-actions">
              <button
                className="primary"
                onClick={() => (active ? setView('run') : begin('normal'))}
              >
                {active ? 'Продолжить поход' : 'Собрать отряд'}
                <Icon name="arrow" size={18} />
              </button>
              {active && (
                <button className="secondary" onClick={() => begin('normal')}>
                  Новый поход
                </button>
              )}
            </div>
            <div className="hero-caption">15 остановок до дракона · дальше — бездна</div>
          </div>
          <span className="art-caption">I / ЗЕЛЁНЫЙ ТРАКТ</span>
        </section>
        <section className="intro-grid">
          {[
            [
              'eye',
              'Смотри на врагов',
              'Их следующий ход виден заранее. Прикрой того, кто окажется под ударом.',
            ],
            [
              'cards',
              'Находи сочетания',
              'Метка, яд, защита и лишняя энергия. Порядок карт меняет исход боя.',
            ],
            [
              'map',
              'Выбирай дорогу',
              'Рискнуть ради реликвии или передохнуть перед боссом — решать тебе.',
            ],
          ].map(([icon, title, text], i) => (
            <article key={title}>
              <span className="step-icon">
                <Icon name={icon} />
              </span>
              <small>0{i + 1}</small>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </section>
        <section className="home-bottom">
          <div className="guild">
            <div className="eyebrow">ВАША ИСТОРИЯ</div>
            <h2>Оставьте имя среди выживших.</h2>
            <p>Собирайте сильные связки, рискуйте ради очков и поднимайтесь в таблице рекордов.</p>
            <div className="stats">
              <div>
                <strong>{profile.runs}</strong>
                <span>походов</span>
              </div>
              <div>
                <strong>
                  {Math.max(0, ...profile.records.map((h) => h.score ?? 0)).toLocaleString('ru-RU')}
                </strong>
                <span>рекорд очков</span>
              </div>
              <div>
                <strong>
                  {profile.best}
                  <small> узлов</small>
                </strong>
                <span>лучший путь</span>
              </div>
            </div>
            {active && (
              <p className="saved">
                <Icon name="flag" size={16} />
                Сохранено: {AREAS[areaIndex(run.depth)].name} · остановка {run.depth} ·{' '}
                {run.score.toLocaleString('ru-RU')} очков
              </p>
            )}
          </div>
          <div className="daily">
            <Icon name="sun" size={32} />
            <div>
              <span className="eyebrow">ОДНА ДОРОГА ДЛЯ ВСЕХ</span>
              <h3>Приключение дня</h3>
              <p>Одинаковый отряд, маршрут и случайности. Сравните результат с друзьями.</p>
              <button className="text-button" onClick={() => begin('daily')}>
                Пойти сегодня <Icon name="arrow" size={16} />
              </button>
            </div>
          </div>
          <button className="secondary board-home" onClick={() => setModal('leaderboard')}>
            <Icon name="star" />
            Таблица рекордов · локальная
          </button>
          {profile.wins > 0 && (
            <button className="hard-option" onClick={() => begin('hard')}>
              <Icon name="skull" />
              Опасный поход · враги сильнее
            </button>
          )}
        </section>
      </>
    )
  else if (view === 'start')
    content = (
      <section className="start-screen">
        <button className="text-button" onClick={() => setView('home')}>
          ← В главное меню
        </button>
        <div className="section-heading">
          <div className="eyebrow">{modes[mode]}</div>
          <h1>Кто поведёт отряд?</h1>
          <p>Три разных подхода. Все герои доступны с самого начала.</p>
        </div>
        <div className="party-options">
          {STARTERS.map((id) => (
            <button
              className={`party-choice ${leader === id ? 'chosen' : ''}`}
              key={id}
              disabled={mode === 'daily' && id !== 'warden'}
              onClick={() => setLeader(id)}
              aria-pressed={leader === id}
            >
              <div className="party-portraits">
                {STARTER_PARTIES[id].map((h) => (
                  <Portrait key={h} hero={h} />
                ))}
              </div>
              <div className="eyebrow">
                {id === 'warden'
                  ? 'РЕКОМЕНДУЕМ ДЛЯ ПЕРВОГО ПОХОДА'
                  : id === 'ranger'
                    ? 'ТОЧНОСТЬ И ЯД'
                    : 'ЭНЕРГИЯ И ЗАКЛИНАНИЯ'}
              </div>
              <h2>{HEROES[id].title}</h2>
              <div className="party-names">
                {STARTER_PARTIES[id].map((h) => HEROES[h].role).join(' · ')}
              </div>
              <p>{partyTips[id as keyof typeof partyTips]}</p>
              <div className="starter-relic">
                <Icon
                  name={
                    RELIC_MAP[
                      id === 'warden' ? 'lantern' : id === 'ranger' ? 'satchel' : 'hourglass'
                    ].icon
                  }
                  size={18}
                />
                {
                  RELIC_MAP[id === 'warden' ? 'lantern' : id === 'ranger' ? 'satchel' : 'hourglass']
                    .text
                }
              </div>
            </button>
          ))}
        </div>
        {mode === 'daily' && (
          <p className="muted">В приключении дня отряд фиксирован для всех игроков.</p>
        )}
        <label className="name-field">
          Ваше имя в таблице рекордов
          <input
            maxLength={24}
            value={profile.nickname}
            placeholder="Странник"
            onChange={(e) => setProfile({ ...profile, nickname: e.target.value })}
          />
        </label>
        <div className="start-bottom">
          <span>Победите трёх боссов. Затем вернитесь с рекордом или продолжите в бездну.</span>
          <button className="primary" onClick={start}>
            В путь <Icon name="arrow" size={18} />
          </button>
        </div>
      </section>
    )
  else if (run) {
    const displayDepth = run.phase === 'route' ? run.depth + 1 : run.depth || 1,
      a = areaIndex(displayDepth),
      circleStart = cycleIndex(displayDepth) * 15,
      b = run.combat
    let phase: ReactNode
    if (run.phase === 'route')
      phase = (
        <>
          <section className="route-banner">
            <Landscape area={areaIndex(run.depth + 1)} compact />
            <div>
              <span className="eyebrow">
                СЛЕДУЮЩАЯ ОСТАНОВКА · {run.depth + 1} {run.depth >= 15 ? '· БЕЗДНА' : '/ 15'}
              </span>
              <h1>{run.depth === 0 ? 'Путь начинается здесь.' : 'Куда пойдём дальше?'}</h1>
              <p>{AREAS[areaIndex(run.depth + 1)].description}</p>
            </div>
          </section>
          <div className="route-options">
            {run.nodes.map((n) => (
              <button
                className={`route-node ${n.kind}`}
                key={n.id}
                onClick={() => change(chooseNode(run, n.id))}
              >
                <span className="route-icon">
                  <Icon name={routeIcons[n.kind]} size={28} />
                </span>
                <div className="eyebrow">{KIND_LABEL[n.kind]}</div>
                <h2>{n.name}</h2>
                <p>{n.description}</p>
                <span className="route-go">
                  {n.kind === 'rest'
                    ? 'Остановиться'
                    : n.kind === 'shop'
                      ? 'Заглянуть'
                      : 'Отправиться'}{' '}
                  <Icon name="arrow" size={17} />
                </span>
              </button>
            ))}
          </div>
          <h3 className="subheading">
            Ваш отряд <small>Здоровье сохраняется между боями</small>
          </h3>
          {team(true)}
          {run.party.some((h) => h.hp < h.maxHp * 0.3) && (
            <p className="warning">
              Отряду нужен отдых. На привале можно восстановить здоровье или поднять павшего героя.
            </p>
          )}
        </>
      )
    else if (run.phase === 'combat' && b)
      phase = (
        <>
          <div className="battle-title">
            <div>
              <div className="eyebrow">
                {KIND_LABEL[b.kind]} · ХОД {b.turn}
              </div>
              <h1>{b.name}</h1>
            </div>
            <span className="muted">Устраните всех врагов</span>
          </div>
          {run.depth === 1 && !profile.tutorialDone && (
            <div className="coach">
              <Icon name={selected ? 'arrow' : b.turn > 1 ? 'shield' : 'eye'} />
              <p>
                <strong>
                  {selected
                    ? 'Теперь выберите цель.'
                    : b.turn > 1
                      ? 'Новый ход — новые возможности.'
                      : 'Враги уже показали свой ход.'}
                </strong>{' '}
                {selected
                  ? target === 'ally'
                    ? 'Нажмите на героя отряда, чтобы дать ему защиту или лечение.'
                    : 'Нажмите на врага, чтобы применить карту.'
                  : 'Выберите карту внизу. Число в её углу — цена в энергии. Защитите героя под ударом или устраните атакующего.'}
              </p>
              <button
                className="icon-button"
                aria-label="Скрыть обучение"
                onClick={() => setProfile({ ...profile, tutorialDone: true })}
              >
                <Icon name="close" size={17} />
              </button>
            </div>
          )}
          <div className="battlefield">
            <Landscape area={a} compact />
            <div className="enemy-row">
              {b.enemies.map((e, i) => (
                <button
                  key={e.uid}
                  className={`enemy-unit ${e.hp <= 0 ? 'fallen' : ''} ${target === 'enemy' && e.hp > 0 ? 'targetable' : ''}`}
                  disabled={target !== 'enemy' || e.hp <= 0}
                  onClick={() => change(playCard(run, selected!, i))}
                  aria-label={`${e.name}, здоровье ${e.hp}${target === 'enemy' ? ', применить карту' : ''}`}
                >
                  <div className={`intent ${e.intent.damage === 0 ? 'preparing' : ''}`}>
                    {e.hp <= 0 ? (
                      <>
                        <Icon name="check" size={16} />
                        Побеждён
                      </>
                    ) : (
                      <>
                        <Icon name={e.intent.damage ? 'sword' : 'eye'} size={16} />
                        <strong>
                          {e.intent.damage
                            ? e.intent.damage + Math.max(0, b.turn - 7) * 2
                            : 'Готовится'}
                        </strong>
                        <span>
                          {e.intent.damage
                            ? `→ ${e.intent.target === -1 ? 'весь отряд' : HEROES[run.party[e.intent.target].id].name}`
                            : 'к прыжку'}
                        </span>
                      </>
                    )}
                  </div>
                  <EnemyArt id={e.id} />
                  <h3>{e.name}</h3>
                  <Meter value={e.hp} max={e.maxHp} shield={e.block} />
                  <div className="statuses">
                    {target === 'enemy' &&
                      selectedCard &&
                      CARD_MAP[selectedCard.id].damage &&
                      e.hp > 0 && (
                        <span className="damage-preview">
                          −{targetDamage(run, selectedCard, i)} здоровья
                        </span>
                      )}
                    {e.poison > 0 && (
                      <span title="Яд наносит урон перед атакой врага и убывает на 1 каждый ход">
                        Яд {e.poison}
                      </span>
                    )}
                    {e.vulnerable > 0 && (
                      <span title="Атаки наносят на 50% больше урона">
                        Уязвимость {e.vulnerable}
                      </span>
                    )}
                    {e.intent.block > 0 && <span>Каменный щит</span>}
                  </div>
                </button>
              ))}
            </div>
            <div className="team-caption">
              ВАШ ОТРЯД <span>Выберите героя для защиты или лечения</span>
            </div>
            {team()}
          </div>
          <section className="hand">
            <div className="chain-meter">
              <Icon name="spark" size={18} />
              <strong>Связка ×{b.chain}</strong>
              <span>
                {b.lastHero
                  ? `После ${HEROES[b.lastHero].name} сыграйте карту другого героя.`
                  : 'Чередуйте героев в серии карт.'}{' '}
                3 карты → добор · 5 → энергия (по разу за ход)
              </span>
            </div>
            <div className="hand-toolbar">
              <div className="energy">
                <Icon name="spark" />
                <strong>{b.energy}</strong>
                <span>энергии</span>
              </div>
              <p aria-live="polite">
                {selectedCard ? (
                  <>
                    <strong>{CARD_MAP[selectedCard.id].name}</strong> · выберите{' '}
                    {target === 'ally' ? 'героя' : 'врага'}{' '}
                    <button className="text-button" onClick={() => setSelected(null)}>
                      Отмена
                    </button>
                  </>
                ) : b.energy === 0 ? (
                  'Энергия закончилась. Можно сыграть карты за 0 или завершить ход.'
                ) : (
                  'Выберите карту → выберите цель.'
                )}
              </p>
              <button className="primary end-turn" onClick={() => change(endTurn(run))}>
                Завершить ход <Icon name="arrow" size={17} />
              </button>
            </div>
            <div className="hand-cards">
              {b.hand.map((c) => (
                <ActionCard
                  key={c.uid}
                  card={c}
                  onClick={() => selectCard(c)}
                  disabled={!playable(run, c)}
                  selected={selected === c.uid}
                  context={run}
                />
              ))}
            </div>
            <div className="battle-bottom">
              <span>
                Колода {b.draw.length} · Сброс {b.discard.length} · Исчезло {b.exhausted.length}
              </span>
              <details>
                <summary>История боя</summary>
                <ol>
                  {b.log.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ol>
              </details>
            </div>
          </section>
        </>
      )
    else if (run.phase === 'reward' && run.reward) {
      const rw = run.reward
      phase = (
        <section className="decision-screen">
          <div className="result-icon">
            <Icon name="check" size={32} />
          </div>
          <div className="section-heading">
            <div className="eyebrow">{rw.nodeKind === 'boss' ? 'БОСС ПОВЕРЖЕН' : 'ПОБЕДА'}</div>
            <h1>{run.depth % 15 === 0 ? 'Последний страж повержен.' : 'Путь ещё не окончен.'}</h1>
            <p>
              <Icon name="coin" size={18} /> +{rw.coins} монет уже в кошельке
              {rw.nodeKind === 'boss' ? ' · Отряд восстановил силы.' : ''}
            </p>
          </div>
          <div className="score-breakdown">
            <strong>+{run.lastScore.total} очков</strong>
            <span>
              Бой {run.lastScore.base} · темп {run.lastScore.speed} · без ран{' '}
              {run.lastScore.flawless} · связка {run.lastScore.combo}
            </span>
            <small>Множитель круга и режима уже учтён</small>
          </div>
          {rw.relic && (
            <div className="relic-reward">
              <Icon name={RELIC_MAP[rw.relic].icon} size={28} />
              <div>
                <strong>{RELIC_MAP[rw.relic].name}</strong>
                <p>{RELIC_MAP[rw.relic].text}</p>
              </div>
              <span>Получено</span>
            </div>
          )}
          {rw.recruit && (
            <div className="recruit">
              <Portrait hero={rw.recruit} small />
              <div>
                <h3>{HEROES[rw.recruit].name} хочет присоединиться</h3>
                <p>
                  {HEROES[rw.recruit].role} · {HEROES[rw.recruit].passive} Можно заменить одного
                  героя вместе с его картами. Новые карты заменят текущий выбор награды.
                </p>
                <div className="recruit-actions">
                  {run.party.map((h, i) => (
                    <button
                      className="secondary"
                      key={h.id}
                      onClick={() => change(recruit(run, i))}
                    >
                      Вместо {HEROES[h.id].name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {
            <>
              <h3 className="subheading">
                Добавьте одну карту <small>Можно пропустить, чтобы чаще брать лучшие карты</small>
              </h3>
              <div className="reward-cards">
                {rw.cards.map((c) => (
                  <ActionCard
                    key={c.uid}
                    card={c}
                    onClick={() => change(takeReward(run, c.uid))}
                    footer="Добавить в колоду"
                  />
                ))}
              </div>
            </>
          }
          <button
            className={run.depth % 15 === 0 ? 'primary' : 'secondary'}
            onClick={() => change(takeReward(run, null))}
          >
            {run.depth % 15 === 0 ? 'К границе бездны' : 'Пропустить карту и идти дальше'}
            <Icon name="arrow" size={18} />
          </button>
        </section>
      )
    } else if (run.phase === 'checkpoint')
      phase = (
        <section className="checkpoint">
          <Landscape area={2} />
          <div className="section-heading">
            <div className="eyebrow">
              КРУГ {Math.ceil(run.depth / 15)} ПРОЙДЕН · {run.score.toLocaleString('ru-RU')} ОЧКОВ
            </div>
            <h1>За этой гранью нет конца.</h1>
            <p>
              Дракон позади. Можно вернуться с рекордом или шагнуть в бездну: отряд, колода,
              улучшения и реликвии останутся с вами.
            </p>
          </div>
          <div className="endless-warning">
            <Icon name="skull" />
            <p>
              Следующий круг: здоровье врагов ×{Math.pow(1.22, run.depth / 15).toFixed(2)}, атаки +
              {(run.depth / 15) * 2}, новое случайное знамение. Очки ×
              {(1 + (run.depth / 15) * 0.4).toFixed(1)}. Отряд получит не менее 75% здоровья и 40
              монет.
            </p>
          </div>
          <h3>Выберите дар — и продолжите</h3>
          <div className="boon-options">
            {BOONS.map((b) => (
              <button
                className="choice"
                key={b.id}
                onClick={() => change(continueEndless(run, b.id))}
              >
                <Icon name={b.icon} size={28} />
                <h3>
                  {b.name}
                  {run.boons.includes(b.id) && <small> · усилить</small>}
                </h3>
                <p>{b.text}</p>
                <span className="route-go">
                  Принять дар и идти дальше <Icon name="arrow" size={16} />
                </span>
              </button>
            ))}
          </div>
          <button className="secondary" onClick={() => change(retire(run))}>
            <Icon name="flag" size={18} />
            Вернуться · зафиксировать {run.score.toLocaleString('ru-RU')} очков
          </button>
        </section>
      )
    else if (run.phase === 'rest')
      phase = (
        <section className="decision-screen">
          <div className="result-icon">
            <Icon name="camp" size={32} />
          </div>
          <div className="section-heading">
            <div className="eyebrow">ПРИВАЛ</div>
            <h1>Время перевести дух.</h1>
            <p>Выберите одно действие, прежде чем продолжить путь.</p>
          </div>
          {team(true)}
          {panel === 'upgrade' ? (
            <>
              <h3 className="subheading">
                Какую карту улучшить?{' '}
                <small>
                  Урон и защита +4 · лечение и яд +3 · энергия, уязвимость и добор без урона/защиты
                  +1
                </small>
              </h3>
              <div className="catalog">
                {run.deck
                  .filter((c) => canUpgrade(c))
                  .map((c) => (
                    <ActionCard
                      card={c}
                      key={c.uid}
                      onClick={() => change(rest(run, 'upgrade', c.uid))}
                      footer="Улучшить"
                    />
                  ))}
              </div>
              <button className="secondary" onClick={() => setPanel(null)}>
                Назад
              </button>
            </>
          ) : (
            <div className="rest-options">
              <button className="choice" onClick={() => change(rest(run, 'heal'))}>
                <Icon name="heart" size={28} />
                <h3>Отдохнуть</h3>
                <p>Восстановить 35% максимального здоровья каждому живому герою.</p>
              </button>
              <button
                className="choice"
                disabled={run.deck.every((c) => !canUpgrade(c))}
                onClick={() => setPanel('upgrade')}
              >
                <Icon name="spark" size={28} />
                <h3>Тренироваться</h3>
                <p>Навсегда улучшить одну карту в этом походе.</p>
              </button>
              <button
                className="choice"
                disabled={!run.party.some((h) => h.hp <= 0)}
                onClick={() => change(rest(run, 'revive'))}
              >
                <Icon name="plus" size={28} />
                <h3>Поднять героя</h3>
                <p>Вернуть первого павшего героя с половиной здоровья.</p>
              </button>
            </div>
          )}
        </section>
      )
    else if (run.phase === 'event') {
      const e = EVENTS[run.eventId]
      phase = (
        <section className="decision-screen event-screen">
          <div className="result-icon">
            <Icon name="eye" size={32} />
          </div>
          <div className="section-heading">
            <div className="eyebrow">ВСТРЕЧА В ПУТИ</div>
            <h1>{e.name}</h1>
            <p>{e.text}</p>
          </div>
          <div className="event-options">
            <button
              className="choice"
              disabled={run.eventId === 1 && run.gold < 25}
              onClick={() => change(eventChoice(run, 'a'))}
            >
              <h3>{e.a}</h3>
              <p>{e.aText}</p>
              <Icon name="arrow" />
            </button>
            <button className="choice" onClick={() => change(eventChoice(run, 'b'))}>
              <h3>{e.b}</h3>
              <p>{e.bText}</p>
              <Icon name="arrow" />
            </button>
          </div>
          {team(true)}
        </section>
      )
    } else if (run.phase === 'shop')
      phase = (
        <section className="decision-screen">
          <div className="section-heading">
            <div className="eyebrow">ТОРГОВЕЦ</div>
            <h1>Полезное в дорогу.</h1>
            <p>Монет в кошельке: {run.gold}. Приобретения доступны сразу.</p>
          </div>
          <div className="reward-cards">
            {run.shopCards.map((c) => (
              <ActionCard
                key={c.uid}
                card={c}
                onClick={() => change(buy(run, 'card', c.uid))}
                disabled={run.gold < 35}
                footer="Купить · 35 монет"
              />
            ))}
          </div>
          {run.shopRelic && (
            <div className="relic-reward">
              <Icon name={RELIC_MAP[run.shopRelic].icon} size={28} />
              <div>
                <strong>{RELIC_MAP[run.shopRelic].name}</strong>
                <p>{RELIC_MAP[run.shopRelic].text}</p>
              </div>
              <button
                className="secondary"
                disabled={run.gold < 70}
                onClick={() => change(buy(run, 'relic'))}
              >
                Купить · 70
              </button>
            </div>
          )}
          {panel === 'remove' ? (
            <>
              <h3 className="subheading">Удалить карту · 30 монет</h3>
              <div className="catalog">
                {run.deck.map((c) => (
                  <ActionCard
                    key={c.uid}
                    card={c}
                    onClick={() => change(buy(run, 'remove', c.uid))}
                    footer="Удалить"
                  />
                ))}
              </div>
              <button className="text-button" onClick={() => setPanel(null)}>
                Отмена
              </button>
            </>
          ) : (
            <button
              className="secondary"
              disabled={run.gold < 30 || run.deck.length <= 6}
              onClick={() => setPanel('remove')}
            >
              Убрать ненужную карту · 30 монет
            </button>
          )}
          <button className="primary" onClick={() => change(leaveShop(run))}>
            Продолжить путь <Icon name="arrow" size={18} />
          </button>
        </section>
      )
    else
      phase = (
        <section className="final-screen">
          <Landscape area={a} />
          <div className="final-copy">
            <div className="eyebrow">
              {modes[run.mode]} · {run.phase === 'victory' ? 'ПОБЕДА' : 'ПОХОД ЗАВЕРШЁН'}
            </div>
            <h1>
              {run.phase === 'victory'
                ? 'За перевалом — новая дорога.'
                : 'В следующий раз дойдём дальше.'}
            </h1>
            <p>
              {run.phase === 'victory'
                ? 'Вы вернулись из темноты. Результат сохранён в таблице этого браузера.'
                : 'Попробуйте раньше устранять атакующих врагов, прикрывать слабых героев и отдыхать перед боссом.'}
            </p>
            <div className="stats">
              <div>
                <strong>
                  {run.cleared}
                  {run.depth <= 15 && <small> / 15</small>}
                </strong>
                <span>остановок пройдено</span>
              </div>
              <div>
                <strong>{run.battles}</strong>
                <span>побед в боях</span>
              </div>
              <div>
                <strong>{run.relics.length}</strong>
                <span>реликвий</span>
              </div>
              <div>
                <strong>{run.damageDealt}</strong>
                <span>урона нанесено</span>
              </div>
            </div>
            <div className="final-score">
              <span>ИТОГОВЫЙ СЧЁТ</span>
              <strong>{run.score.toLocaleString('ru-RU')}</strong>
              <small>
                {run.rules === 3
                  ? 'Поход предыдущей версии · вне новой таблицы'
                  : 'Результат сохранён в локальной таблице'}
              </small>
            </div>
            <div className="final-actions">
              <button className="secondary" onClick={() => setModal('leaderboard')}>
                <Icon name="star" size={18} />
                Рекорды
              </button>
              <button className="primary" onClick={() => begin('normal')}>
                Новый отряд <Icon name="arrow" size={18} />
              </button>
              <button className="secondary" onClick={() => setView('home')}>
                В меню
              </button>
              <button
                className="text-button"
                onClick={() => {
                  const text = `dndrun · ${modes[run.mode]} · ${run.phase === 'victory' ? 'Победа!' : `${run.cleared} узлов`} · ${run.score} очков · ${run.seed}`
                  void navigator.clipboard?.writeText(text).then(
                    () => setNotice('Результат скопирован — можно отправить друзьям.'),
                    () => setNotice(text),
                  )
                  if (!navigator.clipboard) setNotice(text)
                }}
              >
                Поделиться результатом
              </button>
            </div>
            {notice && <p role="status">{notice}</p>}
          </div>
        </section>
      )
    content = (
      <>
        <div className="run-header">
          <div>
            <span className="eyebrow">
              {displayDepth > 15 ? `БЕЗДНА · КРУГ ${cycleIndex(displayDepth) + 1} · ` : ''}ОБЛАСТЬ{' '}
              {a + 1} / 3
            </span>
            <h2>{AREAS[a].name}</h2>
          </div>
          <div className="run-tools">
            <button
              className="score-counter text-button"
              onClick={() => setModal('leaderboard')}
              title="Очки за бои, темп и связки"
            >
              <Icon name="star" size={17} />
              {run.score.toLocaleString('ru-RU')}
            </button>
            <span className="coins">
              <Icon name="coin" size={18} />
              {run.gold}
            </span>
            <button className="secondary" onClick={() => setModal('deck')}>
              <Icon name="cards" size={17} />
              Колода · {run.deck.length}
            </button>
            <button className="text-button" onClick={() => setView('home')}>
              В меню
            </button>
          </div>
        </div>
        <div className="progress" aria-label={`Пройдено ${run.cleared} остановок`}>
          {Array.from({ length: 15 }, (_, i) => (
            <span
              key={i}
              className={`${circleStart + i < run.cleared ? 'done' : ''} ${circleStart + i === displayDepth - 1 ? 'current' : ''}`}
              title={`${circleStart + i + 1}: ${i % 5 === 4 ? 'Босс' : (KIND_LABEL[run.routeHistory[circleStart + i]] ?? 'Впереди')}`}
            >
              {i % 5 === 4 ? <Icon name="skull" size={15} /> : i + 1}
            </span>
          ))}
        </div>
        <div className="relic-bar">
          {run.relics.map((id) => (
            <button key={id} title={RELIC_MAP[id].text} onClick={() => setModal('relics')}>
              <Icon name={RELIC_MAP[id].icon} size={16} />
              {RELIC_MAP[id].name}
            </button>
          ))}
        </div>
        {run.omen && (
          <div className="omen">
            <Icon name="skull" size={18} />
            <strong>{OMEN_MAP[run.omen].name}</strong>
            <span>{OMEN_MAP[run.omen].text}</span>
          </div>
        )}
        {run.boons.length > 0 && (
          <div className="boon-bar">
            {BOONS.filter((b) => run.boons.includes(b.id)).map((b) => (
              <span key={b.id} title={b.text}>
                <Icon name={b.icon} size={14} />
                {b.name} ×{run.boons.filter((id) => id === b.id).length}
              </span>
            ))}
          </div>
        )}
        {phase}
      </>
    )
  }
  return (
    <div className={view === 'run' ? 'app in-run' : 'app'}>
      <nav className="nav">
        <button className="brand" onClick={() => setView('home')}>
          <span className="brand-mark">
            <Icon name="map" size={22} />
          </span>
          <span>
            dndrun<small>ПУТЬ ОТРЯДА</small>
          </span>
        </button>
        <div>
          <button className="text-button board-nav" onClick={() => setModal('leaderboard')}>
            <Icon name="star" size={18} />
            Рекорды
          </button>
          <button className="text-button" onClick={() => setModal('journal')}>
            <Icon name="book" size={18} />
            Журнал
          </button>
          <button className="text-button" onClick={() => setModal('help')}>
            <Icon name="eye" size={18} />
            Как играть
          </button>
          <button
            className={`icon-button sound ${sound ? 'on' : ''}`}
            onClick={() => setSound(!sound)}
            aria-label={sound ? 'Выключить звуки' : 'Включить звуки'}
            aria-pressed={sound}
            title={sound ? 'Звуки включены' : 'Звуки выключены'}
          >
            <Icon name="music" size={19} />
          </button>
        </div>
      </nav>
      <main>
        {storageError && (
          <p className="warning" role="alert">
            Браузер не разрешает сохранение. Прогресс доступен только до закрытия страницы.
          </p>
        )}
        {content}
      </main>
      <footer>
        <span>dndrun · Путь отряда</span>
        <span>Поход сохраняется в этом браузере · v0.4</span>
      </footer>
      {modal && (
        <Modal
          title={
            modal === 'leaderboard'
              ? 'Таблица рекордов'
              : modal === 'help'
                ? 'Ваш первый поход'
                : modal === 'deck'
                  ? `Колода · ${run?.deck.length ?? 0} карт`
                  : modal === 'journal'
                    ? 'Журнал приключений'
                    : modal === 'relics'
                      ? 'Реликвии отряда'
                      : 'Начать новый поход?'
          }
          onClose={() => setModal(null)}
        >
          {modal === 'leaderboard' ? (
            <Leaderboard
              profile={profile}
              onName={(name) => setProfile({ ...profile, nickname: name })}
            />
          ) : modal === 'relics' ? (
            <>
              <p className="muted">
                Эти эффекты работают весь поход и складываются с умениями героев.
              </p>
              <div className="journal-relics">
                {run?.relics.map((id) => (
                  <div key={id}>
                    <Icon name={RELIC_MAP[id].icon} />
                    <strong>{RELIC_MAP[id].name}</strong>
                    <p>{RELIC_MAP[id].text}</p>
                  </div>
                ))}
              </div>
            </>
          ) : modal === 'replace' ? (
            <>
              <p>Текущий поход будет заменён, когда вы нажмёте «В путь». Журнал сохранится.</p>
              <div className="modal-actions">
                <button className="secondary" onClick={() => setModal(null)}>
                  Продолжить текущий
                </button>
                <button
                  className="primary"
                  onClick={() => {
                    setModal(null)
                    setView('start')
                  }}
                >
                  Выбрать новый отряд
                </button>
              </div>
            </>
          ) : modal === 'deck' ? (
            <>
              <p className="muted">
                Карты трёх героев составляют общую колоду. В начале хода вы берёте 5 карт. Сброс
                перемешивается, когда колода заканчивается.
              </p>
              <div className="catalog">
                {run?.deck.map((c) => (
                  <ActionCard key={c.uid} card={c} />
                ))}
              </div>
            </>
          ) : modal === 'help' ? (
            <>
              <ol className="help-steps">
                <li>
                  <strong>Первые 15 остановок — только начало.</strong>
                  <p>
                    После дракона можно записать рекорд или сохранить сборку и продолжить в
                    процедурной бездне. На дороге выбирайте бои, встречи, торговца или привал.
                    Здоровье между боями сохраняется.
                  </p>
                </li>
                <li>
                  <strong>Посмотрите, кого атакуют враги.</strong>
                  <p>
                    Над каждым врагом видны урон и имя цели. Защита поглощает урон и обновляется в
                    начале вашего хода.
                  </p>
                </li>
                <li>
                  <strong>Выберите карту, затем её цель.</strong>
                  <p>
                    Число слева — стоимость. У отряда 3 энергии на ход. Массовые карты срабатывают
                    сразу.
                  </p>
                </li>
                <li>
                  <strong>Завершите ход, когда готовы.</strong>
                  <p>
                    Яд наносит урон перед действиями врагов, затем убывает на 1. Уязвимость
                    усиливает атаки на 50%. После 7-го хода враги усиливаются на 2 урона каждый ход.
                  </p>
                </li>
                <li>
                  <strong>Соберите свою связку.</strong>
                  <p>
                    За победу — монеты и выбор одной карты. Можно пропустить награду. Реликвии
                    работают весь поход. Павшего героя можно поднять на привале; победа над боссом
                    возвращает всех.
                  </p>
                </li>
              </ol>
              <div className="help-extra">
                <h3>Связки и очки</h3>
                <p>
                  Чередуйте владельцев карт: третья карта серии даёт добор, пятая — энергию. Каждый
                  бонус срабатывает один раз за ход. Повтор того же героя начинает серию заново.
                  Быстрые бои, элита, отсутствие ран и длинные серии повышают счёт. После каждого
                  круга выбирайте дар и готовьтесь к новому знамению.
                </p>
              </div>
              <h3>Что умеет каждый герой</h3>
              <div className="hero-guide">
                {Object.values(HEROES).map((h) => (
                  <div key={h.id}>
                    <Portrait hero={h.id} small />
                    <p>
                      <strong>
                        {h.name} · {h.role}
                      </strong>
                      <br />
                      {h.passive}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="stats">
                <div>
                  <strong>{profile.runs}</strong>
                  <span>походов</span>
                </div>
                <div>
                  <strong>{profile.wins}</strong>
                  <span>побед</span>
                </div>
                <div>
                  <strong>
                    {profile.seenCards.length}
                    <small> / {CARDS.length}</small>
                  </strong>
                  <span>карт найдено</span>
                </div>
              </div>
              <h3>
                Реликвии · {profile.seenRelics.length}/{RELICS.length}
              </h3>
              <div className="journal-relics">
                {RELICS.map((r) => (
                  <div
                    key={r.id}
                    className={profile.seenRelics.includes(r.id) ? '' : 'undiscovered'}
                  >
                    <Icon name={r.icon} />
                    <strong>{profile.seenRelics.includes(r.id) ? r.name : 'Не найдено'}</strong>
                    <p>
                      {profile.seenRelics.includes(r.id) ? r.text : 'Впереди ещё одна находка.'}
                    </p>
                  </div>
                ))}
              </div>
              <h3>Последние походы</h3>
              {profile.history.length ? (
                <div className="history">
                  {profile.history.map((h, i) => (
                    <div key={i}>
                      <Icon name={h.won ? 'flag' : 'map'} size={17} />
                      <strong>{h.score?.toLocaleString('ru-RU') ?? '—'} очков</strong>
                      <span>{modes[h.mode]}</span>
                      <small>{new Date(h.date).toLocaleDateString('ru-RU')}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">Первая история ещё впереди.</p>
              )}
              <details>
                <summary>Найденные карты</summary>
                <div className="catalog">
                  {CARDS.filter((c) => profile.seenCards.includes(c.id)).map((c) => (
                    <ActionCard key={c.id} card={{ id: c.id, uid: c.id, upgraded: false }} />
                  ))}
                </div>
              </details>
            </>
          )}
        </Modal>
      )}
    </div>
  )
}
export default App
