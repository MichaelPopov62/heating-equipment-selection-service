/**
 * Назначение: прогон пяти персон — замер проходимости продукта.
 * Описание: воспроизводит ручной аудит 2026-08-23 в автоматическом виде.
 * Это НЕ проверка «не сломалось ли» — это измерение условий `GA-01` и `GA-02`
 * из плана: «расчёт получают 5 из 5 персон без подсказок» и «смету забирают 5 из 5».
 *
 * НАБОР СЕЙЧАС ПАДАЕТ, И ЭТО ПРАВИЛЬНО. На 2026-08-23 замер был
 * «3 из 4 дошли до сметы, 0 из 4 забрали PDF». Тесты описывают целевое
 * состояние, а не текущее: зелёными они станут после Фазы A, и именно это
 * будет доказательством, что фаза закончена.
 *
 * Каждое падение обязано читаться как диагноз. Если оно читается как
 * «expected true, got false» — это дефект теста, а не продукта, и его чинят.
 */
import { test, expect } from '@playwright/test';
import { PERSONAS, type Persona } from '../personas';
import { SurveyPage, assertFreshCalculation } from '../support/survey';
import { TEXT } from '../support/selectors';

type Outcome = {
  persona: string;
  reachedEstimate: boolean;
  tookPdf: boolean;
  calcRequests: number;
  failure?: string;
};

const outcomes: Outcome[] = [];

for (const persona of PERSONAS) {
  const projectFilter = persona.mobile ? 'mobile' : 'chromium';

  test.describe(`Персона «${persona.id}» — ${persona.title}`, () => {
    // Мобильная персона гоняется только в проекте mobile, остальные — только в chromium.
    test.beforeEach(() => {
      test.skip(
        test.info().project.name !== projectFilter,
        `Эта персона гоняется только в проекте ${projectFilter}`,
      );
    });

    test(`доходит до настоящего расчёта [${persona.id}]`, async ({ page }) => {
      test.info().annotations.push(
        { type: 'источник', description: persona.source },
        { type: 'замер 2026-08-23', description: persona.baseline.note },
      );

      const survey = await SurveyPage.openClean(page);
      await fill(survey, persona);

      const since = survey.oracle.mark();
      await survey.settle();

      // Диагностика до ассерта — чтобы в отчёте было видно, что произошло.
      const stub = await survey.stubVisible();
      const genericError = await survey.genericErrorVisible();
      if (genericError) {
        const failed = survey.oracle.failedAttempts.at(-1);
        test.info().annotations.push({
          type: 'ошибка сервера',
          description:
            'Интерфейс показал безадресную строку «Некоректні вхідні дані» (BUG-02). ' +
            `Сервер при этом прислал: ${JSON.stringify(failed?.errorBody ?? null)}`,
        });
      }
      if (stub) {
        test.info().annotations.push({
          type: 'заглушка',
          description: 'Показана «швидка оцінка (100 Вт/м²)» вместо расчёта — BUG-01.',
        });
      }

      await assertFreshCalculation(survey, since);
    });

    test(`получает непустую смету [${persona.id}]`, async ({ page }) => {
      const survey = await SurveyPage.openClean(page);
      await fill(survey, persona);
      await survey.settle();

      const has = await survey.estimatePresent();
      const rec: Outcome = {
        persona: persona.id,
        reachedEstimate: has,
        tookPdf: false,
        calcRequests: survey.oracle.total,
      };
      outcomes.push(rec);

      expect(
        has,
        `Смета не сформирована. Запросов расчёта: ${survey.oracle.total}, ` +
          `успешных: ${survey.oracle.succeeded.length}. ` +
          `При ручном проходе: ${persona.baseline.note}`,
      ).toBe(true);
    });

    test(`забирает PDF [${persona.id}]`, async ({ page }) => {
      const survey = await SurveyPage.openClean(page);
      await fill(survey, persona);
      await survey.settle();

      const download = page.waitForEvent('download', { timeout: 20_000 }).catch(() => null);
      const clickable = await survey.clickHeader('pdf');
      if (!clickable) {
        test.info().annotations.push({
          type: 'кнопка заблокирована',
          description:
            'Кнопка «PDF / Завантажити» неактивна: расчёта не было, экспортировать нечего. ' +
            'Пользователю при этом не объясняют, чего не хватает (BUG-06 в связке с BUG-21).',
        });
      }

      // Меню экспорта может требовать выбора вида отчёта.
      const item = page.getByRole('button', { name: /Фінансовий підсумок|Фінанси \+ технічний/ }).first();
      if (await item.isVisible().catch(() => false)) await item.click();

      const file = await download;

      const authText = await page.getByText(TEXT.authRequired, { exact: false }).first()
        .isVisible().catch(() => false);
      const nameText = await page.getByText(TEXT.clientNameRequired, { exact: false }).first()
        .isVisible().catch(() => false);

      expect(
        file,
        [
          'PDF не скачался.',
          authText
            ? 'На экране технический текст «Потрібен Authorization: Bearer <JWT>» — BUG-05. ' +
              'Аноним не может забрать смету, и ему не предлагают войти.'
            : '',
          nameText ? 'Потребовано «Ім’я клієнта» — но кнопка выглядела активной до клика (BUG-05).' : '',
        ].filter(Boolean).join('\n'),
      ).not.toBeNull();
    });

    if (persona.interrupts) {
      test(`продолжает после перерыва без повторного ввода [${persona.id}]`, async ({ page }) => {
        const survey = await SurveyPage.openClean(page);
        await survey.fillObject(persona.object);
        await survey.fillRooms(persona.rooms.slice(0, 2));
        await page.waitForTimeout(2500); // черновик пишется с задержкой

        const before = await survey.readDraft();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1200);
        const after = await survey.readDraft();

        expect(before, 'Черновик не сохранился вообще').not.toBeNull();

        // Имя клиента — BUG-10, толщина стены — BUG-11, текущий шаг — спорно (см. BUG-12).
        expect(
          JSON.stringify(after?.clientName ?? null),
          'Имя клиента не пережило перезагрузку — BUG-10.',
        ).toBe(JSON.stringify(before?.clientName ?? null));

        expect(
          after?.currentStep,
          'Текущий шаг не сохранён: после возврата пользователь падает на первый шаг. ' +
            'Внимание: протоколы U3 и U4 здесь расходятся — этот тест их и рассудит.',
        ).not.toBe('object');
      });
    }
  });
}

test.afterAll(async () => {
  if (!outcomes.length) return;
  const reached = outcomes.filter((o) => o.reachedEstimate).length;
  const lines = [
    '',
    '═══ ТАБЛО ПРОХОДИМОСТІ ═══',
    `Дійшли до кошторису: ${reached} із ${outcomes.length}   (умова GA-01)`,
    `Забрали PDF:         ${outcomes.filter((o) => o.tookPdf).length} із ${outcomes.length}   (умова GA-02)`,
    '',
    'Замір 2026-08-23 вручну: 3 із 4 дійшли, 0 із 4 забрали.',
    'Ворота A вважаються пройденими лише при 5 із 5 в обох рядках.',
    '',
  ];
  // eslint-disable-next-line no-console
  console.log(lines.join('\n'));
});

async function fill(survey: SurveyPage, p: Persona): Promise<void> {
  await survey.fillObject(p.object);
  await survey.fillRooms(p.rooms);
  await survey.fillHotWater(p.residents);
}
