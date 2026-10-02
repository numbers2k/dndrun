import { CLASS_LABEL, RACE_LABEL } from '../data/labels'
import { spellVerb, ROLE_VERB } from '../game/verbs'
import type { AdventurerDef, SpellDef } from '../game/types'
import { ROLE_LABEL_FULL } from '../game/types'

interface HeroPickCardProps {
  adventurer: AdventurerDef
  hint?: string | null
  disabled?: boolean
  teach?: boolean
  onPick: () => void
  onDetails: () => void
}

export function HeroPickCard({
  adventurer,
  hint,
  disabled,
  teach,
  onPick,
  onDetails,
}: HeroPickCardProps) {
  return (
    <div
      className={`player-card pickable compact rarity-${adventurer.rarity}${teach ? ' is-teach' : ''}${disabled ? ' is-disabled' : ''}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => {
        if (!disabled) onPick()
      }}
      onKeyDown={(event) => {
        if (disabled) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onPick()
        }
      }}
    >
      <span className="role-badge">{ROLE_LABEL_FULL[adventurer.role]}</span>
      <strong className="player-name">{adventurer.name}</strong>
      <span className="player-verb">{ROLE_VERB[adventurer.role]}</span>
      <span className="player-sub player-sub-stack">
        <span>
          {RACE_LABEL[adventurer.race]} · {CLASS_LABEL[adventurer.classId]}
        </span>
      </span>
      <span className="big-rating">{adventurer.ovr}</span>
      {adventurer.cursed && <span className="card-flag">проклятие · +пепел</span>}
      {hint && <span className="card-flag">{hint}</span>}
      <button
        type="button"
        className="card-more"
        onClick={(event) => {
          event.stopPropagation()
          onDetails()
        }}
      >
        ещё
      </button>
    </div>
  )
}

interface SpellPickCardProps {
  spell: SpellDef
  hint?: string | null
  blueprint?: boolean
  disabled?: boolean
  onPick: () => void
  onDetails: () => void
}

export function SpellPickCard({ spell, hint, blueprint, disabled, onPick, onDetails }: SpellPickCardProps) {
  return (
    <div
      className={`player-card pickable compact is-spell rarity-${spell.rarity}${disabled ? ' is-disabled' : ''}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => {
        if (!disabled) onPick()
      }}
      onKeyDown={(event) => {
        if (disabled) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onPick()
        }
      }}
    >
      <span className="role-badge">{spellVerb(spell)}</span>
      <strong className="player-name">{spell.name}</strong>
      <span className="player-sub">{spell.school}</span>
      {blueprint && <span className="card-flag">чертёж гильдии</span>}
      {hint && <span className="card-flag">{hint}</span>}
      <button
        type="button"
        className="card-more"
        onClick={(event) => {
          event.stopPropagation()
          onDetails()
        }}
      >
        ещё
      </button>
    </div>
  )
}
