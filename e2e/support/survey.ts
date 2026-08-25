/**
 * Назначение: объект страницы анкеты HeatCalc.
 * Описание: механика заполнения, отделённая от данных персон. Все селекторы
 * берутся из `selectors.ts` — здесь их быть не должно.
 */
import { expect, type Page } from '@playwright/test';
import {
  DRAFT_KEY, FIELD, HEADER, RESULT, ROOM, TEXT, apos, roomId, stepNav,
  type StepKey,
} from './selectors';
import { CalcOracle, assertMarkersHonest, readMarkers, stubVisible } from './oracle';

export type RoomSpec = {
  name: string;
  /** Значение выпадающего списка «Тип» — дословно из интерфейса. */
  type?: string;
  areaM2: number;
  heightM?: number;
  /**
   * Площадь первой наружной стены. Без неё расчёт не запускается —
   * это BUG-01 и BUG-06. Персона `minimal` намеренно её не задаёт.
   */
  wallAreaM2?: number;
};

export type ObjectSpec = {
  clientName?: string;
  roomsCount: number;
  insideC?: number;
  outsideC?: number;
  wallThicknessMm?: number;
};

export class SurveyPage {
  readonly oracle: CalcOracle;

  private constructor(readonly page: Page, oracle: CalcOracle) {
    this.oracle = oracle;
  }

  static async open(page: Page): Promise<SurveyPage> {
    const oracle = await CalcOracle.attach(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
    await dismissCookie(page);

    // Стартовый экран появляется не всегда: при живом черновике приложение
    // открывает анкету сразу, без вопроса «продовжити?» (наблюдение U4).
    const start = page.getByRole('button', { name: TEXT.startNew, exact: false }).first();
    if (await start.isVisible().catch(() => false)) {
      await start.click();
      await page.waitForTimeout(500);
    }
    await page.locator(stepNav('object')).first()
      .waitFor({ state: 'visible', timeout: 20_000 });
    return new SurveyPage(page, oracle);
  }

  /** Полная очистка состояния — иначе персона наследует чужой черновик. */
  static async openClean(page: Page): Promise<SurveyPage> {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        /* приватный режим — не наша забота, см. отчёт про localStorage */
      }
    });
    return SurveyPage.open(page);
  }

  async goToStep(step: StepKey): Promise<void> {
    await this.page.locator(stepNav(step)).first().click();
    await this.page.waitForTimeout(150);
  }

  async fillObject(spec: ObjectSpec): Promise<void> {
    await this.goToStep('object');
    if (spec.clientName !== undefined) {
      await this.page.locator(FIELD.clientName).fill(spec.clientName);
    }
    await this.page.locator(FIELD.roomsCount).fill(String(spec.roomsCount));
    if (spec.insideC !== undefined) {
      await this.page.locator(FIELD.insideC).fill(String(spec.insideC));
    }
    if (spec.outsideC !== undefined) {
      await this.page.locator(FIELD.outsideC).fill(String(spec.outsideC));
    }
    if (spec.wallThicknessMm !== undefined) {
      await this.page.locator(FIELD.wallThickness).fill(String(spec.wallThicknessMm));
    }
    await this.page.waitForTimeout(400);
  }

  /** Заполняет карточки помещений по атрибутам. */
  async fillRooms(rooms: RoomSpec[]): Promise<void> {
    await this.goToStep('rooms');
    await this.page.locator(ROOM.name(roomId(1)))
      .waitFor({ state: 'attached', timeout: 20_000 });

    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      const rid = roomId(i + 1);

      if (!(await this.page.locator(ROOM.name(rid)).count())) {
        throw new Error(
          `Карточки помещения ${rid} нет в DOM. Ожидалось ${rooms.length} помещений — ` +
          'проверьте, что «Кількість приміщень» применилась.',
        );
      }
      await this.expandRoom(rid);
      await this.page.locator(ROOM.name(rid)).fill(room.name);
      if (room.type) {
        await this.page.locator(ROOM.type(rid)).selectOption({ label: room.type })
          .catch(() => undefined);
      }
      await this.page.locator(ROOM.area(rid)).fill(String(room.areaM2));
      if (room.heightM !== undefined) {
        await this.page.locator(ROOM.height(rid)).fill(String(room.heightM));
      }
      // Поле, без которого расчёт не запускается вовсе — BUG-01.
      if (room.wallAreaM2 !== undefined) {
        await this.page.locator(ROOM.wall1Area(rid)).fill(String(room.wallAreaM2));
      }
      await this.page.waitForTimeout(150);
    }
    await this.page.waitForTimeout(400);
  }

  /**
   * Раскрывает карточку помещения. Поля есть в DOM и у свёрнутой карточки,
   * но скрыты — заполнить их без раскрытия нельзя.
   * Кнопка-переключатель называется «Відкрити» / «Згорнути» и несёт в имени
   * идентификатор комнаты («… ID: r1 Відкрити»), по нему и адресуемся.
   */
  private async expandRoom(rid: string): Promise<void> {
    const nameField = this.page.locator(ROOM.name(rid));
    if (await nameField.isVisible().catch(() => false)) return;
    const toggle = this.page.locator(ROOM.toggle(rid));
    if (await toggle.count()) {
      await toggle.click().catch(() => undefined);
      await nameField.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
    }
  }

  async fillHotWater(residents: number): Promise<void> {
    await this.goToStep('hotWater');
    await this.page.locator(FIELD.residents).fill(String(residents));
    await this.page.waitForTimeout(300);
  }

  /** Дождаться, пока все начатые расчёты завершатся. */
  async settle(): Promise<void> {
    await this.oracle.settle(this.page);
  }

  async readDraft(): Promise<Record<string, unknown> | null> {
    return this.page.evaluate((key) => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
      } catch {
        return null;
      }
    }, DRAFT_KEY);
  }

  /**
   * Жмёт кнопку шапки. Возвращает `false`, если кнопка заблокирована —
   * это отдельное наблюдение, а не сбой: активность кнопок привязана
   * к готовности анкеты, а не к наличию входа (см. BUG-05).
   */
  async clickHeader(button: keyof typeof HEADER): Promise<boolean> {
    const btn = this.page.locator(HEADER[button]).first();
    await btn.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);
    if (await btn.isDisabled().catch(() => false)) return false;
    await btn.click({ timeout: 10_000 }).catch(() => undefined);
    await this.page.waitForTimeout(600);
    return true;
  }

  /** Показана ли безадресная ошибка «Некоректні вхідні дані» — BUG-02. */
  async genericErrorVisible(): Promise<boolean> {
    return this.page.locator(RESULT.calcError).first()
      .isVisible().catch(() => false);
  }

  async stubVisible(): Promise<boolean> {
    return stubVisible(this.page);
  }

  /** Машиночитаемое состояние панели результата. */
  async markers(): Promise<{ source: string | null; phase: string | null }> {
    return readMarkers(this.page);
  }

  /**
   * Есть ли на экране непустая смета. Проверяется на шаге «Підсумок фінансовий».
   * Само по себе НЕ доказывает, что расчёт свежий — см. BUG-04.
   */
  async estimatePresent(): Promise<boolean> {
    await this.goToStep('financialResult');
    await this.page.waitForTimeout(400);
    if (await this.page.locator(RESULT.estimateEmpty).first().isVisible().catch(() => false)) {
      return false;
    }
    return this.page.locator(RESULT.estimateTotal).first()
      .isVisible().catch(() => false);
  }
}

/**
 * Ждёт, пока React отрисует приложение. Без этого набор гоняется по пустому DOM:
 * `domcontentloaded` в SPA наступает задолго до появления интерфейса.
 * Первые два прогона упали именно на этом.
 */
async function waitForApp(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
  await page
    .locator('button')
    .filter({ hasText: /Об.єкт|Почати новий розрахунок|Зрозуміло/ })
    .first()
    .waitFor({ state: 'visible', timeout: 30_000 })
    .catch(() => undefined);
}

async function dismissCookie(page: Page): Promise<void> {
  const btn = page.getByRole('button', { name: TEXT.cookieAccept, exact: false }).first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click().catch(() => undefined);
  }
}

/** Единая проверка «персона получила настоящий расчёт», с диагностикой при провале. */
export async function assertFreshCalculation(survey: SurveyPage, since: number): Promise<void> {
  await survey.settle();
  const { fresh, reason } = survey.oracle.freshness(since);
  const stub = await survey.stubVisible();

  expect(
    fresh,
    [
      `Настоящего расчёта не было. ${reason}`,
      stub
        ? 'На экране при этом показана заглушка «Джерело: швидка оцінка (100 Вт/м²)» — BUG-01.'
        : '',
      `Всего запросов расчёта за сессию: ${survey.oracle.total}, успешных: ${survey.oracle.succeeded.length}.`,
    ].filter(Boolean).join('\n'),
  ).toBe(true);

  expect(stub, 'Расчёт прошёл, но экран показывает заглушку «швидка оцінка» — BUG-01.').toBe(false);

  // Маркер не независим от подписи — сверяем его с сетью, иначе он способен
  // сделать зелёным весь набор, унаследовав дефект BUG-04.
  const dishonest = await assertMarkersHonest(survey.page, survey.oracle, since);
  expect(dishonest, dishonest ?? '').toBeNull();
}
