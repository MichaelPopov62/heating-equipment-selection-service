/**
 * Назначение: HTTP-клиент расчёта.
 * Описание: POST /api/v1/calc с разбором успешного ответа и обработкой сетевых ошибок.
 */

import type { CalcOkPayload } from '../types/calcApi';
import { isRecord } from '../utils/jsonGuards';

/** Сообщение при сетевой ошибке fetch (бэкенд не слушает порт или прокси оборвал соединение). */
function networkCalcErrorMessage(cause: unknown): string {
  const hint =
    'Запустите API: `cd backend && npm run start` и UI: `cd frontend && npm run dev` (запросы идут через прокси Vite → порт 3001).';
  if (cause instanceof TypeError) {
    const m = cause.message.toLowerCase();
    if (
      m.includes('failed to fetch') ||
      m.includes('networkerror') ||
      m.includes('load failed')
    ) {
      return `Сервер расчёта недоступен (${cause.message}). ${hint}`;
    }
  }
  return cause instanceof Error ? cause.message : 'Ошибка расчёта';
}

function parseCalcOkPayload(data: unknown): CalcOkPayload {
  if (!isRecord(data) || data.ok !== true) {
    throw new Error('Некорректный ответ API при расчёте');
  }
  const reportRaw = data.report;
  if (!isRecord(reportRaw)) {
    throw new Error('Некорректный ответ API при расчёте: нет объекта report');
  }
  return { ok: true, report: reportRaw };
}

export async function postCalc(payload: unknown): Promise<CalcOkPayload> {
  let res: Response;
  try {
    res = await fetch('/api/v1/calc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err: unknown) {
    throw new Error(networkCalcErrorMessage(err), {
      cause: err,
    });
  }
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    let msg = `Ошибка API: HTTP ${res.status}`;
    if (isRecord(data)) {
      const errNode = data.error;
      if (isRecord(errNode)) {
        const m = errNode.message;
        msg =
          typeof m === 'string'
            ? m
            : m != null && typeof m !== 'object'
              ? String(m)
              : msg;
      }
    }
    throw new Error(msg);
  }
  return parseCalcOkPayload(data);
}
