import type { ClassId, RaceId } from './types'
import {
  ALL_CLASSES,
  ALL_RACES,
  SUBCLASSES,
  type SubclassId,
} from '../data/pools'

const LEGACY_CAREER_KEY = 'dndrun-career-v1'
const SAVES_KEY = 'dndrun-saves-v1'
const ACTIVE_KEY = 'dndrun-active-save'

export type DifficultyRerolls = 0 | 3 | 5
export type DifficultyLabel = 'Сложно' | 'Средне' | 'Отдых'
export type SlotIndex = 0 | 1 | 2

export interface CareerState {
  bestStage: number
  totalStages: number
  runs: number
  crowns: number
  unlockedRaces: RaceId[]
  unlockedClasses: ClassId[]
  unlockedSubclasses: SubclassId[]
  maxSpellTier: number
  unlockedSchools: string[]
}

export interface CareerSave {
  id: string
  slot: SlotIndex
  teamName: string
  difficulty: DifficultyRerolls
  difficultyLabel: DifficultyLabel
  createdAt: string
  updatedAt: string
  career: CareerState
  history: {
    seed: string
    record: string
    ovr: number
    place?: number
    stages?: number
    date: string
  }[]
}

export type SaveSlots = [CareerSave | null, CareerSave | null, CareerSave | null]

const STARTER_RACES: RaceId[] = ['human', 'elf', 'dwarf', 'halfling']
const STARTER_CLASSES: ClassId[] = ['fighter', 'wizard', 'cleric', 'rogue', 'ranger']
const STARTER_SCHOOLS = ['Воплощение', 'Ограждение', 'Очарование', 'Прорицание', 'Вызов']

export const DIFFICULTY_OPTIONS: {
  rerolls: DifficultyRerolls
  label: DifficultyLabel
  sub: string
}[] = [
  { rerolls: 0, label: 'Сложно', sub: '0 перебросов набора' },
  { rerolls: 3, label: 'Средне', sub: '3 переброса набора' },
  { rerolls: 5, label: 'Отдых', sub: '5 перебросов набора' },
]

export function defaultCareer(): CareerState {
  return {
    bestStage: 0,
    totalStages: 0,
    runs: 0,
    crowns: 0,
    unlockedRaces: [...STARTER_RACES],
    unlockedClasses: [...STARTER_CLASSES],
    unlockedSubclasses: [],
    maxSpellTier: 2,
    unlockedSchools: [...STARTER_SCHOOLS],
  }
}

function emptySlots(): SaveSlots {
  return [null, null, null]
}

function newId(): string {
  return `save-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function persistSlots(slots: SaveSlots): void {
  localStorage.setItem(SAVES_KEY, JSON.stringify(slots))
}

function migrateLegacyIfNeeded(slots: SaveSlots): SaveSlots {
  if (slots.some(Boolean)) return slots
  try {
    const raw = localStorage.getItem(LEGACY_CAREER_KEY)
    if (!raw) return slots
    const parsed = JSON.parse(raw) as CareerState
    const career = { ...defaultCareer(), ...parsed }
    const now = new Date().toISOString()
    const migrated: CareerSave = {
      id: newId(),
      slot: 0,
      teamName: 'Твой отряд',
      difficulty: 3,
      difficultyLabel: 'Средне',
      createdAt: now,
      updatedAt: now,
      career,
      history: [],
    }
    const next: SaveSlots = [migrated, null, null]
    persistSlots(next)
    localStorage.setItem(ACTIVE_KEY, migrated.id)
    localStorage.removeItem(LEGACY_CAREER_KEY)
    return next
  } catch {
    return slots
  }
}

export function listSlots(): SaveSlots {
  try {
    const raw = localStorage.getItem(SAVES_KEY)
    if (!raw) {
      return migrateLegacyIfNeeded(emptySlots())
    }
    const parsed = JSON.parse(raw) as SaveSlots
    const slots: SaveSlots = [
      parsed[0] ?? null,
      parsed[1] ?? null,
      parsed[2] ?? null,
    ]
    return migrateLegacyIfNeeded(slots)
  } catch {
    return emptySlots()
  }
}

export function getActiveSaveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

export function setActiveSaveId(id: string | null): void {
  if (id) localStorage.setItem(ACTIVE_KEY, id)
  else localStorage.removeItem(ACTIVE_KEY)
}

export function getSaveById(id: string): CareerSave | null {
  return listSlots().find((s) => s?.id === id) ?? null
}

export function getActiveSave(): CareerSave | null {
  const id = getActiveSaveId()
  if (!id) return null
  return getSaveById(id)
}

/** Совместимость: карьера активного сейва. */
export function loadCareer(): CareerState {
  return getActiveSave()?.career ?? defaultCareer()
}

export function saveCareer(career: CareerState): void {
  const id = getActiveSaveId()
  if (!id) return
  const slots = listSlots()
  const idx = slots.findIndex((s) => s?.id === id)
  if (idx < 0 || !slots[idx]) return
  const updated: CareerSave = {
    ...slots[idx]!,
    career,
    updatedAt: new Date().toISOString(),
  }
  const next = [...slots] as SaveSlots
  next[idx] = updated
  persistSlots(next)
}

export function createSave(
  slot: SlotIndex,
  teamName: string,
  difficulty: DifficultyRerolls,
): CareerSave {
  const slots = listSlots()
  if (slots[slot]) {
    throw new Error('Слот занят')
  }
  const opt = DIFFICULTY_OPTIONS.find((d) => d.rerolls === difficulty)!
  const now = new Date().toISOString()
  const save: CareerSave = {
    id: newId(),
    slot,
    teamName: teamName.trim() || 'Твой отряд',
    difficulty,
    difficultyLabel: opt.label,
    createdAt: now,
    updatedAt: now,
    career: defaultCareer(),
    history: [],
  }
  const next = [...slots] as SaveSlots
  next[slot] = save
  persistSlots(next)
  setActiveSaveId(save.id)
  return save
}

export function deleteSave(id: string): void {
  const slots = listSlots()
  const idx = slots.findIndex((s) => s?.id === id)
  if (idx < 0) return
  const next = [...slots] as SaveSlots
  next[idx] = null
  persistSlots(next)
  if (getActiveSaveId() === id) setActiveSaveId(null)
}

export function setActiveSave(id: string): CareerSave | null {
  const save = getSaveById(id)
  if (!save) return null
  setActiveSaveId(id)
  return save
}

export function appendSaveHistory(
  id: string,
  entry: CareerSave['history'][number],
): void {
  const slots = listSlots()
  const idx = slots.findIndex((s) => s?.id === id)
  if (idx < 0 || !slots[idx]) return
  const save = slots[idx]!
  const updated: CareerSave = {
    ...save,
    updatedAt: new Date().toISOString(),
    history: [entry, ...save.history].slice(0, 20),
  }
  const next = [...slots] as SaveSlots
  next[idx] = updated
  persistSlots(next)
}

interface UnlockDef {
  stage: number
  kind: 'race' | 'class' | 'subclass' | 'tier' | 'school'
  id: string
  label: string
}

const UNLOCK_TABLE: UnlockDef[] = [
  { stage: 10, kind: 'race', id: 'tiefling', label: 'Раса: Тифлинг' },
  { stage: 10, kind: 'class', id: 'paladin', label: 'Класс: Паладин' },
  { stage: 20, kind: 'race', id: 'halfElf', label: 'Раса: Полуэльф' },
  { stage: 20, kind: 'class', id: 'bard', label: 'Класс: Бард' },
  { stage: 20, kind: 'tier', id: '3', label: 'Тир заклинаний: 3' },
  { stage: 30, kind: 'race', id: 'gnome', label: 'Раса: Гном' },
  { stage: 30, kind: 'class', id: 'warlock', label: 'Класс: Колдун' },
  { stage: 30, kind: 'school', id: 'Иллюзия', label: 'Школа: Иллюзия' },
  { stage: 40, kind: 'class', id: 'druid', label: 'Класс: Друид' },
  { stage: 40, kind: 'subclass', id: 'champion', label: 'Подкласс: Чемпион' },
  { stage: 40, kind: 'tier', id: '4', label: 'Тир заклинаний: 4' },
  { stage: 50, kind: 'race', id: 'dragonborn', label: 'Раса: Драконорожденный' },
  { stage: 50, kind: 'class', id: 'barbarian', label: 'Класс: Варвар' },
  { stage: 50, kind: 'subclass', id: 'lifeDomain', label: 'Подкласс: Жизнь' },
  { stage: 60, kind: 'class', id: 'monk', label: 'Класс: Монах' },
  { stage: 60, kind: 'class', id: 'sorcerer', label: 'Класс: Чародей' },
  { stage: 60, kind: 'tier', id: '5', label: 'Тир заклинаний: 5' },
  { stage: 60, kind: 'school', id: 'Преобразование', label: 'Школа: Преобразование' },
  { stage: 70, kind: 'race', id: 'halfOrc', label: 'Раса: Полуорк' },
  { stage: 70, kind: 'subclass', id: 'evoker', label: 'Подкласс: Вызыватель' },
  { stage: 70, kind: 'subclass', id: 'thief', label: 'Подкласс: Вор' },
  { stage: 80, kind: 'tier', id: '7', label: 'Тир заклинаний: 7' },
  { stage: 80, kind: 'subclass', id: 'fiendPatron', label: 'Подкласс: Исчадие' },
  { stage: 80, kind: 'school', id: 'Некромантия', label: 'Школа: Некромантия' },
  { stage: 90, kind: 'subclass', id: 'moonCircle', label: 'Подкласс: Круг Луны' },
  { stage: 90, kind: 'tier', id: '8', label: 'Тир заклинаний: 8' },
  { stage: 100, kind: 'tier', id: '9', label: 'Тир заклинаний: 9' },
  { stage: 100, kind: 'subclass', id: 'wildMagic', label: 'Подкласс: Дикая магия' },
]

export function applyCareerProgress(
  career: CareerState,
  stagesCleared: number,
  perfect: boolean,
): { career: CareerState; unlocks: string[] } {
  const next: CareerState = {
    ...career,
    unlockedRaces: [...career.unlockedRaces],
    unlockedClasses: [...career.unlockedClasses],
    unlockedSubclasses: [...career.unlockedSubclasses],
    unlockedSchools: [...career.unlockedSchools],
    runs: career.runs + 1,
    totalStages: career.totalStages + Math.max(0, stagesCleared),
    bestStage: Math.max(career.bestStage, stagesCleared),
    crowns: career.crowns + (perfect ? 1 : 0),
  }

  const unlocks: string[] = []
  const best = next.bestStage

  for (const u of UNLOCK_TABLE) {
    if (best < u.stage) continue
    if (u.kind === 'race' && !next.unlockedRaces.includes(u.id as RaceId)) {
      next.unlockedRaces.push(u.id as RaceId)
      unlocks.push(u.label)
    }
    if (u.kind === 'class' && !next.unlockedClasses.includes(u.id as ClassId)) {
      next.unlockedClasses.push(u.id as ClassId)
      unlocks.push(u.label)
    }
    if (u.kind === 'subclass' && !next.unlockedSubclasses.includes(u.id as SubclassId)) {
      next.unlockedSubclasses.push(u.id as SubclassId)
      unlocks.push(u.label)
    }
    if (u.kind === 'tier') {
      const tier = Number(u.id)
      if (tier > next.maxSpellTier) {
        next.maxSpellTier = tier
        unlocks.push(u.label)
      }
    }
    if (u.kind === 'school' && !next.unlockedSchools.includes(u.id)) {
      next.unlockedSchools.push(u.id)
      unlocks.push(u.label)
    }
  }

  next.unlockedSubclasses = next.unlockedSubclasses.filter((id) => {
    const sc = SUBCLASSES.find((s) => s.id === id)
    return sc && next.unlockedClasses.includes(sc.classId)
  })

  if (best >= 100) {
    for (const r of ALL_RACES) {
      if (!next.unlockedRaces.includes(r)) {
        next.unlockedRaces.push(r)
        unlocks.push(`Раса: ${r}`)
      }
    }
    for (const c of ALL_CLASSES) {
      if (!next.unlockedClasses.includes(c)) {
        next.unlockedClasses.push(c)
        unlocks.push(`Класс: ${c}`)
      }
    }
  }

  saveCareer(next)
  return { career: next, unlocks }
}

export function nextUnlockHint(career: CareerState): string {
  const best = career.bestStage
  const pending = UNLOCK_TABLE.find((u) => {
    if (u.stage <= best) return false
    if (u.kind === 'race') return !career.unlockedRaces.includes(u.id as RaceId)
    if (u.kind === 'class') return !career.unlockedClasses.includes(u.id as ClassId)
    if (u.kind === 'subclass') return !career.unlockedSubclasses.includes(u.id as SubclassId)
    if (u.kind === 'tier') return Number(u.id) > career.maxSpellTier
    if (u.kind === 'school') return !career.unlockedSchools.includes(u.id)
    return false
  })
  if (!pending) return 'Все основные анлоки открыты.'
  const need = pending.stage - best
  return `Ещё ${need} эт. до: ${pending.label}`
}
