import { useMemo } from 'react'
import { CLASS_LABEL } from '../data/labels'
import { buildRunAutopsy } from '../game/autopsy'
import { getSaveById, loadCareer } from '../game/career'
import { feastPlaceLabel, TOTAL_STAGES } from '../game/simulate'
import { rosterFromParty } from '../game/scoring'
import type { RunState } from '../game/types'
import { ROLE_LABEL_FULL } from '../game/types'

interface ResultSummaryProps {
  state: RunState
  onAgain: () => void
  onMenu: () => void
}

export function ResultSummary({ state, onAgain, onMenu }: ResultSummaryProps) {
  const result = state.result
  const roster = rosterFromParty(state.party)

  const careerSave = useMemo(() => {
    if (state.activeSaveId) return getSaveById(state.activeSaveId)
    return null
  }, [state.activeSaveId])

  const career = careerSave?.career ?? loadCareer()
  const history = careerSave?.history ?? state.history

  const autopsy = useMemo(
    () => (result ? buildRunAutopsy(result, result.score) : null),
    [result],
  )

  if (!result || !autopsy) return null

  const failedStageNum = result.perfect
    ? null
    : Math.min(result.stagesCleared + 1, TOTAL_STAGES)

  const deepRuns = history.filter((x) => (x.stages ?? 0) >= 30).length

  return (
    <section className="result-summary-block" aria-label="Итог вылазки">
      <div className="result-summary-inner">
        <header className="result-summary-head">
          <p className="result-eyebrow t-label">Итог вылазки · {state.teamName}</p>
          <h2 className="result-place t-hero">
            {result.perfect
              ? 'Пир оборван'
              : `Провал на этапе ${failedStageNum}/${TOTAL_STAGES}`}
          </h2>
          <p className="result-field-line">
            Среди обречённых — {autopsy.placeLabel} · {autopsy.record} · дальше всех ушёл:{' '}
            {autopsy.championName}
          </p>
        </header>

        {!result.perfect && (
          <div className="result-autopsy" aria-label="Разбор вылазки">
            <h3>Разбор</h3>
            {autopsy.reasons.length > 0 && (
              <p className="result-autopsy-reasons">
                {autopsy.reasons.join(' · ')}
              </p>
            )}
            <p className="result-autopsy-weak">
              Слабая ось: <strong>{autopsy.weakest.label}</strong> ({autopsy.weakest.value})
            </p>
            <p className="result-autopsy-tip">
              <strong>Что пробовать:</strong> {autopsy.tip}
            </p>
            {autopsy.failEncounters.length > 0 && (
              <ul className="result-encounter-log">
                {autopsy.failEncounters.map((m) => (
                  <li key={`${m.round}-${m.opponent}-${m.won ? 'w' : 'l'}`}>
                    <span>{m.opponent}</span>
                    <em className={m.won ? 'won' : 'lost'}>
                      {m.won ? 'победа' : 'поражение'} · сила {m.ourOvr} vs угроза{' '}
                      {m.theirOvr}
                    </em>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="result-summary-grid">
          <div className="result-left">
            <h3>Отряд</h3>
            <ul className="result-roster">
              {roster.map((adv) => {
                const poolIndex = result.score.assignment[adv.id]
                const spell =
                  poolIndex !== null && poolIndex !== undefined
                    ? state.spellPool[poolIndex]
                    : null
                return (
                  <li key={adv.id}>
                    <span className="result-role">{ROLE_LABEL_FULL[adv.role]}</span>
                    <div>
                      <strong>{adv.name}</strong>
                      <span>
                        {CLASS_LABEL[adv.classId]}
                        {spell ? ` · ${spell.name}` : ''}
                      </span>
                      {adv.quirk && <em className="result-quirk">{adv.quirk}</em>}
                    </div>
                    <em>{adv.ovr}</em>
                  </li>
                )
              })}
            </ul>

            <div className="result-scoreline">
              <div>
                <span>База</span>
                <strong>{result.score.axes.base}</strong>
              </div>
              <div>
                <span>Посадка</span>
                <strong>{result.score.axes.roleFit}</strong>
              </div>
              <div>
                <span>Спеллы</span>
                <strong className="syn">{result.score.axes.spellFit}</strong>
              </div>
              <div>
                <span>Связки</span>
                <strong className="chem">{result.score.axes.bondFit}</strong>
              </div>
              <div>
                <span>Роли</span>
                <strong>{result.score.axes.coverage}</strong>
              </div>
              <div>
                <span>Сила</span>
                <strong className="ovr">{result.score.overall}</strong>
              </div>
            </div>

            {result.unlocks.length > 0 && (
              <div className="unlock-banner">
                <strong>Новое открыто:</strong> {result.unlocks.join(' · ')}
              </div>
            )}

            <div className="result-actions-row">
              <button type="button" className="btn btn-primary" onClick={onAgain}>
                Новая вылазка
              </button>
              <button type="button" className="btn btn-secondary" onClick={onMenu}>
                В гильдию
              </button>
            </div>
          </div>

          <div className="result-right">
            <h3>Гильдия</h3>
            <div className="career-grid">
              <div>
                <strong>{career.runs}</strong>
                <span>Вылазок</span>
              </div>
              <div>
                <strong>{deepRuns}</strong>
                <span>Глубже 30</span>
              </div>
              <div>
                <strong>{career.bestStage}</strong>
                <span>Рекорд</span>
              </div>
            </div>

            <h3 className="result-subhead">Последние вылазки</h3>
            <ul className="career-runs">
              {history.slice(0, 9).map((h) => (
                <li key={`${h.date}-${h.ovr}`}>
                  <strong>{h.stages ?? '?'} эт.</strong>
                  <span>
                    сила {h.ovr}
                    {h.place ? ` · ${feastPlaceLabel(h.place)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
