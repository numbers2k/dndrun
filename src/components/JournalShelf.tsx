import { useEffect, useState } from 'react'
import { prophecyRows } from '../data/prophecies'
import { SPELLS } from '../data/spells'
import { REGION_MAP, REGION_UNLOCK_TABLE } from '../data/regions'
import { nextUnlockHint, saveCareer, setActiveSave, type CareerSave } from '../game/career'
import { ASH_DOOR_COST, ASH_REROLL_COST, pullRumor, setSeals, spendAsh } from '../game/meta'

interface JournalShelfProps {
  save: CareerSave
  onChanged: () => void
}

export function JournalShelf({ save, onChanged }: JournalShelfProps) {
  const [note, setNote] = useState('')
  const career = save.career
  const rumor = pullRumor(career)
  const rows = prophecyRows(career).slice(0, 4)
  const locked = REGION_UNLOCK_TABLE.filter((row) => !career.unlockedRegions.includes(row.id)).slice(0, 3)
  const prints = (career.blueprints ?? [])
    .map((id) => SPELLS.find((spell) => spell.id === id)?.name)
    .filter((name): name is string => Boolean(name))
    .slice(-3)

  useEffect(() => {
    if ((rumor.career.rumorsSeenCount ?? 0) === (career.rumorsSeenCount ?? 0)) return
    setActiveSave(save.id)
    saveCareer(rumor.career)
    onChanged()
  }, [career.rumorsSeenCount, career.runs, onChanged, rumor.career, save.id])

  const act = (kind: 'reroll' | 'door') => {
    setNote(spendAsh(save.id, kind))
    onChanged()
  }

  return (
    <section className="journal-shelf" aria-label="Полка гильдии">
      {rumor.line && <p className="shelf-rumor">{rumor.line}</p>}
      <p className="shelf-next">{nextUnlockHint(career)}</p>
      <p className="shelf-ash">
        Пепел <strong>{career.ash ?? 0}</strong>
        {(career.bonusRerolls ?? 0) > 0 ? ' · переброс на вылазку' : ''}
      </p>
      {prints.length > 0 && <p className="shelf-ash">Чертежи: {prints.join(' · ')}</p>}
      <div className="shelf-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => act('reroll')}>
          Переброс · {ASH_REROLL_COST}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => act('door')}>
          Дверь · {ASH_DOOR_COST}
        </button>
      </div>
      {(career.crowns ?? 0) > 0 && (
        <div className="shelf-actions" aria-label="Печати Пира">
          {[0, 1, 2, 3].map((seal) => (
            <button
              key={seal}
              type="button"
              className={`btn btn-sm ${career.seals === seal ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setSeals(save.id, seal)
                onChanged()
              }}
            >
              Печать {seal}
            </button>
          ))}
        </div>
      )}
      <ul className="shelf-list">
        {rows.map((row) => (
          <li key={row.id}>
            {row.done ? '✓' : `${row.cur}/${row.goal}`} {row.text} → {row.reward}
          </li>
        ))}
        {locked.map((row) => (
          <li key={row.id}>
            закрыто · {REGION_MAP[row.id]?.name ?? row.label} · с главы {Math.ceil(row.stage / 10)}
          </li>
        ))}
      </ul>
      {note && <p className="shelf-note">{note}</p>}
    </section>
  )
}
