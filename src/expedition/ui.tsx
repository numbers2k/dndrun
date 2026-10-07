import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { CARD_MAP, HEROES } from './data'
import { cardDescription, combatDescription, upgradeLevel } from './engine'
import { Icon } from './Art'
import type { Card, Run } from './types'
export function Meter({ value, max, shield = 0 }: { value: number; max: number; shield?: number }) {
  return (
    <div className="meter-wrap">
      <div className={`meter ${value / max < 0.3 ? 'critical' : ''}`}>
        <span style={{ width: `${Math.max(0, (value / max) * 100)}%` }} />
      </div>
      <span className="hp">
        <Icon name="heart" size={13} />
        {value} / {max}
      </span>
      {shield > 0 && (
        <span className="shield">
          <Icon name="shield" size={13} />
          {shield}
        </span>
      )}
    </div>
  )
}
export function ActionCard({
  card,
  onClick,
  disabled,
  selected,
  footer,
  context,
}: {
  card: Card
  context?: Run
  onClick?: () => void
  disabled?: boolean
  selected?: boolean
  footer?: string
}) {
  const d = CARD_MAP[card.id],
    hero = HEROES[d.hero]
  const content = (
    <>
      <div className="card-top">
        <span className="cost" title="Стоимость в энергии">
          {d.cost}
        </span>
        <span>{hero.role}</span>
        <Icon
          name={d.kind === 'attack' ? 'sword' : d.block ? 'shield' : d.heal ? 'heart' : 'spark'}
        />
      </div>
      <div className="card-symbol">
        <Icon
          name={
            d.damage
              ? 'sword'
              : d.poison
                ? 'drop'
                : d.block
                  ? 'shield'
                  : d.heal
                    ? 'heart'
                    : d.vulnerable
                      ? 'eye'
                      : 'spark'
          }
          size={34}
        />
      </div>
      <h3>
        {d.name}
        {card.upgraded && <span className="upgrade"> +{upgradeLevel(card)}</span>}
      </h3>
      <p>{context ? combatDescription(context, card) : cardDescription(card)}</p>
      <div className="card-bottom">
        {footer ??
          (d.target === 'enemy'
            ? 'Выберите врага'
            : d.target === 'ally'
              ? 'Выберите героя'
              : d.target === 'all'
                ? 'Все цели сразу'
                : 'Без выбора цели')}
        {d.exhaust && <small>Один раз за бой</small>}
      </div>
    </>
  )
  const style = { '--card-color': hero.color } as CSSProperties
  return onClick ? (
    <button
      className={`action-card ${selected ? 'selected' : ''}`}
      style={style}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
    >
      {content}
    </button>
  ) : (
    <article className="action-card" style={style}>
      {content}
    </article>
  )
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null),
    close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('button')?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current()
      if (e.key === 'Tab') {
        const items = [
          ...(ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a,input,summary,[tabindex="0"]',
          ) ?? []),
        ]
        const first = items[0],
          last = items.at(-1)
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', key)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', key)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [])
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" aria-label="Закрыть" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}
