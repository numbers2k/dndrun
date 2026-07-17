import { useCallback, useState } from 'react'
import {
  createSave,
  deleteSave,
  listSlots,
  nextUnlockHint,
  trophyLabels,
  type CareerSave,
  type DifficultyRerolls,
  type SlotIndex,
} from '../game/career'
import { hasRunState } from '../game/runSave'
import type { RunState } from '../game/types'
import { CreateSaveModal } from './CreateSaveModal'
import { SaveHubModal } from './SaveHubModal'

interface MenuProps {
  onStartSave: (save: CareerSave) => void
  onContinueSave: (run: RunState) => void
  onAbandonRun: (saveId: string) => void
  onSlotsChanged: () => void
}

export function Menu({
  onStartSave,
  onContinueSave,
  onAbandonRun,
  onSlotsChanged,
}: MenuProps) {
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

  const trophyStrip = slots
    .filter(Boolean)
    .flatMap((s) => trophyLabels(s!.career))
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 6)

  return (
    <div className="screen menu-saves">
      <div className="menu-hero-brand t-hero brand-mark">dndrun</div>

      {slots.some(Boolean) && (
        <p className="menu-trophy-strip" aria-label="Трофеи">
          {slots
            .filter(Boolean)
            .map(
              (s) =>
                `${s!.teamName}: ${s!.career.bestStage}/100 · пиров ${s!.career.crowns}${
                  hasRunState(s!.id) ? ' · пауза' : ''
                }`,
            )
            .join('  ·  ')}
          {trophyStrip.length > 0 ? `  ·  ${trophyStrip.join(' · ')}` : ''}
        </p>
      )}

      <section className="save-slots" aria-label="Сейвы гильдии">
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
                <span className="save-slot-empty-label">Новая вылазка</span>
              </button>
            )
          }
          return (
            <button
              key={save.id}
              type="button"
              className={`save-slot${hasRunState(save.id) ? ' has-paused' : ''}`}
              onClick={() => setHubSave(save)}
            >
              <span className="save-slot-name">{save.teamName}</span>
              <span className="save-diff-badge">{save.difficultyLabel}</span>
              <span className="save-slot-stat">
                Лучший этап <strong>{save.career.bestStage}</strong>/100
              </span>
              <span className="save-slot-stat">
                Вылазок {save.career.runs} · пиров {save.career.crowns}
              </span>
              {hasRunState(save.id) && (
                <span className="save-slot-hint">Незавершённая вылазка</span>
              )}
              <span className="save-slot-hint">{nextUnlockHint(save.career)}</span>
              {save.lastTip && <span className="save-slot-tip">{save.lastTip}</span>}
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
          onContinue={(run) => {
            setHubSave(null)
            onContinueSave(run)
          }}
          onAbandonRun={() => {
            onAbandonRun(hubSave.id)
            reload()
          }}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
