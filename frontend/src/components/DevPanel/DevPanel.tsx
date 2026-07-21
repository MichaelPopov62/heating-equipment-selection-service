/**
 * Назначение: панель разработчика — JSON, server save, payload (клиент не видит).
 */

import { useCallback, useState } from 'react';

import styles from './DevPanel.module.css';

export type DevPanelProps = {
  projectId: string | null;
  canRunCalc: boolean;
  calcReport: unknown;
  buildCalcPayload: () => unknown;
  buildDraftJson: () => unknown;
  onSaveFile: () => void;
  onSaveServer: (withCalc: boolean) => void;
  onOpenFile: () => void;
  onExportText: () => void;
  onExportHashLink: () => void;
  onRunManualCalc: () => void;
  onRevokeShare?: () => void;
};

type JsonViewId = 'draft' | 'payload' | 'report' | 'modules';

/**
 * @param props
 */
export function DevPanel({
  projectId,
  canRunCalc,
  calcReport,
  buildCalcPayload,
  buildDraftJson,
  onSaveFile,
  onSaveServer,
  onOpenFile,
  onExportText,
  onExportHashLink,
  onRunManualCalc,
  onRevokeShare,
}: DevPanelProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<JsonViewId | null>(null);
  const [jsonText, setJsonText] = useState('');

  const showJson = useCallback(
    (id: JsonViewId) => {
      try {
        let data: unknown;
        if (id === 'draft') data = buildDraftJson();
        else if (id === 'payload') data = buildCalcPayload();
        else if (id === 'report') data = calcReport;
        else {
          const report =
            calcReport && typeof calcReport === 'object'
              ? (calcReport as Record<string, unknown>)
              : null;
          data = {
            commercial: report?.commercial ?? null,
            matching: report?.matching ?? null,
            calculations: report?.calculations ?? null,
            meta: report?.meta ?? null,
            warnings: report?.warnings ?? null,
          };
        }
        setJsonText(JSON.stringify(data, null, 2));
        setView(id);
      } catch (e) {
        setJsonText(e instanceof Error ? e.message : 'Ошибка сериализации');
        setView(id);
      }
    },
    [buildCalcPayload, buildDraftJson, calcReport],
  );

  if (!open) {
    return (
      <button
        type="button"
        className={styles.fab}
        onClick={() => {
          setOpen(true);
        }}
        title="Панель разработчика"
      >
        Dev
      </button>
    );
  }

  return (
    <aside className={styles.panel} aria-label="Панель разработчика">
      <div className={styles.head}>
        <strong>Developer</strong>
        <button
          type="button"
          className={styles.close}
          onClick={() => {
            setOpen(false);
            setView(null);
          }}
        >
          Закрыть
        </button>
      </div>
      <p className={styles.hint}>
        Клиент этот слой не видит. Project id:{' '}
        <code>{projectId ?? '—'}</code>
      </p>
      <div className={styles.actions}>
        <button type="button" onClick={onOpenFile}>
          Открыть JSON
        </button>
        <button type="button" onClick={onSaveFile}>
          Сохранить JSON
        </button>
        <button
          type="button"
          onClick={() => {
            onSaveServer(false);
          }}
        >
          На сервер
        </button>
        <button
          type="button"
          onClick={() => {
            onSaveServer(true);
          }}
        >
          На сервер + расчёт
        </button>
        <button type="button" onClick={onExportText}>
          TXT сводка
        </button>
        <button type="button" onClick={onExportHashLink}>
          Hash #survey=
        </button>
        <button type="button" disabled={!canRunCalc} onClick={onRunManualCalc}>
          POST /api/v1/calc
        </button>
        {onRevokeShare ? (
          <button type="button" onClick={onRevokeShare}>
            Отозвать share
          </button>
        ) : null}
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={() => { showJson('draft'); }}>
          Draft JSON
        </button>
        <button type="button" onClick={() => { showJson('payload'); }}>
          CalcInput
        </button>
        <button type="button" onClick={() => { showJson('report'); }}>
          Report
        </button>
        <button type="button" onClick={() => { showJson('modules'); }}>
          Модули
        </button>
      </div>
      {view != null ? (
        <pre className={styles.pre} tabIndex={0}>
          {jsonText}
        </pre>
      ) : null}
    </aside>
  );
}
