/**
 * Назначение: единственное место, где живут селекторы анкеты HeatCalc.
 * Описание: набор опирается на `data-testid`. Атрибуты добавлены во фронтенд
 * отдельной задачей, манифест — `e2e/TESTIDS.md`.
 *
 * ПОЧЕМУ НЕ ПО ТЕКСТУ. Первая версия набора адресовалась по украинским подписям
 * и упала четыре раза подряд, причём ни разу не из-за продукта:
 *   1. подпись кнопки шага оказалась «Об'єкт», а «Параметри об'єкта» — это
 *      заголовок страницы; набор искал заголовок среди кнопок;
 *   2. апостроф встречается в двух вариантах — U+0027 в «Об'єкт» и U+2019
 *      в других строках; промах повторился уже после того, как урок был
 *      усвоен на кнопке шага;
 *   3. в карточке помещения подпись «Площа, м²» встречается дважды —
 *      у помещения и у блока «Стіна №1»;
 *   4. поля свёрнутой карточки присутствуют в DOM, но невидимы, и заполнение
 *      падало по таймауту без внятного объяснения.
 *
 * Ни одна из четырёх поломок не была дефектом продукта. Это цена привязки
 * к тексту, и ровно поэтому она здесь заменена на атрибуты.
 */

/**
 * Матчер, устойчивый к варианту апострофа. Нужен там, где атрибута ещё нет
 * и сравнение идёт по украинскому тексту.
 */
export const apos = (text: string): RegExp =>
  new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/['\u2019]/g, "['\u2019]"));

const tid = (name: string): string => `[data-testid="${name}"]`;

/** Шаги анкеты. Ключи — SSOT из `frontend/src/constants/surveySteps.ts`. */
export const STEP_IDS = [
  'object', 'warmFloor', 'rooms', 'hotWater', 'boiler', 'radiators',
  'waterHeater', 'hydraulics', 'technicalResult', 'dataReference', 'financialResult',
] as const;

export type StepKey = (typeof STEP_IDS)[number];

/** Кнопка шага в боковом меню. */
export const stepNav = (step: StepKey): string => tid(`step-nav-${step}`);

/** Поля анкеты, не привязанные к помещению. */
export const FIELD = {
  clientName: tid('field-client-name'),
  roomsCount: tid('field-rooms-count'),
  wallThickness: tid('field-wall-thickness'),
  insideC: tid('field-inside-temp'),
  outsideC: tid('field-outside-temp'),
  bathroomAirC: tid('field-bathroom-temp'),
  residents: tid('field-residents'),
} as const;

/** Поля карточки помещения. `rid` — `r1`, `r2`, … */
export const ROOM = {
  card: (rid: string) => tid(`room-card-${rid}`),
  toggle: (rid: string) => tid(`room-toggle-${rid}`),
  name: (rid: string) => tid(`room-name-${rid}`),
  type: (rid: string) => tid(`room-type-${rid}`),
  area: (rid: string) => tid(`room-area-${rid}`),
  height: (rid: string) => tid(`room-height-${rid}`),
  layout: (rid: string) => tid(`room-layout-${rid}`),
  /** Площадь «Стіна №1» — поле, без которого расчёт не запускается (BUG-01). */
  wall1Area: (rid: string) => tid(`room-wall1-area-${rid}`),
  /** Появляется у углового помещения. */
  wall2Area: (rid: string) => tid(`room-wall2-area-${rid}`),
} as const;

/** Идентификатор помещения по порядковому номеру: 1 → r1. */
export const roomId = (index1: number): string => `r${index1}`;

/** Кнопки шапки. Экспортные у анонима ведут к 401 — BUG-05. */
export const HEADER = {
  save: tid('header-save'),
  share: tid('header-share'),
  pdf: tid('header-pdf'),
  projects: tid('header-projects'),
  pdfFinancial: tid('pdf-financial'),
  pdfFinancialTechnical: tid('pdf-financial-technical'),
} as const;

/**
 * Панель результата и её машиночитаемое состояние.
 *
 * `data-source` (`api` | `quick`) выводится из того же признака, из которого
 * строится подпись «Джерело: …». Это НЕ независимый источник истины, а
 * машиночитаемая форма той же величины — значит, маркер может унаследовать
 * дефект подписи. Поэтому сверка с сетевым оракулом обязательна:
 * см. `assertMarkersHonest()` в `oracle.ts`.
 *
 * `data-calc-phase` — `idle | pending | ok | error`, выводится из `uiPhase`.
 */
export const RESULT = {
  panel: tid('result-panel'),
  estimateTotal: tid('estimate-total'),
  estimateEmpty: tid('estimate-empty'),
  calcError: tid('calc-error'),
} as const;

/** Тексты — только там, где атрибута пока нет. Сравнивать через `apos()`. */
export const TEXT = {
  /** Заглушка вместо расчёта — BUG-01. Дублирует `data-source="quick"`. */
  stubSource: 'Джерело: швидка оцінка (100 Вт/м²)',
  apiSource: 'Джерело: розрахунок API за огородженнями',
  authRequired: 'Потрібен Authorization: Bearer',
  clientNameRequired: "Вкажіть ім'я клієнта перед збереженням на сервер",
  genericError: 'Некоректні вхідні дані',
  cookieAccept: 'Зрозуміло',
  startNew: 'Почати новий розрахунок',
} as const;

/** Ключ черновика в localStorage. Схема v4 — `docs/survey-draft.md`. */
export const DRAFT_KEY = 'heatcalc:survey-draft:v1';

/** Путь расчёта. По нему работает сетевой оракул. */
export const CALC_PATH = '/api/v1/calc';
