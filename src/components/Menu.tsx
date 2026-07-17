import { useCallback, useState } from 'react'
import {
  createSave,
  deleteSave,
  listSlots,
  nextUnlockHint,
  type CareerSave,
  type DifficultyRerolls,
  type SlotIndex,
} from '../game/career'
import { CreateSaveModal } from './CreateSaveModal'
import { SaveHubModal } from './SaveHubModal'

interface MenuProps {
  onStartSave: (save: CareerSave) => void
  onSlotsChanged: () => void
}

export function Menu({ onStartSave, onSlotsChanged }: MenuProps) {
  const [slots, setSlots] = useState(() => listSlots())
  const [createSlot, setCreateSlot] = useState<SlotIndex | null>(null)
  const [hubSave, setHubSave] = useState<CareerSave | null>(null)

  const reload = useCallback(() => {
    setSlots(listSlots())
    onSlotsChanged()
  }, [onSlotsChanged])

  const handleCreate = (teamName: string, difficulty: DifficultyRerolls) => {
    if (createSlot === null) return
    const save = createSave(createSlot, teamName, difficulty)
    setCreateSlot(null)
    reload()
    onStartSave(save)
  }

  const handleDelete = () => {
    if (!hubSave) return
    deleteSave(hubSave.id)
    setHubSave(null)
    reload()
  }

  return (
    <div className="screen menu-saves">
      <div className="menu-hero-brand t-hero brand-mark">dndrun</div>

      <section className="save-slots" aria-label="Сейвы кампаний">
        {([0, 1, 2] as SlotIndex[]).map((slot) => {
          const save = slots[slot]
          if (!save) {
            return (
              <button
                key={slot}
                type="button"
                className="save-slot empty"
                onClick={() => setCreateSlot(slot)}
              >
                <span className="save-slot-plus">+</span>
                <span className="save-slot-empty-label">Новая кампания</span>
              </button>
            )
          }
          return (
            <button
              key={save.id}
              type="button"
              className="save-slot"
              onClick={() => setHubSave(save)}
            >
              <span className="save-slot-name">{save.teamName}</span>
              <span className="save-diff-badge">{save.difficultyLabel}</span>
              <span className="save-slot-stat">
                Лучший этап <strong>{save.career.bestStage}</strong>/100
              </span>
              <span className="save-slot-stat">Забегов {save.career.runs}</span>
              <span className="save-slot-hint">{nextUnlockHint(save.career)}</span>
            </button>
          )
        })}
      </section>

      {createSlot !== null && (
        <CreateSaveModal
          slot={createSlot}
          onCancel={() => setCreateSlot(null)}
          onConfirm={handleCreate}
        />
      )}

      {hubSave && (
        <SaveHubModal
          save={hubSave}
          onClose={() => setHubSave(null)}
          onNewRun={() => {
            const save = hubSave
            setHubSave(null)
            onStartSave(save)
          }}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
