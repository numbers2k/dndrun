import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { CARD_MAP, HEROES } from './data'
import {
  cardDescription,
  combatDescription,
  upgradeLevel,
  cardCost,
  comboMultiplier,
} from './engine'
import { Icon } from './Art'
import type { Card, Run } from './types'
import { cardTags } from './synergies'
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
  upgradePreview = false,
}: {
  card: Card
  context?: Run
  upgradePreview?: boolean
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
          {context ? cardCost(context, card) : d.cost}
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
      {upgradePreview && (
        <small className="card-combo">
          После улучшения:{' '}
          {cardDescription({ ...card, upgraded: true, level: upgradeLevel(card) + 1 })}
        </small>
      )}
      {!context && <small className="card-combo">{cardTags(card).slice(0, 2).join(' · ')}</small>}
      {!context && d.heal && d.hero === 'priest' && (
        <small className="card-combo">Мира в бою добавит ещё 2 здоровья.</small>
      )}
      {!context && d.poison && d.hero === 'alchemist' && (
        <small className="card-combo">Нэра в бою добавит ещё 2 яда.</small>
      )}
      {context && d.damage && (
        <small className="card-combo">
          Следующая связка · урон ×{comboMultiplier(context, card)}
        </small>
      )}
      {context &&
        d.damage &&
        d.target === 'all' &&
        (context.combat?.areaAttacks ?? 0) >= 1 &&
        context.combat?.enemies.some((e) => e.hp > 0 && e.id === 'weaver') && (
          <small className="card-combo">
            Завеса: врагам +6 защиты за каждого живого плетельщика перед ударом.
          </small>
        )}
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
