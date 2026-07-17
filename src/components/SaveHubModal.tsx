import { useState } from 'react'
import { nextUnlockHint, trophyLabels, type CareerSave } from '../game/career'
import { clearRunState, hasRunState, loadRunState } from '../game/runSave'
import type { RunState } from '../game/types'
import { JournalModal } from './JournalModal'

interface SaveHubModalProps {
  save: CareerSave
  onClose: () => void
  onNewRun: () => void
  onContinue: (run: RunState) => void
  onAbandonRun: () => void
  onDelete: () => void
}

export function SaveHubModal({
  save,
  onClose,
  onNewRun,
  onContinue,
  onAbandonRun,
  onDelete,
}: SaveHubModalProps) {
  const { career } = save
  const [journalOpen, setJournalOpen] = useState(false)
  const trophies = trophyLabels(career)
  const paused = hasRunState(save.id)

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} role="presentation">
        <div
          className="modal-card save-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hub-save-title"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="modal-head">
            <div>
              <h2 id="hub-save-title">{save.teamName}</h2>
              <p>
                <span className="save-diff-badge">{save.difficultyLabel}</span>
                {' · '}
                {save.difficulty} перебросов
              </p>
            </div>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
              ×
            </button>
          </header>

          <div className="save-hub-stats">
            <p>
              Лучший этап: <strong>{career.bestStage}</strong>/100 · вылазок {career.runs} · пиров
              оборвано {career.crowns}
            </p>
            <p className="career-hint">{nextUnlockHint(career)}</p>
            {save.lastTip && <p className="career-last-tip">{save.lastTip}</p>}
            {trophies.length > 0 && (
              <p className="career-trophies">
                Трофеи: {trophies.join(' · ')}
              </p>
            )}
            <p className="career-meta">
              В журнале: рас {career.seenRaces.length} · классов {career.seenClasses.length} ·
              подклассов {career.seenSubclasses.length} · спеллов {career.seenSpellIds.length} ·
              краёв {(career.seenRegions ?? []).length}
            </p>
            <p className="career-meta">
              Пул гильдии: тир 0–{career.maxSpellTier} · школ {career.unlockedSchools.length}
            </p>
            {paused && (
              <p className="career-hint">
                Есть незавершённая вылазка — можно продолжить или бросить.
              </p>
            )}
          </div>

          <footer className="save-modal-actions">
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (
                  window.confirm(
                    `Удалить запись гильдии «${save.teamName}»? Весь прогресс будет потерян.`,
                  )
                ) {
                  clearRunState(save.id)
                  onDelete()
                }
              }}
            >
              Удалить
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setJournalOpen(true)}>
              Журнал
            </button>
            {paused && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    if (
                      window.confirm(
                        'Бросить незавершённую вылазку? Прогресс этой вылазки будет потерян.',
                      )
                    ) {
                      clearRunState(save.id)
                      onAbandonRun()
                    }
                  }}
                >
                  Бросить вылазку
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const run = loadRunState(save.id)
                    if (run) onContinue(run)
                  }}
                >
                  Продолжить вылазку
                </button>
              </>
            )}
            {!paused && (
              <button type="button" className="btn btn-primary" onClick={onNewRun}>
                Новая вылазка
              </button>
            )}
            {paused && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  if (window.confirm('Начать новую вылазку и бросить текущую?')) {
                    clearRunState(save.id)
                    onNewRun()
                  }
                }}
              >
                Новая вместо текущей
              </button>
            )}
          </footer>
        </div>
      </div>
      {journalOpen && <JournalModal career={career} onClose={() => setJournalOpen(false)} />}
    </>
  )
}
