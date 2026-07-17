import type { RegionId } from './regions'

/** Encounter lines по краям — дополняют общий пул. */
export const REGION_ENCOUNTERS: Partial<Record<RegionId, string[]>> = {
  soberCourt: [
    'Дозор трезвых',
    'Пустой кравчий',
    'Маска без улыбки',
  ],
  saltMire: [
    'Соляной ужас',
    'Иловый страж',
    'Тост из топи',
  ],
  bonePass: [
    'Костяной рыцарь',
    'Хорёсток перевала',
    'Проклятый алтарь пира',
  ],
  moonRuins: [
    'Лунный охотник',
    'Обломок хора',
    'Тень распорядителя',
  ],
  echoCrypt: [
    'Эхо павшего тоста',
    'Певцы склепа',
    'Шёпот пустого кубка',
  ],
  scrapFeast: [
    'Ржавый кравчий',
    'Отряд наёмников',
    'Гнилой пиршественный стол',
  ],
  crimsonBridge: [
    'Страж кровавого моста',
    'Змей руин',
    'Маскированный дозор',
  ],
  toastVault: [
    'Хранитель кубков',
    'Тост из тумана',
    'Культисты Порчи',
  ],
  brineChoir: [
    'Соляной хор',
    'Певец с солью во рту',
    'Каменный хоровод',
  ],
  muteBelfry: [
    'Немой звонарь',
    'Тень колокола',
    'Распорядитель у порога',
  ],
}

export function encountersForRegion(regionId?: RegionId | null): string[] {
  if (!regionId) return []
  return REGION_ENCOUNTERS[regionId] ?? []
}
