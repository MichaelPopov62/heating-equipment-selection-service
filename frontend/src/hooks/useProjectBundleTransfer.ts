/**
 * Назначение: один file input + режим (import / openLocal) для export/import bundle.
 * Описание: кнопки задают режим; onChange делегирует receiveProjectBundle или openLocal.
 */

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { SurveyDraft } from '../types/surveyDraft';
import { parseSurveyDraft } from '../utils/parsers/parseSurveyDraft';
import {
  mapProjectImportErrorMessage,
  receiveProjectBundle,
  sendProjectBundle,
  type ProjectBundleExportParams,
  type ProjectBundleImportResult,
} from '../utils/projectBundleTransfer';

/** Режим очікуваного файлу для спільного input. */
export type ProjectBundleFileMode = 'import' | 'openLocal';

export type UseProjectBundleTransferParams = {
  /** Підтвердження перед імпортом (наприклад, заміна поточної анкети). */
  confirmBeforeImport?: () => boolean | Promise<boolean>;
  onImportSuccess?: (result: ProjectBundleImportResult) => void | Promise<void>;
  onOpenLocalSuccess?: (draft: SurveyDraft, fileName: string) => void;
  onStatus?: (message: string | null, error: string | null) => void;
};

export type UseProjectBundleTransferResult = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  requestImport: () => void;
  requestOpenLocal: () => void;
  sendProjectBundle: (params: ProjectBundleExportParams) => Promise<void>;
  importBusy: boolean;
  exportBusy: boolean;
};

/**
 * @param params
 */
export function useProjectBundleTransfer(
  params: UseProjectBundleTransferParams = {},
): UseProjectBundleTransferResult {
  const { confirmBeforeImport, onImportSuccess, onOpenLocalSuccess, onStatus } = params;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingModeRef = useRef<ProjectBundleFileMode | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const notify = useCallback(
    (message: string | null, error: string | null) => {
      onStatus?.(message, error);
    },
    [onStatus],
  );

  const runImport = useCallback(
    async (file: File) => {
      if (confirmBeforeImport) {
        const ok = await confirmBeforeImport();
        if (!ok) return;
      }

      setImportBusy(true);
      notify(null, null);
      try {
        const result = await receiveProjectBundle(file, queryClient);
        await onImportSuccess?.(result);
        notify(
          `Проєкт успішно імпортовано! (${String(result.calculationsImported)} розрахунків)`,
          null,
        );
      } catch (e) {
        const raw = e instanceof Error ? e.message : 'Не вдалося імпортувати проєкт';
        notify(null, mapProjectImportErrorMessage(raw));
      } finally {
        setImportBusy(false);
      }
    },
    [confirmBeforeImport, onImportSuccess, notify, queryClient],
  );

  const runOpenLocal = useCallback(
    async (file: File) => {
      notify(null, null);
      try {
        const text = await file.text();
        const raw: unknown = JSON.parse(text);
        const draft = parseSurveyDraft(raw);
        onOpenLocalSuccess?.(draft, file.name);
        notify(`Завантажено з файлу: ${file.name}`, null);
      } catch (e) {
        notify(null, e instanceof Error ? e.message : 'Не вдалося прочитати файл');
      }
    },
    [notify, onOpenLocalSuccess],
  );

  /** Єдиний слухач file input. */
  const handleFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      const mode = pendingModeRef.current;
      pendingModeRef.current = null;
      if (!file || mode == null) return;

      if (mode === 'import') {
        void runImport(file);
        return;
      }
      void runOpenLocal(file);
    },
    [runImport, runOpenLocal],
  );

  const requestImport = useCallback(() => {
    pendingModeRef.current = 'import';
    fileInputRef.current?.click();
  }, []);

  const requestOpenLocal = useCallback(() => {
    pendingModeRef.current = 'openLocal';
    fileInputRef.current?.click();
  }, []);

  const runSendProjectBundle = useCallback(
    async (exportParams: ProjectBundleExportParams) => {
      setExportBusy(true);
      notify(null, null);
      try {
        const { filename, calculationsCount } = await sendProjectBundle(
          queryClient,
          exportParams,
        );
        notify(
          `Проєкт експортовано (${String(calculationsCount)} розрахунків): ${filename}`,
          null,
        );
      } catch (e) {
        const raw = e instanceof Error ? e.message : 'Не вдалося експортувати проєкт';
        if (raw !== 'Експорт скасовано') {
          notify(null, raw);
        }
      } finally {
        setExportBusy(false);
      }
    },
    [notify, queryClient],
  );

  return {
    fileInputRef,
    handleFileInputChange,
    requestImport,
    requestOpenLocal,
    sendProjectBundle: runSendProjectBundle,
    importBusy,
    exportBusy,
  };
}
