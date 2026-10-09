import { HEROES, STARTERS, STARTER_PARTIES, CARD_MAP } from './data'
import { CONTRACT_IDS, CONTRACTS, DEFAULT_PARTY } from './contracts'
import type { HeroId, Run } from './types'

export const TRIALS = {
  swift: { name: 'До третьего заката', goal: 'Победите не позднее 3-го хода' },
  chain: { name: 'Общий язык', goal: 'Соберите связку из 4 карт за один ход' },
  flawless: { name: 'Без единой раны', goal: 'Победите без потери здоровья в бою' },
}
export interface Challenge {
  seed: string
  leader: HeroId
  party: HeroId[]
  mode: Run['mode']
  contract: import('./types').ContractId
  rules: 6
}
export function readChallenge(search: string): Challenge | null {
  const p = new URLSearchParams(search)
  const seed = p.get('seed'),
    requestedParty = p.get('party')?.split(',') as HeroId[] | undefined,
    leader = requestedParty?.[0],
    mode = p.get('mode') as Run['mode'],
    contract = (p.get('contract') ?? 'standard') as import('./types').ContractId
  const party: HeroId[] | undefined =
    requestedParty?.length === 1 && leader && STARTERS.includes(leader)
      ? STARTER_PARTIES[leader]
      : requestedParty
  if (
    p.get('rules') !== '6' ||
    !seed ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(seed) ||
    !leader ||
    !party ||
    party.length !== 3 ||
    new Set(party).size !== 3 ||
    party.some((id) => !(id in HEROES)) ||
    (contract === 'no-healer' && party.includes('priest')) ||
    !CONTRACT_IDS.includes(contract) ||
    (requestedParty?.length === 1 && !STARTERS.includes(leader)) ||
    !['normal', 'daily', 'hard'].includes(mode) ||
    (mode === 'daily' && (party.join(',') !== DEFAULT_PARTY.join(',') || contract !== 'standard'))
  )
    return null
  return { seed, leader, party: [...party], mode, contract, rules: 6 }
}
export function challengeUrl(r: Run, base: string): string | null {
  if (r.rules !== 6 || r.startParty?.length !== 3 || !/^[a-zA-Z0-9_-]{1,80}$/.test(r.seed))
    return null
  const url = new URL(base)
  url.search = new URLSearchParams({
    seed: r.seed,
    party: r.startParty!.join(','),
    mode: r.mode,
    contract: r.contract,
    rules: '6',
  }).toString()
  url.hash = ''
  return url.toString()
}
export function buildName(r: Run): string {
  if (r.relics.includes('volatile')) return 'Цепная реакция'
  if (r.relics.includes('anvil') && r.party.some((h) => h.id === 'duelist'))
    return 'Клинок за щитом'
  if (r.relics.includes('memory') || r.relics.includes('relay')) return 'Единый ритм'
  if (r.relics.includes('heavy')) return 'Тяжёлая рука'
  const poison = r.deck.filter((c) => CARD_MAP[c.id].poison).length
  if (poison >= 4) return 'Медленный яд'
  return HEROES[r.startLeader ?? r.party[0].id].title
}
export function runRecap(r: Run, base: string): string {
  const f = r.feats
  return [
    `DND RUN · ${buildName(r)} · ${r.score} очков`,
    `${r.cleared} остановок · ${r.party.map((h) => HEROES[h.id].role).join(' / ')}`,
    `Условия: ${CONTRACTS[r.contract].name}`,
    ...(f
      ? [
          `Пиковый урон ${f.bestHit} · связка ${f.bestChain} · прервано ритуалов ${f.interrupts} · испытаний ${f.trials}`,
        ]
      : []),
    'Попробуй тот же старт: ' + (challengeUrl(r, base) ?? r.seed),
    `Правила v0.${r.rules} · таблица рекордов локальная`,
  ].join('\n')
}
