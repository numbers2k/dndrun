import type { RoleId } from './types'
import { ROLE_LABEL_FULL } from './types'

const NEED_POOL: { role: RoleId; label: string }[] = [
  { role: 'tank', label: 'Орда — нужен танк' },
  { role: 'support', label: 'Гнилая магия — нужна поддержка' },
  { role: 'scout', label: 'Засада — нужен разведчик' },
  { role: 'controller', label: 'Толпа — нужен контроль' },
  { role: 'striker', label: 'Толстая шкура — нужен удар' },
]

export interface RegionNeed {
  role: RoleId
  label: string
}

/** 1–2 свойства края, стабильные для одного id. */
export function regionNeeds(regionId: string): RegionNeed[] {
  let h = 0
  for (let i = 0; i < regionId.length; i += 1) {
    h = (h * 33 + regionId.charCodeAt(i)) >>> 0
  }
  const a = NEED_POOL[h % NEED_POOL.length]
  const b = NEED_POOL[(h >>> 3) % NEED_POOL.length]
  if (a.role === b.role) return [a]
  return [a, b]
}

export function needCovered(roles: RoleId[], have: Iterable<RoleId>): string {
  const set = new Set(have)
  const missing = roles.filter((r) => !set.has(r))
  if (missing.length === 0) return 'отряд закрывает'
  return `не хватает: ${missing.map((r) => ROLE_LABEL_FULL[r]).join(', ')}`
}
