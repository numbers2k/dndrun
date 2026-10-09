import { CARD_MAP, HEROES } from './data'
import type { Run, Profile } from './types'

export function actionFeedback(before: Run | null, after: Run, targetIndex?: number) {
  if (
    !before?.combat ||
    !after.combat ||
    before.phase !== 'combat' ||
    after.combat.played <= before.combat.played ||
    after.combat.turn !== before.combat.turn
  )
    return null
  const card = before.combat.hand.find(
    (c) => !after.combat!.hand.some((x) => x.uid === c.uid) && after.combat!.spent?.includes(c.uid),
  )
  if (!card) return null
  const d = CARD_MAP[card.id]
  const damage = before.combat.enemies.reduce(
    (n, e) =>
      n + Math.max(0, e.hp - (after.combat!.enemies.find((x) => x.uid === e.uid)?.hp ?? e.hp)),
    0,
  )
  const heal =
    d.heal && after.phase === 'combat'
      ? (d.target === 'all'
          ? before.party
          : targetIndex === undefined
            ? []
            : [before.party[targetIndex]]
        ).reduce(
          (n, h) =>
            n +
            (h?.hp > 0
              ? Math.min(
                  d.heal! +
                    (d.hero === 'priest' ? 2 : 0) +
                    (before.relics.includes('herbs') ? 2 : 0),
                  h.maxHp - h.hp,
                )
              : 0),
          0,
        )
      : 0
  const shield = before.party.reduce(
    (n, h, i) => n + Math.max(0, after.party[i].block - h.block),
    0,
  )
  const kind = d.damage
    ? 'attack'
    : d.poison
      ? 'poison'
      : d.heal
        ? 'heal'
        : d.block
          ? 'guard'
          : 'setup'
  const relay =
    [before.combat.guardRelay, before.combat.poisonRelay]
      .filter((x) => d.damage && x && x.hero !== d.hero)
      .reduce((n, x) => n + x!.bonus, 0) + (d.damage ? (before.combat.reserve ?? 0) : 0)
  return {
    kind,
    hero: d.hero,
    name: d.name,
    damage,
    heal,
    shield,
    chain: after.combat.chain,
    title: `${before.combat.lastHero && before.combat.lastHero !== d.hero ? HEROES[before.combat.lastHero].role + ' → ' : ''}${HEROES[d.hero].role}: ${d.name}`,
    detail:
      [
        damage ? `${damage} урона` : '',
        shield ? `+${shield} защиты` : '',
        heal ? `+${heal} здоровья` : '',
        d.poison ? 'яд наложен' : '',
        d.vulnerable ? `уязвимость ${d.vulnerable} хода · атаки ×1,5` : '',
        relay ? `подготовка +${relay} силы` : '',
        after.combat.chain >= 3 ? `связка ${after.combat.chain}` : '',
      ]
        .filter(Boolean)
        .join(' · ') || 'Подготовка следующего действия',
  }
}

export function nextExperiment(r: Run, p: Profile): string {
  const party = r.startParty ?? r.party.map((h) => h.id)
  const other = p.unlockedHeroes.find((id) => !party.includes(id) && id !== 'priest')
  if (other)
    return `Следующий эксперимент: попробуйте героя ${HEROES[other].name} (${HEROES[other].role}) вместо одного спутника. ${HEROES[other].passive}`
  if (r.feats && r.feats.bestChain < 3)
    return 'Следующий эксперимент: три карты разных владельцев подряд дадут множитель и дополнительную карту. Начните с подготовки, затем ударьте другим героем.'
  if (p.wins >= 1)
    return 'Следующий эксперимент: короткая рука. Одна карта добора меньше — важнее выбирать награды и сохранять компактную колоду.'
  return 'Следующий эксперимент: найдите спутника в пути. Знакомство откроет его для стартового состава даже без замены в текущем походе.'
}
