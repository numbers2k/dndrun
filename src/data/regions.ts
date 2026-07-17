/** Края Порчи Пира — дерево глубин (как уровни Dead Cells): только вперёд. */

export type RegionId =
  | 'soberCourt'
  // глубина 2
  | 'saltMire'
  | 'bonePass'
  // глубина 3
  | 'moonRuins'
  | 'echoCrypt'
  | 'scrapFeast'
  // глубина 4
  | 'crimsonBridge'
  | 'toastVault'
  | 'brineChoir'
  // глубина 5
  | 'abyssShore'
  | 'blackWharf'
  | 'wineCellar'
  // глубина 6
  | 'stoneCircle'
  | 'guestPier'
  | 'clockGallery'
  // глубина 7
  | 'approachEast'
  | 'approachWest'
  | 'ashBall'
  // глубина 8
  | 'silentChoir'
  | 'bellYard'
  | 'maskAttic'
  // глубина 9
  | 'feastVestibule'
  | 'lastToast'
  | 'stewardHall'
  // глубина 10
  | 'muteBelfry'

export interface RegionDef {
  id: RegionId
  name: string
  /** Глава / ярус пути: 1 = старт … 10 = финал. */
  depth: number
  tag: string
  blurb: string
  bossTitle: string
  bossBlurb: string
  /** 9 имён маршрутных этапов внутри главы. */
  routes: string[]
  threatAdjust: number
  ovrBuffer: number
  /** 0 = в стартовом пуле гильдии; иначе bestStage >= unlockStage. */
  unlockStage: number
}

function R(
  partial: Omit<RegionDef, 'routes'> & { routes: string[] },
): RegionDef {
  return partial
}

const ROUTES: Record<string, string[]> = {
  sober: [
    'Сухой колодец',
    'Улица без музыки',
    'Двор трезвых',
    'Склад пустых кубков',
    'Тень колокольни вдали',
    'Переулок масок',
    'Сломанный фонарь',
    'Калитка гильдии',
    'Порог вылазки',
  ],
  salt: [
    'Рассольный брод',
    'Топь первого тоста',
    'Соляной штрек',
    'Слезная отмель',
    'Ил под маской',
    'Камыш-заздравный',
    'Гнилой причал',
    'Туман кубков',
    'Соляной двор',
  ],
  bone: [
    'Костяной спуск',
    'Скатерть из рёбер',
    'Перевал обглоданных',
    'Зал последних кусков',
    'Хребет тракта',
    'Яма объедков',
    'Сухой полдень костей',
    'Мост из челюстей',
    'Столовая без гостей',
  ],
  moon: [
    'Лунный двор',
    'Бал без утра',
    'Галерея масок',
    'Садовый час',
    'Зеркальный флигель',
    'Лестница без рассвета',
    'Зал тихих смычков',
    'Терраса пепла',
    'Руины курантов',
  ],
  echo: [
    'Эхо коридора',
    'Склеп тостов',
    'Крипта смеха',
    'Зал повторённых имён',
    'Ниша заздравья',
    'Пыльный амвон',
    'Хор без горла',
    'Коридор отказов',
    'Дверь с чужим голосом',
  ],
  scrap: [
    'Объедковый двор',
    'Куча скатертей',
    'Яма костей пира',
    'Свалка кубков',
    'Тропа объедков',
    'Шалаш из рёбер',
    'Зола под столом',
    'Хвост банкета',
    'Порог объедков',
  ],
  crimson: [
    'Багровый сход',
    'Мост перелива',
    'Винная пропасть',
    'Перила из пробок',
    'Арх над жижей',
    'Сторожка кравчего',
    'Треснувшая арка',
    'Кровь вместо реки',
    'Середина моста',
  ],
  toast: [
    'Кладовая тостов',
    'Полка заздравьев',
    'Бочка чужих имён',
    'Пыльный погреб слов',
    'Стеллаж отказов',
    'Треснувший кубок',
    'Учётная книга пира',
    'Ниша эха',
    'Дверь вниз по списку',
  ],
  brine: [
    'Хор рассола',
    'Соляные скамьи',
    'Певчая топь',
    'Зал мокрых голосов',
    'Арка из соли',
    'Слезная галерея',
    'Хор без рта',
    'Рассольный амвон',
    'Порог хора',
  ],
  abyss: [
    'Разлом берега',
    'Пустой кубок моря',
    'Шёпот паузы',
    'Отмель похмелья',
    'Чёрный прибой',
    'Кости прилива',
    'Туман без горизонта',
    'Якорь без корабля',
    'Край бездны',
  ],
  wharf: [
    'Чёрный проход',
    'Пирс неуезжающих',
    'Склад чемоданов',
    'Трюм последнего банкета',
    'Фонарь капитана',
    'Док без отлива',
    'Канат из тостов',
    'Каюта масок',
    'Трап вниз',
  ],
  wine: [
    'Винный спуск',
    'Погреб перелива',
    'Ряд пустых лет',
    'Бочка без дна',
    'Пробковый зал',
    'Кравчий угол',
    'Лужа урожая',
    'Лестница в осадок',
    'Дно погреба',
  ],
  stone: [
    'Каменный круг',
    'Хоровод без тени',
    'Плита полдня',
    'Кольцо масок',
    'Шаг, который не кончается',
    'Алтарь кубков',
    'Пыль под ногами',
    'Центр круга',
    'Выход, которого нет',
  ],
  pier: [
    'Пирс гостей',
    'Трап ожидания',
    'Скамья неуезжих',
    'Фонарь без судна',
    'Док чемоданов',
    'Канат из приглашений',
    'Трюм вежливости',
    'Мостки вниз',
    'Край пирса',
  ],
  clock: [
    'Галерея курантов',
    'Циферблат без стрелок',
    'Зал отложенного часа',
    'Пыль механизмов',
    'Коридор боев',
    'Ниша праздничных часов',
    'Сломанный курант',
    'Галерея пауз',
    'Дверь в следующий час',
  ],
  east: [
    'Восточный подступ',
    'Лестница масок',
    'Улица к колокольне',
    'Двор восточных тостов',
    'Арка без звона',
    'Переулок кубков',
    'Тень шпиля',
    'Калитка хора',
    'Порог востока',
  ],
  west: [
    'Западный подступ',
    'Спуск к колокольне',
    'Галерея западных масок',
    'Двор без курантов',
    'Мост к шпилю',
    'Улица последних гостей',
    'Фонарь без масла',
    'Калитка немых',
    'Порог запада',
  ],
  ash: [
    'Пепельный бал',
    'Зал серого смеха',
    'Танцпол без утра',
    'Галерея золы',
    'Смычок из пепла',
    'Маска под слоем',
    'Терраса угля',
    'Коридор бала',
    'Дверь из зала',
  ],
  choir: [
    'Немые хоры',
    'Скамья без голоса',
    'Арка приглушённых',
    'Зал сжатых губ',
    'Коридор эха-без-звука',
    'Ниша колокола',
    'Пыль партитур',
    'Хор масок',
    'Дверь к сенцам',
  ],
  bell: [
    'Двор колоколов',
    'Немой язык',
    'Площадка без удара',
    'Цепь без звона',
    'Тень языка',
    'Круг колоколен',
    'Пыль бронзы',
    'Двор паузы',
    'Калитка внутрь',
  ],
  attic: [
    'Чердак масок',
    'Балка с улыбками',
    'Склад личин',
    'Пыльный балкон',
    'Угол без лица',
    'Лестница чердака',
    'Окно на колокольню',
    'Куча приглашений',
    'Люк вниз',
  ],
  vestibule: [
    'Преддверие Пира',
    'Ковёр из скатертей',
    'Зеркало хозяина',
    'Вешалка масок',
    'Сенцы без слуг',
    'Коридор к залу',
    'Пыль кубков',
    'Дверь с гербом пира',
    'Порог Палаты',
  ],
  last: [
    'Зал Последнего Тоста',
    'Стол без конца',
    'Кубок в центре',
    'Стулья для мёртвых',
    'Тост без голоса',
    'Скатерть из лет',
    'Свечи без фитиля',
    'Галерея гостей',
    'Дверь к Распорядителю',
  ],
  steward: [
    'Сенцы Распорядителя',
    'Книга рассадки',
    'Ключ от погребов',
    'Звонок без звука',
    'Коридор распоряжений',
    'Ниша расписаний',
    'Пыль приказов',
    'Дверь хозяина',
    'Порог пира',
  ],
  belfry: [
    'Подступ к колокольне',
    'Двор немых колоколов',
    'Лестница праздников',
    'Хор масок',
    'Зал курантов',
    'Галерея тостов',
    'Чердак смеха',
    'Площадка без звона',
    'Порог Палаты Пира',
  ],
}

export const INTRO_REGION_ID: RegionId = 'soberCourt'
export const FINALE_REGION_ID: RegionId = 'muteBelfry'

export const REGIONS: RegionDef[] = [
  R({
    id: 'soberCourt',
    name: 'Последний Трезвый Двор',
    depth: 1,
    tag: 'порог',
    blurb: 'Окраина, где ещё пьют воду и боятся музыки. Отсюда начинают вылазки.',
    bossTitle: 'Босс: Маска Первого Кубка',
    bossBlurb: 'Первая улыбка Порчи — тонкая, вежливая и уже чужая.',
    routes: ROUTES.sober,
    threatAdjust: 0,
    ovrBuffer: 0,
    unlockStage: 0,
  }),
  R({
    id: 'saltMire',
    name: 'Соляные топи',
    depth: 2,
    tag: 'рассол',
    blurb: 'Слёзы пиров стали рассолом. Топь помнит каждый тост.',
    bossTitle: 'Босс: Мать Рассола',
    bossBlurb: 'Она выжимает радость до соли — и зовёт это гостеприимством.',
    routes: ROUTES.salt,
    threatAdjust: -1,
    ovrBuffer: 0,
    unlockStage: 0,
  }),
  R({
    id: 'bonePass',
    name: 'Костяной перевал',
    depth: 2,
    tag: 'объедки',
    blurb: 'Пиршественные кости «до последней». Здесь едят до тишины.',
    bossTitle: 'Босс: Столовый Палач',
    bossBlurb: 'Он нарезает отряды как жаркое — аккуратно и без спешки.',
    routes: ROUTES.bone,
    threatAdjust: 0,
    ovrBuffer: 1,
    unlockStage: 0,
  }),
  R({
    id: 'moonRuins',
    name: 'Лунные руины',
    depth: 3,
    tag: 'бал',
    blurb: 'Ночные балы без обещания утра. Маски здесь не снимают.',
    bossTitle: 'Босс: Хозяйка Без Рассвета',
    bossBlurb: 'Она ведёт танец, пока ноги ещё помнят пол.',
    routes: ROUTES.moon,
    threatAdjust: 1,
    ovrBuffer: 1,
    unlockStage: 0,
  }),
  R({
    id: 'echoCrypt',
    name: 'Склеп Эха',
    depth: 3,
    tag: 'тосты',
    blurb: 'Заздравья, которые всё ещё звучат. Слова гниют медленнее тел.',
    bossTitle: 'Босс: Эхо Заздравное',
    bossBlurb: 'Повторяет ваши имена, пока вы не станете частью хора.',
    routes: ROUTES.echo,
    threatAdjust: 0,
    ovrBuffer: 0,
    unlockStage: 0,
  }),
  R({
    id: 'scrapFeast',
    name: 'Объедковый двор',
    depth: 3,
    tag: 'остатки',
    blurb: 'То, что пир выплюнул. Здесь ещё пахнет весельем — и уже гнилью.',
    bossTitle: 'Босс: Обглоданный Метрдотель',
    bossBlurb: 'Он считает кости гостей и зовёт это сервировкой.',
    routes: ROUTES.scrap,
    threatAdjust: 1,
    ovrBuffer: 0,
    unlockStage: 15,
  }),
  R({
    id: 'crimsonBridge',
    name: 'Багровый мост',
    depth: 4,
    tag: 'вино',
    blurb: 'Вино вместо реки. Назад по мосту почти не ходят.',
    bossTitle: 'Босс: Страж Перелива',
    bossBlurb: 'Один край моста — ещё люди, другой — уже кубок.',
    routes: ROUTES.crimson,
    threatAdjust: 2,
    ovrBuffer: 2,
    unlockStage: 0,
  }),
  R({
    id: 'toastVault',
    name: 'Кладовая тостов',
    depth: 4,
    tag: 'учёт',
    blurb: 'Заздравья сложены штабелями. Каждое имя — на полке.',
    bossTitle: 'Босс: Архивариус Кубков',
    bossBlurb: 'Он вычёркивает живых из списка гостей.',
    routes: ROUTES.toast,
    threatAdjust: 1,
    ovrBuffer: 1,
    unlockStage: 0,
  }),
  R({
    id: 'brineChoir',
    name: 'Хор Рассола',
    depth: 4,
    tag: 'хор',
    blurb: 'Поют те, у кого во рту соль вместо языка.',
    bossTitle: 'Босс: Дирижёр Слёз',
    bossBlurb: 'Взмах руки — и отряд входит в партитуру.',
    routes: ROUTES.brine,
    threatAdjust: 2,
    ovrBuffer: 1,
    unlockStage: 25,
  }),
  R({
    id: 'abyssShore',
    name: 'Берег Бездны',
    depth: 5,
    tag: 'похмелье',
    blurb: 'Похмелье мира. Горизонт здесь — пустой кубок.',
    bossTitle: 'Босс: Шептун Пустого Кубка',
    bossBlurb: 'Шепчет про обещания праздника — и про то, что осталось после.',
    routes: ROUTES.abyss,
    threatAdjust: 3,
    ovrBuffer: 2,
    unlockStage: 0,
  }),
  R({
    id: 'blackWharf',
    name: 'Чёрный причал',
    depth: 5,
    tag: 'гости',
    blurb: 'Гости, которые не уехали. Трюмы полны чемоданов и масок.',
    bossTitle: 'Босс: Капитан Последнего Банкета',
    bossBlurb: 'Рейс отменён. Пассажиры всё ещё ждут посадки.',
    routes: ROUTES.wharf,
    threatAdjust: 2,
    ovrBuffer: 2,
    unlockStage: 0,
  }),
  R({
    id: 'wineCellar',
    name: 'Винный погреб',
    depth: 5,
    tag: 'осадок',
    blurb: 'Урожай, который никто не пил до дна — и теперь пьёт сам.',
    bossTitle: 'Босс: Кравчий Осадка',
    bossBlurb: 'Наливает молча. Отказ считается оскорблением стола.',
    routes: ROUTES.wine,
    threatAdjust: 3,
    ovrBuffer: 2,
    unlockStage: 35,
  }),
  R({
    id: 'stoneCircle',
    name: 'Каменный круг',
    depth: 6,
    tag: 'хоровод',
    blurb: 'Хоровод, который не остановить. Полдень без тени.',
    bossTitle: 'Босс: Водитель Круга',
    bossBlurb: 'Ведёт за руки живых и мёртвых одним и тем же шагом.',
    routes: ROUTES.stone,
    threatAdjust: 3,
    ovrBuffer: 2,
    unlockStage: 0,
  }),
  R({
    id: 'guestPier',
    name: 'Пирс гостей',
    depth: 6,
    tag: 'ожидание',
    blurb: 'Все уже приглашены. Никто не садится в лодку.',
    bossTitle: 'Босс: Привратник Рейса',
    bossBlurb: 'Проверяет список. Вас в нём нет — и уже есть.',
    routes: ROUTES.pier,
    threatAdjust: 2,
    ovrBuffer: 2,
    unlockStage: 0,
  }),
  R({
    id: 'clockGallery',
    name: 'Галерея курантов',
    depth: 6,
    tag: 'час',
    blurb: 'Часы праздника остановились — но галерея всё ещё тикает.',
    bossTitle: 'Босс: Смотритель Боя',
    bossBlurb: 'Отсчитывает тосты вместо секунд.',
    routes: ROUTES.clock,
    threatAdjust: 3,
    ovrBuffer: 2,
    unlockStage: 45,
  }),
  R({
    id: 'approachEast',
    name: 'Восточный подступ',
    depth: 7,
    tag: 'подступ',
    blurb: 'Улицы ещё помнят, как ходили на праздник с востока.',
    bossTitle: 'Босс: Страж Восточных Сеней',
    bossBlurb: 'Пускает только тех, кто уже улыбается не своим ртом.',
    routes: ROUTES.east,
    threatAdjust: 3,
    ovrBuffer: 2,
    unlockStage: 0,
  }),
  R({
    id: 'approachWest',
    name: 'Западный подступ',
    depth: 7,
    tag: 'подступ',
    blurb: 'Западный спуск к шпилю. Здесь тише — и хуже.',
    bossTitle: 'Босс: Страж Западных Сеней',
    bossBlurb: 'Не спрашивает пароль. Спрашивает тост.',
    routes: ROUTES.west,
    threatAdjust: 3,
    ovrBuffer: 2,
    unlockStage: 0,
  }),
  R({
    id: 'ashBall',
    name: 'Пепельный бал',
    depth: 7,
    tag: 'бал',
    blurb: 'Танцуют в золе. Музыка давно кончилась — ноги нет.',
    bossTitle: 'Босс: Хозяин Серого Бала',
    bossBlurb: 'Приглашает на круг. Отказ — тоже шаг.',
    routes: ROUTES.ash,
    threatAdjust: 3,
    ovrBuffer: 2,
    unlockStage: 55,
  }),
  R({
    id: 'silentChoir',
    name: 'Немые хоры',
    depth: 8,
    tag: 'тишина',
    blurb: 'Поют без звука. Колокольня уже близко.',
    bossTitle: 'Босс: Регент Беззвучия',
    bossBlurb: 'Поднимает руку — и в горле становится пусто.',
    routes: ROUTES.choir,
    threatAdjust: 3,
    ovrBuffer: 2,
    unlockStage: 0,
  }),
  R({
    id: 'bellYard',
    name: 'Двор колоколов',
    depth: 8,
    tag: 'двор',
    blurb: 'Колокола висят. Удара не будет — пока пир не оборвут.',
    bossTitle: 'Босс: Звонарь Паузы',
    bossBlurb: 'Держит язык колокола. Ждёт вашего шага.',
    routes: ROUTES.bell,
    threatAdjust: 3,
    ovrBuffer: 2,
    unlockStage: 0,
  }),
  R({
    id: 'maskAttic',
    name: 'Чердак масок',
    depth: 8,
    tag: 'личины',
    blurb: 'Личины с прошлых пиров. Некоторые ещё тёплые.',
    bossTitle: 'Босс: Хранитель Личин',
    bossBlurb: 'Подбирает вам лицо. Сопротивление — невежливо.',
    routes: ROUTES.attic,
    threatAdjust: 3,
    ovrBuffer: 2,
    unlockStage: 70,
  }),
  R({
    id: 'feastVestibule',
    name: 'Преддверие Пира',
    depth: 9,
    tag: 'сени',
    blurb: 'Последние сени перед Палатой. Здесь ещё можно развернуться — на словах.',
    bossTitle: 'Босс: Швейцар Вечного Банкета',
    bossBlurb: 'Открывает дверь тем, кого стол уже посчитал своими.',
    routes: ROUTES.vestibule,
    threatAdjust: 3,
    ovrBuffer: 2,
    unlockStage: 0,
  }),
  R({
    id: 'lastToast',
    name: 'Зал Последнего Тоста',
    depth: 9,
    tag: 'тост',
    blurb: 'Один тост на всех. Он не кончается.',
    bossTitle: 'Босс: Носитель Кубка',
    bossBlurb: 'Поднимает кубок. Ваш черёд ответить.',
    routes: ROUTES.last,
    threatAdjust: 3,
    ovrBuffer: 2,
    unlockStage: 0,
  }),
  R({
    id: 'stewardHall',
    name: 'Сенцы Распорядителя',
    depth: 9,
    tag: 'приказ',
    blurb: 'Отсюда ведут пир. Расписание важнее крови.',
    bossTitle: 'Босс: Писец Рассадки',
    bossBlurb: 'Вписывает отряд между переменой блюд.',
    routes: ROUTES.steward,
    threatAdjust: 3,
    ovrBuffer: 2,
    unlockStage: 80,
  }),
  R({
    id: 'muteBelfry',
    name: 'Немая Колокольня',
    depth: 10,
    tag: 'финал',
    blurb: 'Бывший центр праздников. Колокола молчат. Пир ждёт внутри.',
    bossTitle: 'Босс: Распорядитель Пира',
    bossBlurb: 'Воплощение вечного банкета. Хочет, чтобы праздник не кончался.',
    routes: ROUTES.belfry,
    threatAdjust: 0,
    ovrBuffer: 0,
    unlockStage: 0,
  }),
]

export const REGION_MAP = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<
  RegionId,
  RegionDef
>

/** Все края глубин 2–9 (каталог ветвлений). */
export const MID_REGION_IDS: RegionId[] = REGIONS.filter(
  (r) => r.depth >= 2 && r.depth <= 9,
).map((r) => r.id)

/** Всегда доступный «хребет» + стартовая вилка глубины 2. */
export const STARTER_MID_REGIONS: RegionId[] = MID_REGION_IDS.filter(
  (id) => REGION_MAP[id].unlockStage === 0,
)

/**
 * Двери только на следующий ярус (depth + 1). Назад и вбок по ярусу — нельзя.
 * Гл. 10 (Немая Колокольня) после 9-й главы принудительна — не выбирается в лагере.
 */
export const REGION_EXITS: Record<RegionId, RegionId[]> = {
  soberCourt: ['saltMire', 'bonePass'],

  saltMire: ['moonRuins', 'echoCrypt', 'scrapFeast'],
  bonePass: ['echoCrypt', 'moonRuins', 'scrapFeast'],

  moonRuins: ['crimsonBridge', 'toastVault', 'brineChoir'],
  echoCrypt: ['toastVault', 'crimsonBridge', 'brineChoir'],
  scrapFeast: ['brineChoir', 'toastVault'],

  crimsonBridge: ['abyssShore', 'blackWharf', 'wineCellar'],
  toastVault: ['blackWharf', 'abyssShore', 'wineCellar'],
  brineChoir: ['wineCellar', 'blackWharf'],

  abyssShore: ['stoneCircle', 'guestPier', 'clockGallery'],
  blackWharf: ['guestPier', 'stoneCircle', 'clockGallery'],
  wineCellar: ['clockGallery', 'guestPier'],

  stoneCircle: ['approachEast', 'approachWest', 'ashBall'],
  guestPier: ['approachWest', 'approachEast', 'ashBall'],
  clockGallery: ['ashBall', 'approachWest'],

  approachEast: ['silentChoir', 'bellYard', 'maskAttic'],
  approachWest: ['bellYard', 'silentChoir', 'maskAttic'],
  ashBall: ['maskAttic', 'bellYard'],

  silentChoir: ['feastVestibule', 'lastToast', 'stewardHall'],
  bellYard: ['lastToast', 'feastVestibule', 'stewardHall'],
  maskAttic: ['stewardHall', 'lastToast'],

  feastVestibule: [],
  lastToast: [],
  stewardHall: [],
  muteBelfry: [],
}

export function regionUnlocked(id: RegionId, bestStage: number): boolean {
  const r = REGION_MAP[id]
  if (!r) return false
  if (id === INTRO_REGION_ID || id === FINALE_REGION_ID) return true
  return bestStage >= r.unlockStage
}

export function unlockedMidRegions(bestStage: number): RegionId[] {
  return MID_REGION_IDS.filter((id) => regionUnlocked(id, bestStage))
}

export const REGION_UNLOCK_TABLE: { stage: number; id: RegionId; label: string }[] = MID_REGION_IDS.filter(
  (id) => REGION_MAP[id].unlockStage > 0,
)
  .map((id) => {
    const r = REGION_MAP[id]
    return { stage: r.unlockStage, id, label: `Край: ${r.name}` }
  })
  .sort((a, b) => a.stage - b.stage)

/** Открытые двери на следующий ярус из текущего края. */
export function nextRegionChoices(
  from: RegionId,
  unlocked: readonly RegionId[],
): RegionId[] {
  const unlockedSet = new Set(unlocked)
  const exits = (REGION_EXITS[from] ?? []).filter((id) => unlockedSet.has(id))
  if (exits.length) return exits

  // Запасной хребет: любой открытый край следующей глубины (если дверь ещё закрыта карьерой).
  const fromDepth = REGION_MAP[from]?.depth ?? 1
  const nextDepth = fromDepth + 1
  if (nextDepth >= 10) return []
  return MID_REGION_IDS.filter(
    (id) => REGION_MAP[id].depth === nextDepth && unlockedSet.has(id),
  )
}

export function regionsAtDepth(depth: number): RegionId[] {
  return REGIONS.filter((r) => r.depth === depth).map((r) => r.id)
}
