/**
 * Назначение: read-only презентация сметы по публичной ссылке `/s/{token}`.
 */

import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { FinancialSummaryTable } from '../FinancialSummary/FinancialSummaryTable';
import { Footer } from '../Footer/Footer';
import Logo from '../Logo/Logo';
import { brandUk } from '../../i18n/uk/brand';
import { downloadPublicSharePdf, fetchPublicShare } from '../../services/publicShareApi';
import type { PublicSharePayload } from '../../types/projectsApi';
import { isRecord } from '../../utils/jsonGuards';
import { parseCommercialBomFromReport } from '../../utils/parseCommercialBomFromReport';
import {
  buildTechnicalPrintHtml,
  reportLikeFromPublicShare,
} from '../../utils/buildTechnicalPrintHtml';
import { formatKw } from '../../utils/format';
import styles from './SharePresentationPage.module.css';

export type SharePresentationPageProps = {
  shareToken: string;
};

/**
 * @param props
 */
export function SharePresentationPage({ shareToken }: SharePresentationPageProps) {
  const [techOpen, setTechOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const query = useQuery({
    queryKey: ['publicShare', shareToken],
    queryFn: () => fetchPublicShare(shareToken),
  });

  const share: PublicSharePayload | null = query.data?.share ?? null;
  const error =
    query.error instanceof Error
      ? query.error.message
      : query.isError
        ? 'Ссылка недоступна'
        : null;
  const loading = query.isPending || query.isFetching;

  const commercial = useMemo(() => {
    if (!share) return null;
    return parseCommercialBomFromReport({ commercial: share.commercial });
  }, [share]);

  const equipmentSummary = useMemo(() => buildEquipmentSummary(share), [share]);

  const technicalHtml = useMemo(() => {
    if (!share) return '';
    return buildTechnicalPrintHtml(reportLikeFromPublicShare(share));
  }, [share]);

  const onDownloadPdf = useCallback(
    (includeTechnical: boolean) => {
      if (!share || !commercial || pdfBusy) return;
      setPdfBusy(true);
      void (async () => {
        try {
          await downloadPublicSharePdf(shareToken, { includeTechnical });
        } catch (e) {
          window.alert(e instanceof Error ? e.message : 'Не удалось скачать PDF');
        } finally {
          setPdfBusy(false);
        }
      })();
    },
    [commercial, pdfBusy, share, shareToken],
  );

  if (loading && !share) {
    return (
      <div className={styles.page}>
        <p className={styles.status}>Загрузка сметы…</p>
      </div>
    );
  }

  if (error || !share || !commercial) {
    return (
      <div className={styles.page}>
        <header className={styles.top}>
          <Logo />
          <h1 className={styles.brand}>{brandUk.name}</h1>
        </header>
        <p className={styles.error} role="alert">
          {error ?? 'Смета не найдена'}
        </p>
        <Footer variant="share" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.brandRow}>
          <Logo />
          <div>
            <h1 className={styles.brand}>{brandUk.name}</h1>
            <p className={styles.sub}>Финансовый итог по расчёту</p>
          </div>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btn}
            disabled={pdfBusy}
            onClick={() => {
              onDownloadPdf(false);
            }}
          >
            {pdfBusy ? 'Скачивание…' : 'Скачать PDF'}
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            disabled={pdfBusy || !technicalHtml}
            onClick={() => {
              onDownloadPdf(true);
            }}
          >
            PDF + технический расчёт
          </button>
        </div>
      </header>

      <section className={styles.meta}>
        <p>
          <strong>Клиент:</strong> {share.clientName}
        </p>
        {share.objectType ? (
          <p>
            <strong>Объект:</strong>{' '}
            {share.objectType === 'apartment' ? 'Квартира' : 'Дом'}
          </p>
        ) : null}
        <p>
          <strong>Опубликовано:</strong> {share.publishedAt.slice(0, 10)}
        </p>
      </section>

      {equipmentSummary.length > 0 ? (
        <section className={styles.equipment} aria-label="Оборудование">
          <h2 className={styles.h2}>Оборудование</h2>
          {equipmentSummary.map((block) => (
            <details key={block.title} className={styles.acc} open>
              <summary>{block.title}</summary>
              <ul>
                {block.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </details>
          ))}
        </section>
      ) : null}

      <section className={styles.bom} aria-label="Смета">
        <h2 className={styles.h2}>Смета</h2>
        <FinancialSummaryTable commercial={commercial} />
      </section>

      {technicalHtml ? (
        <section className={styles.tech}>
          <button
            type="button"
            className={styles.techToggle}
            onClick={() => { setTechOpen((v) => !v); }}
          >
            {techOpen ? 'Скрыть технический расчёт' : 'Показать технический расчёт'}
          </button>
          {techOpen ? (
            <div
              className={styles.techBody}
              dangerouslySetInnerHTML={{ __html: technicalHtml }}
            />
          ) : null}
        </section>
      ) : null}

      <p className={styles.footnote}>Документ только для просмотра. Изменение анкеты недоступно.</p>
      <Footer variant="share" />
    </div>
  );
}

type EquipmentBlock = { title: string; lines: string[] };

/**
 * @param share
 */
function buildEquipmentSummary(share: PublicSharePayload | null): EquipmentBlock[] {
  if (!share) return [];
  const matching = share.matching;
  const blocks: EquipmentBlock[] = [];

  const boiler = isRecord(matching.boiler) ? matching.boiler : null;
  if (boiler) {
    const lines: string[] = [];
    if (typeof boiler.requiredKw === 'number') {
      lines.push(`Требуемая мощность: ${formatKw(boiler.requiredKw)} кВт`);
    }
    const selected = isRecord(boiler.selected) ? boiler.selected : null;
    const proposal = isRecord(boiler.proposal) ? boiler.proposal : null;
    const model =
      (selected && typeof selected.model === 'string' ? selected.model : null) ??
      (proposal && typeof proposal.model === 'string' ? proposal.model : null);
    const brand =
      (selected && typeof selected.brand === 'string' ? selected.brand : null) ??
      (proposal && typeof proposal.brand === 'string' ? proposal.brand : null);
    if (model) lines.push(`Модель: ${[brand, model].filter(Boolean).join(' ')}`);
    if (lines.length) blocks.push({ title: 'Котёл', lines });
  }

  const radiators = isRecord(matching.radiators) ? matching.radiators : null;
  if (radiators) {
    const chosen = isRecord(radiators.chosen) ? radiators.chosen : null;
    const lines: string[] = [];
    if (chosen && typeof chosen.model === 'string') {
      const brand = typeof chosen.brand === 'string' ? chosen.brand : '';
      lines.push(`Модель: ${[brand, chosen.model].filter(Boolean).join(' ')}`);
    }
    if (chosen && typeof chosen.totalSections === 'number') {
      lines.push(`Секций: ${chosen.totalSections}`);
    }
    if (lines.length) blocks.push({ title: 'Радиаторы', lines });
  }

  return blocks;
}
