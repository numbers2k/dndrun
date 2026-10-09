import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AREAS,
  CARDS,
  CARD_MAP,
  EVENTS,
  HEROES,
  KIND_LABEL,
  RELICS,
  RELIC_MAP,
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
  leaveEvent,
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
  takeRelic,
  comboMultiplier,
  damageBreakdown,
  targetDamage,
  upcomingBoss,
  retainCard,
  recruitVisitor,
} from './expedition/engine'
import { EnemyArt, Icon, Landscape, Portrait } from './expedition/Art'
import type { Card, HeroId, Run } from './expedition/types'
import { Leaderboard } from './expedition/Leaderboard'
import { BOONS, OMEN_MAP } from './expedition/endless'
import { BOSS_MAP, ENEMY_MAP, ENEMY_ROLES } from './expedition/encounters'
import { ActionCard, Meter, Modal } from './expedition/ui'
import './App.css'
import { relicHint, buildPlans, recruitPreview } from './expedition/synergies'
import { chainHint, turnOptions, turnForecast, allyEffect } from './expedition/guidance'
import { readChallenge, runRecap, buildName, TRIALS, type Challenge } from './expedition/challenges'
import { CONTRACTS, CONTRACT_IDS, DEFAULT_PARTY, contractUnlocked } from './expedition/contracts'
import { actionFeedback, nextExperiment } from './expedition/experience'
import { readSettings, writeSettings } from './expedition/settings'
import { partyCoverage } from './expedition/roster'

const modes = { normal: 'Свободный поход', daily: 'Приключение дня', hard: 'Опасный поход' }
function countPhrase(count: number, one: string, few: string, many: string) {
  const mod100 = count % 100,
    mod10 = count % 10
  return `${count} ${mod100 >= 11 && mod100 <= 14 ? many : mod10 === 1 ? one : mod10 >= 2 && mod10 <= 4 ? few : many}`
}
const routeIcons = {
  battle: 'sword',
  elite: 'skull',
  boss: 'skull',
  rest: 'camp',
  event: 'eye',
  shop: 'bag',
}
function App() {
  const [profile, setProfile] = useState(readProfile),
    [run, setRun] = useState(readRun)
  const [view, setView] = useState<'home' | 'start' | 'run'>('home'),
    [mode, setMode] = useState<Run['mode']>('normal'),
    [draftParty, setDraftParty] = useState<HeroId[]>([...DEFAULT_PARTY]),
    [contract, setContract] = useState<import('./expedition/types').ContractId>('standard'),
    [startStep, setStartStep] = useState<'contract' | 'party'>('contract'),
    [selectedSlot, setSelectedSlot] = useState(0),
    [rosterOpen, setRosterOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null),
    [modal, setModal] = useState<
      'help' | 'deck' | 'journal' | 'replace' | 'relics' | 'leaderboard' | null
    >(null)
  const [panel, setPanel] = useState<'upgrade' | 'remove' | null>(null),
    [notice, setNotice] = useState(''),
    [storageError, setStorageError] = useState(false),
    [sound, setSound] = useState(() => readSettings().sound)
  const [largeText, setLargeText] = useState(() => readSettings().largeText),
    [feedback, setFeedback] = useState<ReturnType<typeof actionFeedback>>(null),
    [unlockNotice, setUnlockNotice] = useState('')
  const audio = useRef<AudioContext | null>(null)
  const [challenge, setChallenge] = useState(() => readChallenge(window.location.search))
  const [pendingChallenge, setPendingChallenge] = useState<Challenge | null>(null)
  const [recruitSlot, setRecruitSlot] = useState<number | null>(null)
  const active = run && !['victory', 'defeat'].includes(run.phase)
  const coverage = partyCoverage(draftParty)
  useEffect(() => {
    setStorageError(!persist(run, profile))
  }, [run, profile])
  useEffect(() => {
    writeSettings({ sound, largeText })
  }, [sound, largeText])
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [view, run?.phase, startStep])
  function tone(kind = 'setup', chain = 0) {
    if (!sound) return
    try {
      audio.current ??= new AudioContext()
      const ctx = audio.current
      void ctx.resume()
      const osc = ctx.createOscillator(),
        gain = ctx.createGain()
      osc.type = kind === 'attack' ? 'triangle' : 'sine'
      const frequency =
        ({ attack: 180, guard: 300, heal: 650, poison: 230, setup: 420 } as Record<string, number>)[
          kind
        ] ?? 420
      osc.frequency.setValueAtTime(frequency + Math.min(9, chain) * 25, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(
        kind === 'heal' ? 850 : frequency * 0.7,
        ctx.currentTime + 0.12,
      )
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
  function change(next: Run, targetIndex?: number) {
    const result = record(next, profile)
    const f = actionFeedback(run, next, targetIndex)
    setFeedback(f)
    const discovered = result.profile.unlockedHeroes.filter(
      (id) => !profile.unlockedHeroes.includes(id),
    )
    if (discovered.length)
      setUnlockNotice(
        `Знакомство: ${discovered.map((id) => HEROES[id].role).join(', ')} теперь доступен для будущего стартового отряда.`,
      )
    setRun(result.run)
    setProfile(result.profile)
    setSelected(null)
    setPanel(null)
    setRecruitSlot(null)
    if (f) tone(f.kind, f.chain)
  }
  function playTarget(index: number) {
    if (!run || !selected) return
    const next = playCard(run, selected, index)
    change(next, index)
    if (next.phase === 'combat' && window.matchMedia('(max-width: 620px)').matches)
      requestAnimationFrame(() =>
        document.querySelector('.hand-toolbar')?.scrollIntoView({
          block: 'start',
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'instant'
            : 'smooth',
        }),
      )
  }
  function begin(nextMode: Run['mode']) {
    setPendingChallenge(null)
    setMode(nextMode)
    setContract('standard')
    setDraftParty([...DEFAULT_PARTY])
    setStartStep(nextMode === 'daily' ? 'party' : 'contract')
    setRosterOpen(false)
    if (active) setModal('replace')
    else setView('start')
  }
  function chooseContract(id: import('./expedition/types').ContractId) {
    if (!contractUnlocked(id, profile) || pendingChallenge) return
    setContract(id)
    if (id === 'no-healer' && draftParty.includes('priest')) {
      const available = profile.unlockedHeroes.filter(
        (hero) => hero !== 'priest' && !draftParty.includes(hero),
      )
      if (available.length) {
        const next = [...draftParty]
        next[next.indexOf('priest')] = available[0]
        setDraftParty(next)
      }
    }
    setStartStep('party')
  }
  function replacePartySlot(id: HeroId) {
    if (!profile.unlockedHeroes.includes(id) || (contract === 'no-healer' && id === 'priest'))
      return
    const next = [...draftParty],
      prior = next.indexOf(id)
    if (prior >= 0) {
      ;[next[selectedSlot], next[prior]] = [next[prior], next[selectedSlot]]
    } else next[selectedSlot] = id
    setDraftParty(next)
  }
  function start() {
    const seed =
      pendingChallenge?.seed ??
      (mode === 'daily'
        ? dailySeed()
        : `trail-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`)
    const party = pendingChallenge?.party ?? draftParty
    change(newRun(party[0], seed, mode, party, pendingChallenge?.contract ?? contract))
    setView('run')
    setNotice('')
    setUnlockNotice('')
    setChallenge(null)
    setPendingChallenge(null)
  }
  function selectCard(c: Card) {
    if (!run || !playable(run, c)) return
    const d = CARD_MAP[c.id]
    if (d.target === 'all' || d.target === 'self') change(playCard(run, c.uid, 0), 0)
    else {
      setSelected(selected === c.uid ? null : c.uid)
      if (selected !== c.uid && window.matchMedia('(max-width: 620px)').matches) {
        requestAnimationFrame(() =>
          document
            .querySelector(d.target === 'ally' ? '.battlefield .team' : '.enemy-row')
            ?.scrollIntoView({
              block: 'center',
              behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                ? 'instant'
                : 'smooth',
            }),
        )
      }
    }
  }
  const selectedCard = run?.combat?.hand.find((c) => c.uid === selected),
    target = selectedCard ? CARD_MAP[selectedCard.id].target : null
  const forecast = useMemo(() => (run ? turnForecast(run) : null), [run])
  function team(compact = false) {
    if (!run) return null
    return (
      <div className={`team ${compact ? 'compact-team' : ''}`}>
        {run.party.map((h, i) => {
          const d = HEROES[h.id],
            allyPreview =
              selectedCard && target === 'ally' ? allyEffect(run, selectedCard, i) : null,
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
              className={`hero-unit ${feedback?.hero === h.id ? 'acted-unit' : ''} ${h.hp <= 0 ? 'fallen' : ''} ${forecast?.falls[i] ? 'danger-unit' : ''} ${target === 'ally' && h.hp > 0 ? 'targetable' : ''}`}
              disabled={target !== 'ally' || h.hp <= 0}
              onClick={() => playTarget(i)}
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
                  ) : run.phase === 'combat' ? (
                    <>
                      <Icon name="sword" size={13} />
                      {forecast?.victory
                        ? 'Яд завершит бой'
                        : forecast?.falls[i]
                          ? `Падёт в конце хода · ${forecast.wounds[i]} ран`
                          : forecast?.wounds[i]
                            ? `${incoming} входящего · ${forecast.wounds[i]} ран в конце хода`
                            : 'Не потеряет здоровье в конце хода'}
                    </>
                  ) : (
                    d.passive
                  )}
                </p>
                {allyPreview && (
                  <small className="ally-preview">
                    +{allyPreview.heal} здоровья · +{allyPreview.block} защиты →{' '}
                    {allyPreview.wounds} ран в конце хода
                  </small>
                )}
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
        {challenge && (
          <div className="challenge-invite">
            <div>
              <strong>Поход по приглашению</strong>
              <p>
                {challenge.party.map((id) => HEROES[id].role).join(' · ')} ·{' '}
                {CONTRACTS[challenge.contract].name} · {challenge.seed}. Тот же старт, свои решения.
              </p>
            </div>
            <button
              className="primary"
              onClick={() => {
                setPendingChallenge(challenge)
                setMode(challenge.mode)
                setDraftParty([...challenge.party])
                setContract(challenge.contract)
                setStartStep('party')
                setRosterOpen(false)
                if (active) setModal('replace')
                else setView('start')
              }}
            >
              Принять вызов
            </button>
            <button className="text-button" onClick={() => setChallenge(null)}>
              Закрыть
            </button>
          </div>
        )}
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
              Три героя. Одна колода. Решает порядок карт.
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
          <h1>{startStep === 'contract' ? 'На каких условиях пойдём?' : 'Кто пойдёт с вами?'}</h1>
          <p>
            {startStep === 'contract'
              ? 'Начните с обычного похода. Победы открывают новые ограничения, а не прибавки к силе.'
              : 'Три героя, общая колода. Каждый приносит четыре стартовые карты и свою особенность.'}
          </p>
        </div>
        {startStep === 'contract' ? (
          <div className="contract-grid">
            {CONTRACT_IDS.map((id) => {
              const d = CONTRACTS[id],
                available = contractUnlocked(id, profile)
              return (
                <button
                  key={id}
                  className={`choice contract-choice ${id === contract ? 'chosen' : ''}`}
                  disabled={!available}
                  onClick={() => chooseContract(id)}
                >
                  <div className="eyebrow">{available ? `ОЧКИ ×${d.bonus}` : 'ЗАКРЫТО'}</div>
                  <h2>{d.name}</h2>
                  <p>{d.description}</p>
                  <small>
                    {available
                      ? 'Выбрать условия →'
                      : id === 'no-healer' && profile.wins > 0
                        ? 'Встретьте хотя бы одного нового спутника'
                        : d.unlock}
                  </small>
                </button>
              )
            })}
          </div>
        ) : (
          <>
            <div className="contract-summary">
              <strong>
                {CONTRACTS[contract].name} · очки ×{CONTRACTS[contract].bonus}
              </strong>
              <p>{CONTRACTS[contract].description}</p>
              {mode !== 'daily' && !pendingChallenge && (
                <button
                  className="text-button"
                  onClick={() => {
                    setStartStep('contract')
                    setRosterOpen(false)
                  }}
                >
                  ← Изменить условия
                </button>
              )}
            </div>
            <div className="draft-party">
              {draftParty.map((id, i) => (
                <article
                  key={i}
                  className={`draft-hero ${rosterOpen && i === selectedSlot ? 'chosen' : ''}`}
                >
                  <Portrait hero={id} />
                  <h2>{HEROES[id].role}</h2>
                  <p>{HEROES[id].passive}</p>
                  <small>
                    {HEROES[id].hp} здоровья · {i + 1}-е место
                  </small>
                  {rosterOpen && (
                    <button
                      className="secondary"
                      aria-pressed={i === selectedSlot}
                      onClick={() => setSelectedSlot(i)}
                    >
                      Заменить {HEROES[id].name}
                    </button>
                  )}
                  <details>
                    <summary>Стартовые карты</summary>
                    <p>
                      {[
                        HEROES[id].cards[0],
                        HEROES[id].cards[0],
                        HEROES[id].cards[1],
                        HEROES[id].cards[2],
                      ]
                        .map((c) => CARD_MAP[c].name)
                        .join(' · ')}
                    </p>
                  </details>
                </article>
              ))}
            </div>
            <p className="muted">
              Снаряжение для любого состава: Походный фонарь — 4 защиты каждому в первый ход. Страж
              / Следопыт / Целитель — рекомендуемый первый состав.
            </p>
            <p className="roster-coverage" role="status">
              В стартовых картах:{' '}
              {countPhrase(coverage.block, 'карта защиты', 'карты защиты', 'карт защиты')} ·{' '}
              {countPhrase(coverage.healing, 'карта лечения', 'карты лечения', 'карт лечения')}.
              {!coverage.block && ' В бою нет защиты картами.'}
              {coverage.block === 1 && ' Защиты картами мало.'}
              {!coverage.healing && ' Лечение доступно только в пути.'}
            </p>
            {mode !== 'daily' && !pendingChallenge && (
              <button className="secondary" onClick={() => setRosterOpen(!rosterOpen)}>
                {rosterOpen
                  ? 'Готово'
                  : `Изменить отряд · открыто ${profile.unlockedHeroes.length}/9`}
              </button>
            )}
            {rosterOpen && (
              <section className="roster-editor">
                <h3>Кто заменит {HEROES[draftParty[selectedSlot]].name}?</h3>
                <p>
                  Знакомство открывает героя для будущих стартов. Брать его в текущий отряд не
                  обязательно. Повтор героя меняет места; бонуса за первое место нет.
                </p>
                <div className="roster-grid">
                  {(Object.keys(HEROES) as HeroId[]).map((id) => {
                    const known = profile.unlockedHeroes.includes(id),
                      forbidden = contract === 'no-healer' && id === 'priest'
                    return (
                      <button
                        className={`roster-choice ${draftParty.includes(id) ? 'chosen' : ''}`}
                        key={id}
                        disabled={!known || forbidden}
                        onClick={() => replacePartySlot(id)}
                      >
                        <Portrait hero={id} small />
                        <strong>{HEROES[id].role}</strong>
                        <p>{HEROES[id].passive}</p>
                        <small>
                          {forbidden
                            ? 'Запрещён условиями похода'
                            : !known
                              ? 'Встретьте в пути или среди рекрутов'
                              : draftParty.includes(id)
                                ? 'Уже в отряде · поменять местами'
                                : 'Выбрать'}
                        </small>
                      </button>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}
        {mode === 'daily' && (
          <p className="muted">В приключении дня отряд фиксирован для всех игроков.</p>
        )}
        {pendingChallenge && (
          <p className="warning">
            Приглашение: {pendingChallenge.seed}. Состав и условия фиксированы. Незнакомые герои
            доступны только для этой попытки; коллекция не открывается ссылкой.
          </p>
        )}
        {startStep === 'party' && (
          <label className="name-field">
            Ваше имя в таблице рекордов
            <input
              maxLength={24}
              value={profile.nickname}
              placeholder="Странник"
              onChange={(e) => setProfile({ ...profile, nickname: e.target.value })}
            />
          </label>
        )}
        {startStep === 'party' && (
          <div className="start-bottom">
            <span>Победите трёх боссов. Затем вернитесь с рекордом или продолжите в бездну.</span>
            <button className="primary" onClick={start}>
              В путь <Icon name="arrow" size={18} />
            </button>
          </div>
        )}
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
              <div className="route-choice" key={n.id}>
                <button
                  className={`route-node ${n.kind}`}
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
                {n.trial && (
                  <details className="trial-offer">
                    <summary>Испытание · {TRIALS[n.trial].name}</summary>
                    <p>{TRIALS[n.trial].goal}. Врагам +2 к атаке.</p>
                    <small>
                      Успех: +15 монет и +80 очков × множитель. Провал: обычная награда.
                    </small>
                    <button
                      className="secondary"
                      onClick={() => change(chooseNode(run, n.id, true))}
                    >
                      Идти с испытанием
                    </button>
                  </details>
                )}
              </div>
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
          {b.turn >= 7 && (
            <p className="warning">
              Затяжной бой:{' '}
              {b.turn === 7
                ? 'со следующего хода враги усилят атаки на 2 за каждый новый ход.'
                : `атаки врагов уже усилены на ${Math.max(0, b.turn - 7) * 2}. Следующий ход добавит ещё 2.`}
            </p>
          )}
          {b.rule && (
            <div className="boss-rule">
              <Icon name="skull" size={20} />
              <div>
                <strong>
                  {BOSS_MAP[b.enemies.find((e) => BOSS_MAP[e.id])!.id].name} · правило боя
                </strong>
                <p>{BOSS_MAP[b.enemies.find((e) => BOSS_MAP[e.id])!.id].text}</p>
              </div>
            </div>
          )}
          {b.trial && (
            <div className="trial-active">
              <strong>Испытание · {TRIALS[b.trial].name}</strong>
              <span>{TRIALS[b.trial].goal} · врагам +2 к атаке</span>
              <small>
                {b.trial === 'chain'
                  ? `Лучшая связка: ${b.maxChain}/4`
                  : b.trial === 'swift'
                    ? `Ход ${b.turn}/3`
                    : `Получено ран: ${b.damageTaken}`}
              </small>
            </div>
          )}
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
                  : b.played === 0 && b.turn === 1
                    ? 'Выберите карту внизу, затем цель. Число в углу — цена из 3 энергии. Враги действуют после «Завершить ход».'
                    : b.chain >= 2
                      ? 'Вы уже чередуете героев. Следующий другой герой усилит атаку и может дать карту. Защита исчезает в начале нового хода.'
                      : 'Устранение врага отменяет его атаку. Защитите героя, который потеряет здоровье, или закончите ход, когда готовы.'}
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
                  onClick={() => playTarget(i)}
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
                            : e.intent.kind === 'support'
                              ? 'Поддержка'
                              : e.intent.kind === 'curse'
                                ? 'Проклятие'
                                : 'Подготовка'}
                        </strong>
                        <span>
                          {e.intent.damage
                            ? `→ ${e.intent.target === -1 ? 'весь отряд' : HEROES[run.party[e.intent.target].id].name}`
                            : e.intent.label}
                        </span>
                      </>
                    )}
                  </div>
                  <EnemyArt id={e.id} />
                  <h3>{e.name}</h3>
                  <span className="enemy-trait" title={ENEMY_MAP[e.id]?.trait}>
                    {ENEMY_ROLES[e.id]}
                  </span>
                  <Meter value={e.hp} max={e.maxHp} shield={e.block} />
                  <div className="statuses">
                    {forecast?.defeated[i] && (
                      <span className="poison-preview">Погибнет до ответной атаки</span>
                    )}
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
                    {e.intent.kind === 'ritual' && (
                      <span>Прервать: {Math.max(0, 10 - (e.damageThisTurn ?? 0))} ран</span>
                    )}
                  </div>
                  {selectedCard && damageBreakdown(run, selectedCard, i) && (
                    <small
                      className="damage-formula"
                      title="После каждого множителя урон округляется вниз. Здоровье ограничивает фактические раны; избыток может дать бонус добивания."
                    >
                      Сила {damageBreakdown(run, selectedCard, i)!.power} × связка{' '}
                      {damageBreakdown(run, selectedCard, i)!.multiplier} × метка{' '}
                      {damageBreakdown(run, selectedCard, i)!.vulnerable} − броня{' '}
                      {damageBreakdown(run, selectedCard, i)!.armor}
                      {' → '}
                      {damageBreakdown(run, selectedCard, i)!.impact} силы удара
                      {damageBreakdown(run, selectedCard, i)!.finisher > 0 && (
                        <>
                          {' '}
                          · добивание +{damageBreakdown(run, selectedCard, i)!.finisher} к бонусу
                          боя
                        </>
                      )}
                    </small>
                  )}
                </button>
              ))}
            </div>
            <details className="encounter-guide">
              <summary>Особенности врагов</summary>
              {b.enemies
                .filter((e) => e.hp > 0 && ENEMY_MAP[e.id])
                .map((e) => (
                  <p key={e.uid}>
                    <strong>{e.name}: </strong>
                    {ENEMY_MAP[e.id].trait}
                  </p>
                ))}
            </details>
            <div className="team-caption">
              ВАШ ОТРЯД <span>Выберите героя для защиты или лечения</span>
            </div>
            {team()}
          </div>
          <section className="hand">
            {feedback && (
              <div
                key={`${b.turn}-${b.played}`}
                className={`action-feedback ${feedback.kind} ${feedback.chain >= 3 ? 'strong-combo' : ''}`}
                role="status"
              >
                <strong>{feedback.title}</strong>
                <span>{feedback.detail}</span>
              </div>
            )}
            <div className="chain-meter">
              <Icon name="spark" size={18} />
              <strong>
                Связка {b.chain} · урон ×{comboMultiplier(run)}
              </strong>
              <span>{chainHint(run)}</span>
              <details className="chain-rules">
                <summary>Правила серии</summary>
                <p>
                  3 → ×1,25 и добор · 5 → ×1,5 и энергия · 7 → ×1,75 · 9 → ×2. Добор и энергия — раз
                  за ход. Новый ход сбрасывает серию.
                  {run.relics.includes('conductor') && ' Камертон: ещё +0,25 с третьей карты.'}
                </p>
              </details>
            </div>
            {(b.finisher ?? 0) > 0 && (
              <p className="finisher-status" role="status">
                Завершающий удар: {b.finisher}/150 к очкам боя. Учитывается лучший за бой.
              </p>
            )}
            {(b.poisonRelay || b.guardRelay) && (
              <div className="primed-bonuses" role="status">
                {b.poisonRelay && (
                  <span>
                    Проводник яда: +{b.poisonRelay.bonus} к атаке героя кроме{' '}
                    {HEROES[b.poisonRelay.hero].name}
                  </span>
                )}
                {b.guardRelay && (
                  <span>
                    Клятва щита: +{b.guardRelay.bonus} к атаке героя кроме{' '}
                    {HEROES[b.guardRelay.hero].name}
                  </span>
                )}
              </div>
            )}
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
            <p className="turn-options">
              {turnOptions(run).playable > 0
                ? `Доступно карт для розыгрыша: ${turnOptions(run).playable}${turnOptions(run).free ? `, бесплатных: ${turnOptions(run).free}` : ''}. Остаток энергии не переносится.`
                : 'Доступных карт нет. Завершите ход: враги ответят, затем вы получите новую руку и энергию.'}
            </p>
            {forecast && (
              <p
                className={`turn-forecast ${forecast.falls.some(Boolean) ? 'danger-forecast' : ''}`}
              >
                {forecast.victory
                  ? 'Завершение хода: яд добьёт врагов, ответных атак не будет.'
                  : `Завершение хода сейчас: отряд потеряет ${forecast.wounds.reduce((n, x) => n + x, 0)} здоровья${
                      forecast.falls.some(Boolean)
                        ? ` · падут: ${run.party
                            .filter((_, i) => forecast.falls[i])
                            .map((h) => HEROES[h.id].name)
                            .join(', ')}`
                        : ''
                    }.`}
              </p>
            )}
            <div className="hand-cards">
              {b.hand.map((c) => (
                <div className="hand-slot" key={c.uid}>
                  <ActionCard
                    key={c.uid}
                    card={c}
                    onClick={() => selectCard(c)}
                    disabled={!playable(run, c)}
                    selected={selected === c.uid}
                    context={run}
                  />
                  {b.retainReady && !CARD_MAP[c.id].junk && (
                    <button
                      className="retain-button"
                      aria-pressed={b.retained === c.uid}
                      onClick={() => {
                        setRun(retainCard(run, c.uid))
                        setSelected(null)
                      }}
                    >
                      {b.retained === c.uid
                        ? 'Оставлена на следующий ход'
                        : 'Оставить на следующий ход'}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="battle-bottom">
              <span>
                Колода {b.draw.length} · Сброс {b.discard.length} · Исчезло {b.exhausted.length}
                {run.rules >= 5 && <small> · Каждый экземпляр карты — один раз за ход</small>}
                {run.rules >= 6 && (
                  <small>
                    {' '}
                    · Дополнительный добор {b.bonusDraw ?? 0}/4 за ход (карты, связка и Провидец
                    вместе)
                  </small>
                )}
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
          {feedback && (
            <div className={`action-feedback ${feedback.kind}`} role="status">
              <strong>{feedback.title}</strong>
              <span>{feedback.detail}</span>
            </div>
          )}
          <div className="score-breakdown">
            <strong>+{run.lastScore.total} очков</strong>
            <span>
              Бой {run.lastScore.base} · темп {run.lastScore.speed} · без ран{' '}
              {run.lastScore.flawless} · связка {run.lastScore.combo}
              {run.lastScore.finisher !== undefined && ` · добивание ${run.lastScore.finisher}`}
            </span>
            <small>Множитель круга и режима уже учтён</small>
          </div>
          {rw.trial && (
            <p className={rw.trial.success ? 'trial-success' : 'muted'}>
              {TRIALS[rw.trial.id].name}:{' '}
              {rw.trial.success
                ? 'выполнено · +15 монет включены в награду · дополнительные очки за испытание уже в общем счёте'
                : 'условие не выполнено · обычная награда сохранена'}
            </p>
          )}
          <p className="reward-step">
            {rw.relicChoices?.length
              ? 'Шаг 1 из 2 · выберите реликвию. После выбора появятся карты и спутник.'
              : 'Выберите карту или сохраните колоду компактной. Спутник — необязательный выбор.'}
          </p>
          {!!rw.relicChoices?.length && (
            <>
              <h3 className="subheading">
                Выберите реликвию <small>Как изменится ваша сборка?</small>
              </h3>
              <div className="relic-choices">
                {rw.relicChoices.map((id) => (
                  <button key={id} className="choice" onClick={() => change(takeRelic(run, id))}>
                    <Icon name={RELIC_MAP[id].icon} size={28} />
                    <strong>{RELIC_MAP[id].name}</strong>
                    <p>{RELIC_MAP[id].text}</p>
                    <small className="synergy-hint">{relicHint(run, id)}</small>
                    <span>Забрать</span>
                  </button>
                ))}
              </div>
            </>
          )}
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
          {rw.recruit && !rw.relicChoices?.length && (
            <details className="recruit recruit-review">
              <summary>{HEROES[rw.recruit].name} хочет присоединиться · сравнить спутников</summary>
              <Portrait hero={rw.recruit} small />
              <div>
                <h3>{HEROES[rw.recruit].name} хочет присоединиться</h3>
                <p>
                  {HEROES[rw.recruit].role} · {HEROES[rw.recruit].passive} Можно заменить одного
                  героя вместе с его картами. Новые карты заменят текущий выбор награды.
                </p>
                <div className="recruit-actions">
                  {run.party.map((h, i) => (
                    <button className="secondary" key={h.id} onClick={() => setRecruitSlot(i)}>
                      Сравнить с {HEROES[h.id].name}
                    </button>
                  ))}
                </div>
                {recruitSlot !== null &&
                  (() => {
                    const preview = recruitPreview(run, recruitSlot, rw.recruit!)!
                    return (
                      <div className="recruit-comparison">
                        <p>
                          Уйдёт {preview.old}: потеряете {preview.lost} карт, из них улучшенных —{' '}
                          {preview.upgraded}. Придут 4 базовые карты: {preview.newCards.join(', ')}.
                          Реликвии сохранятся, выбор карт награды обновится.
                        </p>
                        <button
                          className="secondary"
                          onClick={() => change(recruit(run, recruitSlot))}
                        >
                          Принять {HEROES[rw.recruit!].name} вместо {preview.old}
                        </button>
                      </div>
                    )
                  })()}
              </div>
            </details>
          )}
          {!rw.relicChoices?.length && (
            <>
              <h3 className="subheading">
                Добавьте одну карту <small>Можно пропустить, чтобы чаще брать лучшие карты</small>
              </h3>
              <div className="reward-cards">
                {rw.cards.map((c) => (
                  <ActionCard
                    key={c.uid}
                    card={c}
                    disabled={!!rw.relicChoices?.length}
                    onClick={() => change(takeReward(run, c.uid))}
                    footer="Добавить в колоду"
                  />
                ))}
              </div>
            </>
          )}
          <button
            className={run.depth % 15 === 0 ? 'primary' : 'secondary'}
            disabled={!!rw.relicChoices?.length}
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
              Следующий круг: здоровье врагов ×{Math.pow(1.3, run.depth / 15).toFixed(2)}, атаки +
              {(run.depth / 15) * 3}, новое случайное знамение. Очки ×
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
                      upgradePreview
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
      const eventCost =
        ({ 1: 25, 3: 20, 5: 15, 8: 25, 9: 15, 11: 20 } as Record<number, number>)[run.eventId] ?? 0
      const choices =
        run.eventId === 9
          ? run.shopCards
          : run.deck.filter((c) => ![3, 10].includes(run.eventId) || canUpgrade(c))
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
          {run.eventId === 4 && run.visitor && (
            <div className="recruit">
              <Portrait hero={run.visitor} />
              <div>
                <h3>
                  {HEROES[run.visitor].name} · {HEROES[run.visitor].role}
                </h3>
                <p>{HEROES[run.visitor].passive}</p>
                <div className="recruit-actions">
                  {run.party.map((h, i) => (
                    <button className="secondary" key={h.id} onClick={() => setRecruitSlot(i)}>
                      Сравнить с {HEROES[h.id].name}
                    </button>
                  ))}
                </div>
                {recruitSlot !== null &&
                  (() => {
                    const preview = recruitPreview(run, recruitSlot, run.visitor!)!
                    return (
                      <div className="recruit-comparison">
                        <p>
                          Уйдёт {preview.old}: потеряете {preview.lost} карт, из них улучшенных —{' '}
                          {preview.upgraded}. Придут 4 базовые карты: {preview.newCards.join(', ')}.
                          Реликвии сохранятся.
                        </p>
                        <button
                          className="secondary"
                          onClick={() => change(recruitVisitor(run, recruitSlot))}
                        >
                          Принять {HEROES[run.visitor!].name} вместо {preview.old}
                        </button>
                      </div>
                    )
                  })()}
                <details>
                  <summary>Карты нового спутника</summary>
                  <div className="catalog">
                    {HEROES[run.visitor].cards.map((id) => (
                      <ActionCard key={id} card={{ id, uid: id, upgraded: false }} />
                    ))}
                  </div>
                </details>
              </div>
            </div>
          )}
          {panel && [3, 6, 9, 10].includes(run.eventId) ? (
            <>
              <h3 className="subheading">Выберите карту</h3>
              <div className="catalog">
                {choices.map((c) => (
                  <ActionCard
                    key={c.uid}
                    card={c}
                    onClick={() => change(eventChoice(run, 'a', c.uid))}
                    upgradePreview={[3, 10].includes(run.eventId)}
                    footer={
                      run.eventId === 3
                        ? 'Перековать · 20 монет'
                        : run.eventId === 6
                          ? 'Удалить · получить 10 монет'
                          : run.eventId === 10
                            ? 'Улучшить · Пепел навсегда в колоду'
                            : 'Выучить · 15 монет'
                    }
                  />
                ))}
              </div>
              <button className="secondary" onClick={() => setPanel(null)}>
                Назад
              </button>
            </>
          ) : (
            <div className="event-options">
              {run.eventId !== 4 && (
                <button
                  className="choice"
                  disabled={
                    run.gold < eventCost ||
                    (run.eventId === 6 && run.deck.length <= 6) ||
                    ([3, 10].includes(run.eventId) && !choices.length)
                  }
                  onClick={() =>
                    [3, 6, 9, 10].includes(run.eventId)
                      ? setPanel('upgrade')
                      : change(eventChoice(run, 'a'))
                  }
                >
                  <h3>{e.a}</h3>
                  <p>{e.aText}</p>
                  <Icon name="arrow" />
                </button>
              )}
              <button
                className="choice"
                disabled={run.eventId === 11 && run.gold < 20}
                onClick={() => change(eventChoice(run, 'b'))}
              >
                <h3>{e.b}</h3>
                <p>{e.bText}</p>
                <Icon name="arrow" />
              </button>
            </div>
          )}
          {run.eventId === 11 && (
            <button className="text-button" onClick={() => change(leaveEvent(run))}>
              Уйти без сделки
            </button>
          )}
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
            {run.phase === 'defeat' && b && (
              <div className="defeat-review">
                <strong>
                  {b.name} · последний ход {b.turn}
                </strong>
                <p>Последние события боя:</p>
                <ol>
                  {b.log
                    .slice(0, 4)
                    .reverse()
                    .map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                </ol>
              </div>
            )}
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
            <div className="run-recap">
              <strong>{buildName(run)}</strong>
              {run.feats && (
                <p>
                  Пиковый урон {run.feats.bestHit} · связка {run.feats.bestChain}
                  <br />
                  Прервано ритуалов {run.feats.interrupts} · выполнено испытаний {run.feats.trials}
                </p>
              )}
              <small>
                {run.seed} · {modes[run.mode]} · {CONTRACTS[run.contract].name}
                <br />
                Старт:{' '}
                {(run.startParty ?? run.party.map((h) => h.id))
                  .map((id) => HEROES[id].role)
                  .join(' / ')}
              </small>
              <p>{nextExperiment(run, profile)}</p>
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
                  const text = runRecap(run, window.location.href)
                  void navigator.clipboard?.writeText(text).then(
                    () => setNotice('Результат скопирован — можно отправить друзьям.'),
                    () => setNotice(text),
                  )
                  if (!navigator.clipboard) setNotice(text)
                }}
              >
                Скопировать результат и вызов другу
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
        {run.phase === 'route' && (
          <details className="boss-forecast" open>
            <summary>
              Босс на остановке {Math.ceil((run.depth + 1) / 5) * 5}: {upcomingBoss(run).name}
            </summary>
            <p>{upcomingBoss(run).text}</p>
            <small>
              Подготовьте колоду и покупки заранее. После пятой остановки области — новая награда.
            </small>
          </details>
        )}
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
        {run.pact && (
          <p className="pact-status">
            Договор проводника: ещё {run.pact.remaining} боя ·{' '}
            {run.pact.kind === 'guard' ? '+6 защиты каждому в первый ход' : '+6 силы первой атаке'}
          </p>
        )}
      </>
    )
  }
  return (
    <div className={`${view === 'run' ? 'app in-run' : 'app'} ${largeText ? 'large-text' : ''}`}>
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
          <button
            className="text-button"
            aria-pressed={largeText}
            aria-label="Крупный текст"
            onClick={() => setLargeText(!largeText)}
          >
            Аа
          </button>
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
        {unlockNotice && (
          <div className="unlock-notice" role="status">
            <span>{unlockNotice}</span>
            <button className="text-button" onClick={() => setUnlockNotice('')}>
              Понятно
            </button>
          </div>
        )}
      </main>
      <footer>
        <span>dndrun · Путь отряда</span>
        <span>Поход сохраняется в этом браузере · v0.6</span>
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
              {run && (
                <details className="build-plans">
                  <summary>Сочетания вашей сборки</summary>
                  {buildPlans(run).map((p) => (
                    <article key={p.name}>
                      <strong>
                        {p.name} · {p.ready ? 'есть основа' : 'нужна подготовка'}
                      </strong>
                      <p>{p.text}</p>
                      <small>
                        {p.setup} → {p.finish}
                      </small>
                    </article>
                  ))}
                </details>
              )}
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
                <h3>Награды и испытания</h3>
                <p>
                  Перед походом выберите условия, затем состав. Знакомства открывают новых героев
                  без прибавки к их силе. Дневной поход фиксирован. В правилах 0.6 все источники
                  дополнительного добора вместе дают не больше четырёх карт за ход; обычный добор в
                  начале хода в этот предел не входит.
                </p>
                <p>
                  После элиты и босса сначала выберите одну из трёх реликвий, затем карту. На
                  маршруте можно раскрыть необязательное испытание: враги получают +2 к атаке, а
                  выполнение условия даёт +15 монет и +80 очков с множителем. Неудача сохраняет
                  обычную награду. Ссылка в итогах позволяет другу попробовать тот же старт — без
                  общей сетевой таблицы.
                </p>
              </div>
              <div className="help-extra">
                <h3>Связки и очки</h3>
                <p>
                  Чередуйте владельцев карт: третья карта серии даёт добор, пятая — энергию. Каждый
                  бонус срабатывает один раз за ход. Повтор того же героя начинает серию заново.
                  Атаки на третьем шаге серии получают ×1,25 урона, на пятом ×1,5, седьмом ×1,75,
                  девятом ×2. Множитель применяется до уязвимости. Один экземпляр карты можно
                  сыграть только раз за ход; копии — отдельные карты. Быстрые бои, элита, отсутствие
                  ран и длинные серии повышают счёт. После каждого круга выбирайте дар и готовьтесь
                  к новому знамению.
                </p>
                <p>
                  Завершающий удар в серии от трёх карт даёт бонус за избыток урона после брони:
                  сила удара минус оставшееся здоровье. Учитывается только лучший такой удар за бой,
                  максимум 150 очков до множителя режима и круга. Яд, взрывы и призванные помощники
                  этот бонус не дают. Прогноз на цели показывает прибавку к текущему бонусу боя.
                </p>
              </div>
              <h3>Что умеет каждый герой</h3>
              <div className="help-extra">
                <h3>Враги и правила боссов</h3>
                <p>
                  Особенность следующего босса показана на маршруте. Печати снимаются картами двух
                  разных героев; повтор владельца может дать боссу броню. Призыв ограничен тремя
                  живыми врагами. Охотник отмечает цель за ход до удара. Ритуал обычного врага
                  прерывается, когда за ход он теряет 10 здоровья. Щитоносцы, знаменосцы и
                  проклинатели требуют своего порядка целей — подробности доступны под врагами.
                </p>
                <p>
                  Пепел нельзя сыграть: он исчезает после одного добора в конце хода; очищение
                  убирает его из всех стопок сразу. «Узел памяти» после связки ×3 позволяет выбрать
                  одну карту для следующего хода кнопкой под картой.
                </p>
              </div>
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
                    <small> / {CARDS.filter((c) => !c.junk).length}</small>
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
