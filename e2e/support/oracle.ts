/**
 * Назначение: оракул «был ли настоящий расчёт».
 * Описание: центральная часть набора. Отличить настоящий расчёт от заглушки
 * и от устаревшего результата по тексту на экране НЕЛЬЗЯ, и это не придирка,
 * а два подтверждённых дефекта:
 *
 *   BUG-01 — когда расчёт не запускался, экран показывает таблицу с подписью
 *            «Джерело: швидка оцінка (100 Вт/м²)», внешне неотличимую от результата.
 *   BUG-04 — после ошибки 400 на экране остаётся ПРЕДЫДУЩИЙ результат
 *            с подписью «Джерело: розрахунок API за огородженнями», то есть
 *            правильная подпись стоит над неправильными числами.
 *
 * Поэтому оракул слушает сеть, а не читает разметку: считает запросы расчёта
 * и требует успешный ответ ПОСЛЕ последнего изменения данных. Это работает
 * сегодня, без единой правки продукта.
 *
 * Когда будут сделаны F-14 (`data-source`, `data-calc-phase`, `data-report-epoch`),
 * появится второй, независимый источник истины — и тогда `assertFresh` должен
 * сверять оба и падать при расхождении. Это мета-проверка честности маркеров
 * (AC-17 из плана): маркер, унаследовавший дефект нынешней подписи, сделает
 * зелёным весь набор.
 */
import type { Page, Request, Response } from '@playwright/test';
import { CALC_PATH, RESULT, TEXT, apos } from './selectors';

export type CalcAttempt = {
  index: number;
  startedAt: number;
  finishedAt?: number;
  status?: number;
  failed?: string;
  /** Тело ответа при ошибке — оттуда берётся адрес поля, который UI выбрасывает. */
  errorBody?: unknown;
};

export class CalcOracle {
  private attempts: CalcAttempt[] = [];
  private counter = 0;

  private constructor(private readonly page: Page) {}

  static async attach(page: Page): Promise<CalcOracle> {
    const oracle = new CalcOracle(page);

    page.on('request', (req: Request) => {
      if (!req.url().includes(CALC_PATH) || req.method() !== 'POST') return;
      oracle.attempts.push({ index: ++oracle.counter, startedAt: Date.now() });
    });

    page.on('response', async (res: Response) => {
      if (!res.url().includes(CALC_PATH) || res.request().method() !== 'POST') return;
      const open = [...oracle.attempts].reverse().find((a) => a.finishedAt === undefined);
      if (!open) return;
      open.finishedAt = Date.now();
      open.status = res.status();
      if (res.status() >= 400) {
        open.errorBody = await res.json().catch(() => null);
      }
    });

    page.on('requestfailed', (req: Request) => {
      if (!req.url().includes(CALC_PATH) || req.method() !== 'POST') return;
      const open = [...oracle.attempts].reverse().find((a) => a.finishedAt === undefined);
      if (!open) return;
      open.finishedAt = Date.now();
      open.failed = req.failure()?.errorText ?? 'unknown';
    });

    return oracle;
  }

  /** Отметка «здесь пользователь закончил вводить данные». */
  mark(): number {
    return Date.now();
  }

  all(): readonly CalcAttempt[] {
    return this.attempts;
  }

  /** Сколько раз расчёт вообще уходил на сервер. Ноль — это BUG-01. */
  get total(): number {
    return this.attempts.length;
  }

  get succeeded(): CalcAttempt[] {
    return this.attempts.filter((a) => a.status === 200);
  }

  get failedAttempts(): CalcAttempt[] {
    return this.attempts.filter((a) => (a.status ?? 0) >= 400 || a.failed);
  }

  /** Дождаться завершения всех начатых расчётов (дебаунс интерфейса ~700 мс). */
  async settle(page: Page, quietMs = 1500): Promise<void> {
    await page.waitForTimeout(quietMs);
    const deadline = Date.now() + 30_000;
    while (this.attempts.some((a) => a.finishedAt === undefined) && Date.now() < deadline) {
      await page.waitForTimeout(250);
    }
  }

  /**
   * Главная проверка: после отметки `since` был успешный расчёт,
   * и с тех пор ни один не упал.
   */
  freshness(since: number): { fresh: boolean; reason: string } {
    const after = this.attempts.filter((a) => a.startedAt >= since - 50);

    if (after.length === 0) {
      return {
        fresh: false,
        reason:
          'Расчёт не отправлялся на сервер вообще — это BUG-01. ' +
          'Экран при этом может показывать таблицу-заглушку, внешне похожую на результат.',
      };
    }

    const last = after[after.length - 1];
    if (last.failed) {
      return { fresh: false, reason: `Последний расчёт не дошёл до сервера: ${last.failed} (BUG-12).` };
    }
    if (last.status !== 200) {
      const msg = extractError(last.errorBody);
      return {
        fresh: false,
        reason:
          `Последний расчёт отклонён сервером (HTTP ${last.status}). ${msg}\n` +
          'Проверьте, что интерфейс показал это у конкретного поля, а не одной строкой (BUG-02, BUG-03).',
      };
    }
    return { fresh: true, reason: 'ok' };
  }
}

/**
 * Достаёт из тела ошибки адрес поля. Сервер его присылает, интерфейс выбрасывает
 * (BUG-02) — набору он нужен, чтобы отчёт о падении был диагностическим,
 * а не «что-то пошло не так».
 */
export function extractError(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const err = (body as Record<string, unknown>).error;
  if (!err || typeof err !== 'object') return '';
  const e = err as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof e.message === 'string') parts.push(`«${e.message}»`);
  if (typeof e.code === 'string') parts.push(`код ${e.code}`);
  const details = e.details;
  if (Array.isArray(details) && details.length) {
    const fields = details
      .map((d) => {
        if (!d || typeof d !== 'object') return null;
        const r = d as Record<string, unknown>;
        const path = typeof r.instancePath === 'string' ? r.instancePath : '';
        const msg = typeof r.message === 'string' ? r.message : '';
        return path || msg ? `${path} ${msg}`.trim() : null;
      })
      .filter(Boolean);
    if (fields.length) parts.push(`поля: ${fields.join('; ')}`);
  }
  return parts.join(', ');
}

/** Видна ли на экране заглушка вместо расчёта (BUG-01). */
export async function stubVisible(page: Page): Promise<boolean> {
  const bySource = await page.locator(`${RESULT.panel}[data-source="quick"]`)
    .first().isVisible().catch(() => false);
  if (bySource) return true;
  // Запасной путь: панель без атрибута, опознаём по подписи.
  return page.getByText(apos(TEXT.stubSource)).first().isVisible().catch(() => false);
}

/** Машиночитаемое состояние панели результата. */
export async function readMarkers(
  page: Page,
): Promise<{ source: string | null; phase: string | null }> {
  const panel = page.locator(RESULT.panel).first();
  if (!(await panel.count())) return { source: null, phase: null };
  return {
    source: await panel.getAttribute('data-source').catch(() => null),
    phase: await panel.getAttribute('data-calc-phase').catch(() => null),
  };
}

/**
 * Мета-проверка честности маркеров.
 *
 * `data-source` выводится из того же признака, что и подпись «Джерело: …»,
 * то есть это не независимый источник истины. Если маркер унаследует дефект
 * подписи, зелёным станет весь набор — и падение перестанет что-либо значить.
 * Поэтому маркер сверяется с сетью: единственным свидетельством, которое
 * интерфейс подделать не может.
 *
 * Расхождение — это дефект маркера, а не продукта, и чинить надо набор.
 */
export async function assertMarkersHonest(
  page: Page,
  oracle: CalcOracle,
  since: number,
): Promise<string | null> {
  const { source, phase } = await readMarkers(page);
  if (source === null) return null; // панели нет — проверять нечего

  const { fresh } = oracle.freshness(since);
  const networkSaysReal = fresh && oracle.succeeded.length > 0;

  if (source === 'api' && !networkSaysReal) {
    return (
      'Маркер `data-source="api"` утверждает, что показан расчёт с сервера, ' +
      `но по сети успешного ответа после последнего изменения не было ` +
      `(запросов: ${oracle.total}, успешных: ${oracle.succeeded.length}). ` +
      'Маркер унаследовал дефект подписи из BUG-04 — доверять ему нельзя.'
    );
  }
  if (source === 'quick' && networkSaysReal && phase === 'ok') {
    return (
      'Маркер `data-source="quick"` утверждает заглушку, но по сети расчёт прошёл успешно. ' +
      'Маркер и сеть противоречат друг другу.'
    );
  }
  return null;
}
