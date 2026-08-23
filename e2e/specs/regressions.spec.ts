/**
 * Назначение: по одному тесту на каждый дефект из ручного аудита 2026-08-23.
 * Описание: каждый тест назван идентификатором баг-репорта и повторяет шаги
 * из него дословно. Полные карточки — `docs/qa/heatcalc-audit.html`,
 * исходные протоколы — `docs/qa/research/U1..U5`.
 *
 * ВСЕ ЭТИ ТЕСТЫ СЕЙЧАС ПАДАЮТ. Это не поломка набора — это его назначение:
 * они фиксируют дефект, чтобы (а) починку можно было доказать,
 * (б) дефект не вернулся молча. Зелёный тест здесь означает «починено».
 *
 * Дефекты, которые нельзя проверить из браузера (BUG-14 вентиляция,
 * BUG-15/16 подбор котла, BUG-20 границы комнат), браузерными тестами
 * НЕ покрываются: браузер не отличит правдоподобное число от верного.
 * Их оракул — ручной расчёт теплотехника, см. раздел «Межі звіту» в отчёте.
 */
import { test, expect } from '@playwright/test';
import { SurveyPage } from '../support/survey';
import { byId } from '../personas';
import { FIELD, RESULT, TEXT, apos } from '../support/selectors';

/**
 * Помечает проверку, которая на этом стенде ничего не доказывает.
 *
 * Локальный стенд поднимается с выключенной авторизацией и без реального
 * Clerk-роутинга, поэтому часть дефектов там физически не воспроизводится.
 * Зелёный такой тест — не «починено», а «не проверено», и мы явно это
 * говорим, а не молчим.
 */
function requiresRealAuthStand(reason: string): void {
  const target = process.env.TARGET ?? 'local';
  test.skip(
    target === 'local',
    `Не проверяется на локальном стенде: ${reason} ` +
      'Нужен стенд с включённой авторизацией (TARGET=prod или PROJECTS_AUTH_ENABLED=true), ' +
      'причём с уже задеплоенными data-testid.',
  );
}

test.describe('Проходимость', () => {
  test('BUG-01 · расчёт не запускается молча, показывается заглушка', async ({ page }) => {
    const survey = await SurveyPage.openClean(page);
    const p = byId('minimal'); // намеренно без «Стіна №1»
    await survey.fillObject(p.object);
    await survey.fillRooms(p.rooms);
    await survey.fillHotWater(p.residents);
    const since = survey.oracle.mark();
    await survey.settle();

    await survey.goToStep('technicalResult');

    expect(
      survey.oracle.total,
      'Расчёт не отправлялся на сервер ни разу, хотя пользователь заполнил всё, ' +
        'что интерфейс обозначил как поля. Это и есть BUG-01.',
    ).toBeGreaterThan(0);

    expect(
      await survey.stubVisible(),
      'На месте результата показана таблица «Джерело: швидка оцінка (100 Вт/м²)». ' +
        'Заглушка не должна занимать место результата: пользователь считает, что расчёт прошёл.',
    ).toBe(false);

    void since;
  });

  test('BUG-02 · ошибка валидации указывает на конкретное поле', async ({ page }) => {
    const survey = await SurveyPage.openClean(page);
    const p = byId('novice');
    await survey.fillObject({ ...p.object, outsideC: 50 }); // схема режет по 40
    await survey.fillRooms(p.rooms);
    await survey.fillHotWater(p.residents);
    await survey.settle();

    const failed = survey.oracle.failedAttempts.at(-1);
    expect(failed?.status, 'Сервер должен был отклонить наружную температуру 50 °C').toBe(400);

    // Сервер прислал адрес поля — проверяем, что интерфейс его использовал.
    const generic = await survey.genericErrorVisible();
    expect(
      generic,
      'Интерфейс показал безадресную строку «Некоректні вхідні дані». ' +
        `Сервер при этом прислал точный адрес: ${JSON.stringify(failed?.errorBody ?? null)}. ` +
        'Пользователь не может узнать, какое из ~100 полей неверно — BUG-02.',
    ).toBe(false);

    const nearField = page.locator('[aria-invalid="true"]');
    expect(
      await nearField.count(),
      'Ни одно поле не помечено как невалидное (aria-invalid). ' +
        'Ошибка должна быть привязана к полю, а не висеть внизу страницы.',
    ).toBeGreaterThan(0);
  });

  test('BUG-03 · все проблемные комнаты названы за один раз', async ({ page }) => {
    const survey = await SurveyPage.openClean(page);
    await survey.fillObject({ roomsCount: 3 });
    await survey.fillRooms([
      { name: 'Вітальня', areaM2: 28, wallAreaM2: 12 },
      { name: 'Спальня', areaM2: 16 },   // без стены
      { name: 'Санвузол', areaM2: 6 },   // без стены
    ]);
    await survey.fillHotWater(4);
    await survey.settle();

    const failed = survey.oracle.failedAttempts.at(-1);
    const body = JSON.stringify(failed?.errorBody ?? {});
    const mentionsBoth = body.includes('Спальня') && body.includes('Санвузол');

    expect(
      mentionsBoth,
      'Ошибка называет только одну комнату за раз. Для дома на 8 комнат пользователь ' +
        `получит 8 последовательных отказов. Тело ответа: ${body}`,
    ).toBe(true);
  });

  test('BUG-04 · после ошибки результат инвалидируется, экспорт блокируется', async ({ page }) => {
    const survey = await SurveyPage.openClean(page);
    const p = byId('novice');
    await survey.fillObject(p.object);
    await survey.fillRooms(p.rooms);
    await survey.fillHotWater(p.residents);
    await survey.settle();
    expect(survey.oracle.succeeded.length, 'Нужен успешный расчёт до провокации ошибки')
      .toBeGreaterThan(0);

    // Ломаем данные: наружная выше допустимой.
    await survey.fillObject({ ...p.object, outsideC: 50 });
    await survey.settle();

    const stillHasEstimate = await survey.estimatePresent();
    expect(
      stillHasEstimate,
      'При активной ошибке 400 на экране осталась полная смета от предыдущего расчёта, ' +
        'и её можно выгрузить в PDF. Устаревший результат должен быть помечен или скрыт — BUG-04.',
    ).toBe(false);
  });

  test('BUG-05 · анониму предлагают вход, а не текст про Bearer', async ({ page }) => {
    requiresRealAuthStand('без авторизации сохранение проходит и 401 не возникает.');

    const survey = await SurveyPage.openClean(page);
    const p = byId('novice');
    await survey.fillObject(p.object);
    await survey.fillRooms(p.rooms);
    await survey.fillHotWater(p.residents);
    await survey.settle();

    // Дополнительно — по факту ответа сервера, а не по конфигурации
    // (PROJECTS_AUTH_ENABLED=false) — тогда 401 не возникает и проверка
    // ничего не значит. Определяем это по ответу сервера, а не по догадке.
    const saveResponse = page.waitForResponse(
      (r) => r.url().includes('/api/v1/projects') && r.request().method() === 'POST',
      { timeout: 15_000 },
    ).catch(() => null);
    await survey.clickHeader('save');
    const res = await saveResponse;

    test.skip(
      res !== null && res.status() < 400,
      'На этом стенде авторизация выключена: сохранение прошло без 401, ' +
        'проверять текст про Bearer нечего. Гоняйте с TARGET=prod или ' +
        'с PROJECTS_AUTH_ENABLED=true.',
    );

    expect(
      await page.getByText(apos(TEXT.authRequired)).first().isVisible().catch(() => false),
      'Показан технический текст «Потрібен Authorization: Bearer <JWT>». ' +
        'Пользователю нужно предложение войти со ссылкой, а не заголовок HTTP — BUG-05.',
    ).toBe(false);
  });

  test('BUG-06 · обязательные поля помечены до того, как в них упрёшься', async ({ page }) => {
    const survey = await SurveyPage.openClean(page);
    await survey.fillObject({ roomsCount: 2 });
    await survey.goToStep('rooms');

    const required = page.locator('[required], [aria-required="true"]');
    expect(
      await required.count(),
      'Ни одно поле анкеты не помечено обязательным: ни атрибутом, ни звёздочкой, ни подписью. ' +
        'При этом без «Площа, м²» стены расчёт не запускается вовсе — BUG-06 в связке с BUG-01.',
    ).toBeGreaterThan(0);
  });
});

test.describe('Физика и правдоподобие', () => {
  test('BUG-07 · наружная температура выше внутренней отклоняется', async ({ page }) => {
    const survey = await SurveyPage.openClean(page);
    await survey.fillObject({ roomsCount: 2, insideC: 20, outsideC: 40 });
    await survey.fillRooms([
      { name: 'Кімната 1', areaM2: 20, heightM: 2.7, wallAreaM2: 10 },
      { name: 'Кімната 2', areaM2: 15, heightM: 2.7, wallAreaM2: 8 },
    ]);
    await survey.fillHotWater(2);
    await survey.settle();

    const last = survey.oracle.succeeded.at(-1);
    expect(
      last,
      'Комбинация «зовні +40, всередині +20» физически бессмысленна для отопления, ' +
        'но принята сервером: схема разрешает outsideC до 40, а кросс-проверки нет. ' +
        'Результат — отрицательные теплопотери и подбор котла на 83 860 грн — BUG-07.',
    ).toBeUndefined();
  });

  test('BUG-08 · площадь 100000 м² и высота 999 м отклоняются', async ({ page }) => {
    const survey = await SurveyPage.openClean(page);
    await survey.fillObject({ roomsCount: 1, insideC: 20, outsideC: -22 });
    await survey.fillRooms([{ name: 'Кімната 1', areaM2: 100000, heightM: 999, wallAreaM2: 10 }]);
    await survey.fillHotWater(2);
    await survey.settle();

    const last = survey.oracle.succeeded.at(-1);
    expect(
      last,
      'Сто тысяч квадратных метров высотой 999 м приняты и посчитаны как 0.8 кВт. ' +
        'Верхних границ нет ни в интерфейсе, ни в схеме сервера — BUG-08.',
    ).toBeUndefined();
  });
});

test.describe('Сохранность данных', () => {
  test('BUG-10 · имя клиента переживает уход на вход и возврат', async ({ page }) => {
    requiresRealAuthStand('маршрут входа локально не поднят, а дефект возникает именно на нём.');

    const survey = await SurveyPage.openClean(page);
    await survey.fillObject({ clientName: 'ТЕСТ-ІМЯ-КЛІЄНТА', roomsCount: 2 });
    await page.waitForTimeout(2200);

    await page.goto('/login?returnTo=%2Fprojects', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    const draft = await survey.readDraft();
    expect(
      draft?.clientName,
      'Имя клиента перезаписано служебным значением «Без имени» прямо в хранилище — ' +
        'откатить нечем. Теряется на маршруте, куда приложение само отправляет пользователя — BUG-10.',
    ).toBe('ТЕСТ-ІМЯ-КЛІЄНТА');
  });

  test('BUG-11 · толщина стены переживает перезагрузку', async ({ page }) => {
    const survey = await SurveyPage.openClean(page);
    await survey.fillObject({ roomsCount: 2, wallThicknessMm: 500 });
    await page.waitForTimeout(2600);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1400);

    const value = await page.locator(FIELD.wallThickness).inputValue();
    expect(
      value,
      'Толщина стены откатилась на 200 мм — вероятно, ответ справочника пресетов ' +
        'перетирает пользовательское значение. Меняет все теплопотери, при этом ' +
        'результат выглядит правильным — BUG-11.',
    ).toBe('500');
  });

  test('BUG-09 · вторая вкладка не затирает работу первой', async ({ browser }) => {
    const ctx = await browser.newContext();
    const a = await ctx.newPage();
    const b = await ctx.newPage();

    const sa = await SurveyPage.openClean(a);
    await sa.fillObject({ clientName: 'TAB-A', roomsCount: 7 });
    await a.waitForTimeout(2000);

    const sb = await SurveyPage.open(b);
    await sb.fillObject({ clientName: 'TAB-B', insideC: 26, roomsCount: 3 });
    await b.waitForTimeout(2000);

    const draft = await sb.readDraft();
    await ctx.close();

    // roomsCount лежит в objectMeta, а не на верхнем уровне черновика.
    // Первая версия теста сравнивала undefined с числом и проходила впустую.
    const meta = (draft?.objectMeta ?? null) as Record<string, unknown> | null;
    expect(
      meta,
      'В черновике нет objectMeta — структура изменилась, тест надо чинить.',
    ).not.toBeNull();
    expect(
      meta?.roomsCount,
      'Вкладка B перезаписала черновик целиком из своего устаревшего снимка: ' +
        'семь помещений, заданные во вкладке A, стёрты без предупреждения. ' +
        'Подписки на изменения хранилища нет — BUG-09.',
    ).toBe(7);
  });

  test('BUG-12 · обрыв связи виден пользователю', async ({ page }) => {
    test.info().annotations.push({
      type: 'расхождение с ручным замером',
      description:
        'Локально (dev-сборка) этот тест ПРОХОДИТ: при обрыве связи блок ошибки ' +
        'становится видимым. Ручной проход U4 на проде наблюдал обратное — ' +
        '«ни ошибки, ни спиннера, ни белого экрана». Проверено, что в здоровом ' +
        'состоянии блок скрыт, то есть тест не ложноположительный. ' +
        'ВЫВОД: считать дефект закрытым НЕЛЬЗЯ до перепроверки на проде ' +
        'после деплоя data-testid. Возможная причина расхождения — разница ' +
        'между dev- и production-сборкой в обработке сетевых ошибок.',
    });

    const survey = await SurveyPage.openClean(page);
    const p = byId('novice');
    await survey.fillObject(p.object);
    await survey.fillRooms(p.rooms);
    await survey.fillHotWater(p.residents);
    await survey.settle();

    await page.route('**/api/v1/calc', (route) => route.abort('internetdisconnected'));
    await survey.fillObject({ ...p.object, insideC: 22 });
    await page.waitForTimeout(2500);

    await survey.goToStep('technicalResult');

    // Ищем не по всей странице, а в предназначенных для этого местах:
    // маркер фазы расчёта и блок ошибки. Поиск по всему тексту давал
    // ложное срабатывание на посторонних строках интерфейса.
    const { phase } = await survey.markers();
    const errorBlock = await page.locator(RESULT.calcError).first()
      .isVisible().catch(() => false);

    // Проверяем ВИДИМОЕ пользователю, а не внутренний маркер.
    // Первая версия теста засчитывала `data-calc-phase="error"` и проходила,
    // хотя на экране пользователю по-прежнему ничего не сообщалось.
    const warned = errorBlock;

    expect(
      warned,
      'При обрыве связи интерфейс не показал ничего: ни ошибки, ни индикатора ' +
        `(внутренний маркер data-calc-phase="${phase}", но видимого блока ошибки нет). ` +
        'Внутреннее состояние знает об ошибке — до экрана оно не доходит. ' +
        'Экран продолжает показывать устаревший отчёт как свежий — BUG-12.',
    ).toBe(true);
  });
});

test.describe('Язык интерфейса', () => {
  test('BUG-19 · на экране нет русских вкраплений и технического жаргона', async ({ page }) => {
    const survey = await SurveyPage.openClean(page);
    await survey.fillObject({ roomsCount: 2 });
    await survey.goToStep('rooms');

    const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');

    const russian = ['Комната', 'помещение', 'гостиная', 'спальня', 'санузел',
      'Без имени', 'Точки водоразбора', 'Перейти к шагу', 'Магистраль', 'Прална машина'];
    const jargon = ['В API:', 'MongoDB', 'traditional_dt', 'layout=', 'Two-Pass',
      'trunk', 'Bearer', 'інваріанта єдиного kind'];

    const foundRu = russian.filter((w) => body.includes(w));
    const foundJargon = jargon.filter((w) => body.includes(w));

    expect(
      foundRu,
      'Русские вкрапления в украиноязычном интерфейсе. Языковой гейт в проекте есть, ' +
        'но это чёрный список из пяти строк, и в сборке он не запускается — BUG-19.',
    ).toEqual([]);
    expect(
      foundJargon,
      'Технические идентификаторы на экране пользователя — BUG-19.',
    ).toEqual([]);
  });
});
