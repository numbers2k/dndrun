import { useState } from 'react'
import {
  DIFFICULTY_OPTIONS,
  type DifficultyRerolls,
  type SlotIndex,
} from '../game/career'

interface CreateSaveModalProps {
  slot: SlotIndex
  onCancel: () => void
  onConfirm: (teamName: string, difficulty: DifficultyRerolls) => void
}

export function CreateSaveModal({ slot, onCancel, onConfirm }: CreateSaveModalProps) {
  const [name, setName] = useState('')
  const [difficulty, setDifficulty] = useState<DifficultyRerolls>(3)
  const valid = name.trim().length >= 2 && name.trim().length <= 32

  return (
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <div
        className="modal-card save-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-save-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <h2 id="create-save-title">Новая кампания</h2>
            <p>Слот {slot + 1}. Сложность потом изменить нельзя.</p>
          </div>
          <button type="button" className="modal-close" onClick={onCancel} aria-label="Закрыть">
            ×
          </button>
        </header>

        <label className="save-field">
          <span>Название отряда</span>
          <input
            value={name}
            maxLength={32}
            placeholder="Например, Пепельные Псы"
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </label>

        <div className="save-field">
          <span>Сложность</span>
          <div className="save-diff-grid">
            {DIFFICULTY_OPTIONS.map((d) => (
              <button
                key={d.rerolls}
                type="button"
                className={`cfg-card ${difficulty === d.rerolls ? 'active' : ''}`}
                onClick={() => setDifficulty(d.rerolls)}
              >
                <strong>{d.label}</strong>
                <span>{d.sub}</span>
              </button>
            ))}
          </div>
        </div>

        <footer className="save-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!valid}
            onClick={() => onConfirm(name.trim(), difficulty)}
          >
            Создать и в путь
          </button>
        </footer>
      </div>
    </div>
  )
}
