import { CLASS_LABEL, RACE_LABEL } from '../data/labels'
import { nextUnlockHint, type CareerSave } from '../game/career'

interface SaveHubModalProps {
  save: CareerSave
  onClose: () => void
  onNewRun: () => void
  onDelete: () => void
}

export function SaveHubModal({ save, onClose, onNewRun, onDelete }: SaveHubModalProps) {
  const { career } = save

  return (
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
            Лучший этап: <strong>{career.bestStage}</strong>/100 · забегов {career.runs} · корон{' '}
            {career.crowns}
          </p>
          <p className="career-hint">{nextUnlockHint(career)}</p>
          <p className="career-meta">
            Расы: {career.unlockedRaces.map((r) => RACE_LABEL[r]).join(', ')}
          </p>
          <p className="career-meta">
            Классы: {career.unlockedClasses.map((c) => CLASS_LABEL[c]).join(', ')}
          </p>
          <p className="career-meta">
            Тир спеллов: 0–{career.maxSpellTier} · школы: {career.unlockedSchools.join(', ')}
          </p>
          {career.unlockedSubclasses.length > 0 && (
            <p className="career-meta">Подклассы: {career.unlockedSubclasses.length} открыто</p>
          )}
        </div>

        <footer className="save-modal-actions">
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              if (
                window.confirm(
                  `Удалить кампанию «${save.teamName}»? Весь прогресс будет потерян.`,
                )
              ) {
                onDelete()
              }
            }}
          >
            Удалить сейв
          </button>
          <button type="button" className="btn btn-primary" onClick={onNewRun}>
            Новый забег
          </button>
        </footer>
      </div>
    </div>
  )
}
