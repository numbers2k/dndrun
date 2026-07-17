/** Единые константы баланса (карточки, дроп, путь, сила отряда). */

import type { CardRarity } from './types'

export interface RarityBand {
  ovrMin: number
  ovrMax: number
  axisMin: number
  axisMax: number
}

/** Веса дропа героев в паке. Легендарка — редкий праздник, не норма. */
export const HERO_RARITY_WEIGHTS: Record<CardRarity, number> = {
  common: 86,
  rare: 12,
  legendary: 2,
}

/** Веса дропа спеллов внутри отфильтрованного пула. */
export const SPELL_RARITY_WEIGHTS: Record<CardRarity, number> = {
  common: 80,
  rare: 16,
  legendary: 4,
}

/** Полосы героя с перекрытием (сильный common бьёт слабый rare). */
export const HERO_RARITY_BANDS: Record<CardRarity, RarityBand> = {
  common: { ovrMin: 60, ovrMax: 80, axisMin: 58, axisMax: 84 },
  rare: { ovrMin: 74, ovrMax: 90, axisMin: 70, axisMax: 92 },
  legendary: { ovrMin: 86, ovrMax: 100, axisMin: 82, axisMax: 100 },
}

/** Party overall. */
export const PARTY_OVERALL_MIN = 58
export const PARTY_OVERALL_MAX = 100
/**
 * overall ≈ PARTY_BASE + (meanOvr − PARTY_OVR_PIVOT) * PARTY_OVR_SCALE + skill.
 * OVR даёт якорь; skill ±12 решает спор «звёзды vs сетка».
 */
export const PARTY_BASE = 69
export const PARTY_OVR_PIVOT = 74
export const PARTY_OVR_SCALE = 0.22
export const PARTY_SKILL_MIN = -12
export const PARTY_SKILL_MAX = 12

/** Пороги economy для тяжёлых спеллов (новая шкала осей). */
export const SPELL_ECO_SOFT = 70
export const SPELL_ECO_HARD = 78

/** Кривая пути (region 0). Средний драфт без синергий должен сыпаться раньше гл.6. */
export const PATH_BASE = 66
export const PATH_PER_STAGE = 0.38
export const PATH_BOSS_BONUS = 5

/** Соперники на поле. */
export const FIELD_STRENGTH_MIN = 60
export const FIELD_STRENGTH_MAX = 100

/** Теги героя (пороги осей). */
export const TAG_FRONT = 82
export const TAG_GLASS = 68
export const TAG_RITUAL = 82
export const TAG_PRESSURE = 86
export const TAG_SCOUT_ECO = 76
