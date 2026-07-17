import { useState } from 'react'
import { CLASS_LABEL, RACE_LABEL, spellLevelLabel } from '../data/labels'
import type { AdventurerDef, RadarVertex, RoleId } from '../game/types'
import { ROLE_LABEL_FULL } from '../game/types'

interface TeamRadarProps {
  vertices: RadarVertex[]
  ovr: number
  onAdventurerClick?: (adventurer: AdventurerDef) => void
  spellDrag?: boolean
  onSpellSwap?: (fromAdvId: string, toAdvId: string) => void
  assignment?: Record<string, number | null>
}

const ROLE_TONE: Record<RoleId, string> = {
  tank: 'tone-tank',
  striker: 'tone-striker',
  controller: 'tone-controller',
  support: 'tone-support',
  scout: 'tone-scout',
}

const PLAYER_R = 27
/** Половина компактной карточки героя в % квадрата радара. */
const HERO_HALF_W = 8.4
const HERO_HALF_H = 7.8
/** Вынос центра спелла за край героя по лучу — дальше, чтобы не наезжали. */
const SPELL_CLEAR = 8.8
const SPELL_GAP = 1.6

export function TeamRadar({
  vertices,
  ovr,
  onAdventurerClick,
  spellDrag,
  onSpellSwap,
}: TeamRadarProps) {
  const [dragFrom, setDragFrom] = useState<string | null>(null)
  const n = 5
  const angleOf = (index: number) => ((-90 + index * 72) * Math.PI) / 180

  const point = (index: number, radius: number) => {
    const a = angleOf(index)
    return {
      x: 50 + radius * Math.cos(a),
      y: 50 + radius * Math.sin(a),
    }
  }

  /** Радиус центра спелла: за внешней гранью карточки героя, одинаковый зазор по лучу. */
  const spellRadiusOf = (index: number) => {
    const a = angleOf(index)
    const c = Math.abs(Math.cos(a))
    const s = Math.abs(Math.sin(a))
    const toHeroEdge = Math.min(
      c > 0.04 ? HERO_HALF_W / c : Number.POSITIVE_INFINITY,
      s > 0.04 ? HERO_HALF_H / s : Number.POSITIVE_INFINITY,
    )
    return PLAYER_R + toHeroEdge + SPELL_CLEAR + SPELL_GAP
  }

  const ring = Array.from({ length: n }, (_, i) => point(i, PLAYER_R))
  const ringPoints = ring.map((p) => `${p.x},${p.y}`).join(' ')
  const glowPoints = Array.from({ length: n }, (_, i) => point(i, 42))
    .map((p) => `${p.x},${p.y}`)
    .join(' ')

  return (
    <div className="radar-wrap">
      <svg className="radar-svg" viewBox="0 0 100 100" role="img" aria-label="Сила отряда">
        <defs>
          <filter
            id="radar-pentagon-glow"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
          </filter>
        </defs>
        <polygon
          className="radar-glow"
          points={glowPoints}
          fill="#2a2a2a"
          fillOpacity={0.35}
          filter="url(#radar-pentagon-glow)"
        />
        <polygon className="radar-ring" points={ringPoints} fill="#1e1e1e" fillOpacity={0.2} />
        {ring.map((tip, i) => (
          <line key={i} className="radar-spoke" x1={50} y1={50} x2={tip.x} y2={tip.y} />
        ))}
        {ring.map((tip, i) => (
          <circle
            key={`anchor-${i}`}
            className="radar-anchor"
            cx={tip.x}
            cy={tip.y}
            r={1.4}
            fill="none"
            stroke="#454545"
            strokeWidth={0.35}
            strokeDasharray="0.7 0.55"
          />
        ))}
      </svg>

      <div className="radar-center">
        <div className="radar-ovr-value">{ovr || '—'}</div>
        <div className="radar-ovr-label">СИЛА ОТРЯДА</div>
      </div>

      {vertices.map((vertex, i) => {
        const playerPos = point(i, PLAYER_R)
        const spellPos = point(i, spellRadiusOf(i))
        const { slotIndex, role, adventurer, spell, spellOrphan } = vertex
        const tone = role ? ROLE_TONE[role] : ''

        return (
          <div key={slotIndex} className="radar-vertex">
            {adventurer ? (
              <button
                type="button"
                className={`radar-slot filled clickable ${tone} rarity-${adventurer.rarity}`}
                style={{ left: `${playerPos.x}%`, top: `${playerPos.y}%` }}
                onClick={() => onAdventurerClick?.(adventurer)}
                title="Открыть детали"
                onDragOver={(e) => {
                  if (spellDrag) e.preventDefault()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (!spellDrag || !dragFrom || !onSpellSwap) return
                  if (dragFrom !== adventurer.id) onSpellSwap(dragFrom, adventurer.id)
                  setDragFrom(null)
                }}
              >
                <span className="role-badge">{ROLE_LABEL_FULL[adventurer.role]}</span>
                <strong className="player-name">{adventurer.name}</strong>
                <span className="player-sub player-sub-stack">
                  <span>{RACE_LABEL[adventurer.race]}</span>
                  <span>{CLASS_LABEL[adventurer.classId]}</span>
                </span>
                <span className="radar-ovr" aria-hidden="true">
                  {adventurer.ovr}
                </span>
              </button>
            ) : (
              <div
                className={`radar-slot empty ${spellOrphan ? 'with-spell' : ''}`}
                style={{ left: `${playerPos.x}%`, top: `${playerPos.y}%` }}
                aria-hidden="true"
              />
            )}

            {spell && (
              <div
                className={`radar-spell-card ${spellOrphan || !adventurer ? 'orphan' : ''} ${spellDrag && adventurer ? 'draggable' : ''}`}
                style={{ left: `${spellPos.x}%`, top: `${spellPos.y}%` }}
                title={spell.name}
                draggable={Boolean(spellDrag && adventurer)}
                onDragStart={() => {
                  if (adventurer) setDragFrom(adventurer.id)
                }}
                onDragEnd={() => setDragFrom(null)}
              >
                <span className="role-badge">{spellLevelLabel(spell.level)}</span>
                <strong className="radar-spell-name">{spell.name}</strong>
                <span className="player-sub">{spell.school}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
