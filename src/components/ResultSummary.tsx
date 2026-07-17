import { useMemo } from 'react'
import { CLASS_LABEL } from '../data/labels'
import { PATH_STAGES } from '../game/simulate'
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

  const career = useMemo(() => {
    const h = state.history
    return {
      runs: h.length,
      deep: h.filter((x) => (x.stages ?? 0) >= 30).length,
    }
  }, [state.history])

  if (!result) return null

  const failedStageNum = result.perfect
    ? null
    : Math.min(result.stagesCleared + 1, PATH_STAGES.length)

  return (
    <section className="result-summary-block" aria-label="Итог похода">
      <div className="result-summary-inner">
        <header className="result-summary-head">
          <p className="result-eyebrow t-label">Итог похода · {state.teamName}</p>
          <h2 className="result-place t-hero">
            {result.perfect
              ? 'Корона взята'
              : `Провал на этапе ${failedStageNum}/${PATH_STAGES.length}`}
          </h2>
        </header>

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

            <div className="result-actions-322">
              <button type="button" className="btn btn-primary" onClick={onAgain}>
                Новый забег
              </button>
              <button type="button" className="btn btn-secondary" onClick={onMenu}>
                В меню
              </button>
            </div>
          </div>

          <div className="result-right">
            <h3>Карьера</h3>
            <div className="career-grid">
              <div>
                <strong>{career.runs}</strong>
                <span>Всего</span>
              </div>
              <div>
                <strong>{career.deep}</strong>
                <span>Глубже 30</span>
              </div>
              <div>
                <strong>{state.history[0]?.stages ?? 0}</strong>
                <span>Последний</span>
              </div>
            </div>

            <h3 className="result-subhead">Последние забеги</h3>
            <ul className="career-runs">
              {state.history.slice(0, 9).map((h) => (
                <li key={`${h.date}-${h.ovr}`}>
                  <strong>{h.stages ?? '?'} эт.</strong>
                  <span>сила отряда {h.ovr}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
