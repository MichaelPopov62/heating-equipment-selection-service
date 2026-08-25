/**
 * Назначение: определения персон — данные, а не механика.
 * Описание: пять персон соответствуют условию `GA-01` из плана
 * («расчёт получают 5 из 5 персон без подсказок»). Первые четыре —
 * это ровно те, что проходили анкету вручную 2026-08-23; пятая добавлена
 * по итогам внешнего ревю: анкета на 7 комнат занимает почти 15 минут,
 * поэтому прерывание сессии — норма, а не край.
 *
 * Правило: менять эти данные можно только вместе с протоколами в
 * `docs/qa/research/U*.md`. Персона — это воспроизведение реального прохода,
 * а не удобный для теста набор значений.
 */
import type { ObjectSpec, RoomSpec } from '../support/survey';

export type Persona = {
  id: string;
  /** Кто это и почему такой набор данных. */
  title: string;
  /** Ссылка на протокол ручного прохода. */
  source: string;
  object: ObjectSpec;
  rooms: RoomSpec[];
  residents: number;
  /** Прерывает ли сессию посередине (закрывает вкладку и возвращается). */
  interrupts?: boolean;
  /** Работает на мобильном экране. */
  mobile?: boolean;
  /**
   * Что было при ручном проходе. Нужно, чтобы падение теста читалось как
   * «стало хуже» или «всё ещё не починено», а не как загадка.
   */
  baseline: {
    reachedEstimate: boolean;
    tookPdf: boolean;
    note: string;
  };
};

/** Дом 90 м², Київ. Частник без инженерного образования. */
const novice: Persona = {
  id: 'novice',
  title: 'Приватник без інженерної освіти, дім 90 м², Київ',
  source: 'docs/qa/research/U1-ux-novice.md',
  object: { clientName: 'Дмитро', roomsCount: 6, insideC: 20, outsideC: -20 },
  rooms: [
    { name: 'Вітальня', type: 'Вітальня', areaM2: 22, heightM: 2.7, wallAreaM2: 12 },
    { name: 'Спальня', type: 'Спальня', areaM2: 16, heightM: 2.7, wallAreaM2: 9 },
    { name: 'Спальня 2', type: 'Спальня', areaM2: 14, heightM: 2.7, wallAreaM2: 8 },
    { name: 'Дитяча', type: 'Спальня', areaM2: 12, heightM: 2.7, wallAreaM2: 7 },
    { name: 'Кухня', type: 'Кухня', areaM2: 12, heightM: 2.7, wallAreaM2: 7 },
    { name: 'Санвузол', type: 'Санітарний вузол', areaM2: 6, heightM: 2.7, wallAreaM2: 4 },
  ],
  residents: 4,
  baseline: {
    reachedEstimate: true,
    tookPdf: false,
    note: 'Дошёл до сметы 300 856 грн за ~11 мин, PDF не получил — BUG-05.',
  },
};

/** Дом 158 м², Львів. Практикующий монтажник. */
const installer: Persona = {
  id: 'installer',
  title: 'Монтажник із 10 роками досвіду, дім 158 м², Львів',
  source: 'docs/qa/research/U2-ux-installer.md',
  object: { clientName: 'Об’єкт Львів', roomsCount: 7, insideC: 20, outsideC: -19 },
  rooms: [
    { name: 'Вітальня', type: 'Вітальня', areaM2: 40, heightM: 2.7, wallAreaM2: 18 },
    { name: 'Кухня-їдальня', type: 'Кухня', areaM2: 20, heightM: 2.7, wallAreaM2: 11 },
    { name: 'Санвузол 1 пов.', type: 'Санітарний вузол', areaM2: 7, heightM: 2.7, wallAreaM2: 4 },
    { name: 'Прихожа', type: 'Прихожа', areaM2: 13, heightM: 2.7, wallAreaM2: 7 },
    { name: 'Спальня батьків', type: 'Спальня', areaM2: 30, heightM: 2.7, wallAreaM2: 15 },
    { name: 'Дитяча', type: 'Спальня', areaM2: 28, heightM: 2.7, wallAreaM2: 14 },
    { name: 'Санвузол 2 пов.', type: 'Санітарний вузол', areaM2: 20, heightM: 2.7, wallAreaM2: 9 },
  ],
  residents: 4,
  baseline: {
    reachedEstimate: true,
    tookPdf: false,
    note:
      'Дошёл за 14 мин 51 с. Теплопотери 2.02 кВт на 158 м² при −19 °C — BUG-14. ' +
      'PDF не получил — BUG-05.',
  },
};

/**
 * Минимальный путь. Заполняет ТОЛЬКО то, что интерфейс объявил обязательным,
 * — то есть ничего, потому что не объявлено ничего (BUG-06).
 * Это единственная персона, которая ловит BUG-01 «вслепую», а не по памяти:
 * она не знает про поле «Стіна №1» и потому в него не попадает.
 */
const minimal: Persona = {
  id: 'minimal',
  title: 'Мінімальний шлях: заповнює лише те, що позначено обов’язковим',
  source: 'docs/qa/research/U3-ux-minimal-path.md',
  object: { roomsCount: 3 },
  rooms: [
    { name: 'Вітальня', type: 'Вітальня', areaM2: 28 },
    { name: 'Спальня', type: 'Спальня', areaM2: 16 },
    { name: 'Санвузол', type: 'Санітарний вузол', areaM2: 6 },
  ],
  residents: 4,
  baseline: {
    reachedEstimate: false,
    tookPdf: false,
    note:
      'Не дошёл вообще: расчёт не отправлялся, показана заглушка «швидка оцінка» — BUG-01. ' +
      'Ни одно поле не помечено обязательным — BUG-06.',
  },
};

/** Прерванный сеанс. Условие GA-01c, добавлено по итогам внешнего ревю. */
const interrupted: Persona = {
  id: 'interrupted',
  title: 'Перерваний сеанс: заповнив половину, закрив вкладку, повернувся',
  source: 'docs/qa/review/RESOLUTION.md (CODEX-10)',
  object: { clientName: 'Перерваний сеанс', roomsCount: 4, insideC: 20, outsideC: -21 },
  rooms: [
    { name: 'Вітальня', type: 'Вітальня', areaM2: 26, heightM: 2.8, wallAreaM2: 13 },
    { name: 'Спальня', type: 'Спальня', areaM2: 18, heightM: 2.8, wallAreaM2: 10 },
    { name: 'Кухня', type: 'Кухня', areaM2: 14, heightM: 2.8, wallAreaM2: 8 },
    { name: 'Санвузол', type: 'Санітарний вузол', areaM2: 5, heightM: 2.8, wallAreaM2: 3 },
  ],
  residents: 3,
  interrupts: true,
  baseline: {
    reachedEstimate: false,
    tookPdf: false,
    note:
      'Вручную не проходилась. Известно, что при перезагрузке теряются имя клиента (BUG-10) ' +
      'и толщина стены (BUG-11), а текущий шаг, по замеру U4, не сохраняется вовсе.',
  },
};

/** Мобильный экран. Вёрстка держится (проверено U4), проверяется достижимость цели. */
const mobile: Persona = {
  id: 'mobile',
  title: 'Мобільний екран 390×844',
  source: 'docs/qa/research/U4-ux-adversarial.md',
  object: { clientName: 'Мобільний', roomsCount: 3, insideC: 20, outsideC: -20 },
  rooms: [
    { name: 'Вітальня', type: 'Вітальня', areaM2: 24, heightM: 2.7, wallAreaM2: 12 },
    { name: 'Спальня', type: 'Спальня', areaM2: 15, heightM: 2.7, wallAreaM2: 8 },
    { name: 'Санвузол', type: 'Санітарний вузол', areaM2: 5, heightM: 2.7, wallAreaM2: 3 },
  ],
  residents: 2,
  mobile: true,
  baseline: {
    reachedEstimate: true,
    tookPdf: false,
    note: 'Вёрстка держится: горизонтального скролла нет, меню превращается в 11 кнопок.',
  },
};

export const PERSONAS: Persona[] = [novice, installer, minimal, interrupted, mobile];

export const byId = (id: string): Persona => {
  const p = PERSONAS.find((x) => x.id === id);
  if (!p) throw new Error(`Персона «${id}» не найдена`);
  return p;
};
