/**
 * Назначение: клиентская шапка — публичная ссылка и скачивание PDF (без pop-up).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { ShareLinkToast } from '../ShareLinkToast/ShareLinkToast';
import { brandUk } from '../../i18n/uk/brand';
import { headerUk } from '../../i18n/uk/header';
import styles from './Header.module.css';

export type HeaderProps = {
  logo?: React.ReactNode;
  title: string;
  /** start — только «Проекты»; survey — полная клиентская панель. */
  variant?: 'start' | 'survey';
  clientName: string;
  onClientNameChange: (value: string) => void;
  projectId?: string | null;
  statusMessage?: string | null;
  statusError?: string | null;
  /** Есть ли отчёт с commercial для PDF. */
  canPrintPdf?: boolean;
  /** Есть ли projectId и отчёт для публикации ссылки. */
  canPublishShare?: boolean;
  /** Можно ли сохранить черновик (имя клиента). */
  canSaveProject?: boolean;
  /** Сохранение проекта на сервер в процессе. */
  saveProjectBusy?: boolean;
  /** Публикация публичной ссылки в процессе. */
  shareBusy?: boolean;
  /** Toast «ссылка скопирована» под кнопкой «Ссылка». */
  shareToastOpen?: boolean;
  onDismissShareToast?: () => void;
  onOpenProjects: () => void;
  /** Зберегти чернетку анкети на сервер (без обовʼязкового розрахунку). */
  onSaveProject: () => void;
  /** Выход на стартовый экран (без skeleton). */
  onExit: () => void;
  onCopyPublicLink: () => void;
  onPrintPdf: (includeTechnical: boolean) => void;
};

export function Header({
  logo,
  title,
  variant = 'survey',
  clientName,
  onClientNameChange,
  projectId,
  statusMessage,
  statusError,
  canPrintPdf = false,
  canPublishShare = false,
  canSaveProject = false,
  saveProjectBusy = false,
  shareBusy = false,
  shareToastOpen = false,
  onDismissShareToast,
  onOpenProjects,
  onSaveProject,
  onExit,
  onCopyPublicLink,
  onPrintPdf,
}: HeaderProps) {
  const [pdfMenuOpen, setPdfMenuOpen] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);

  const closeMenus = useCallback(() => {
    setPdfMenuOpen(false);
  }, []);

  useEffect(() => {
    if (!pdfMenuOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (target instanceof Node && controlsRef.current?.contains(target)) return;
      setPdfMenuOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPdfMenuOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pdfMenuOpen]);

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <div className={styles.logoSlot} aria-hidden={logo ? undefined : 'true'}>
          {logo ?? <div className={styles.logoMark} aria-hidden="true" />}
        </div>
        <div className={styles.titles}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>
            {brandUk.tagline}
            {projectId ? (
              <>
                {' '}
                · <span className={styles.projectId}>{headerUk.projectSaved}</span>
              </>
            ) : null}
          </p>
          {statusMessage ? (
            <p className={styles.statusOk} role="status">
              {statusMessage}
            </p>
          ) : null}
          {statusError ? (
            <p className={styles.statusErr} role="alert">
              {statusError}
            </p>
          ) : null}
        </div>
      </div>

      <div ref={controlsRef} className={styles.controls} aria-label={headerUk.controlsAria}>
        {variant === 'survey' ? (
          <input
            type="text"
            className={styles.clientInput}
            value={clientName}
            onChange={(e) => {
              onClientNameChange(e.target.value);
            }}
            placeholder={headerUk.clientNamePlaceholder}
            maxLength={200}
            autoComplete="off"
            aria-label={headerUk.clientNameAria}
          />
        ) : null}

        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => {
            closeMenus();
            onOpenProjects();
          }}
        >
          {headerUk.projects}
        </button>

        {variant === 'survey' ? (
          <>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={!canSaveProject || saveProjectBusy}
              aria-busy={saveProjectBusy}
              title={
                saveProjectBusy
                  ? headerUk.saveProjectBusy
                  : canSaveProject
                    ? headerUk.saveProjectTitle
                    : headerUk.saveProjectDisabled
              }
              onClick={() => {
                closeMenus();
                onSaveProject();
              }}
            >
              {saveProjectBusy ? headerUk.saveProjectBusy : headerUk.saveProject}
            </button>

            <div className={styles.shareLinkWrap}>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={!canPublishShare || shareBusy}
                aria-busy={shareBusy}
                title={
                  shareBusy
                    ? headerUk.linkPublishing
                    : canPublishShare
                      ? headerUk.linkShareTitle
                      : headerUk.linkShareDisabled
                }
                onClick={() => {
                  closeMenus();
                  onCopyPublicLink();
                }}
              >
                {shareBusy ? headerUk.linkPublishing : headerUk.link}
              </button>
              {onDismissShareToast ? (
                <ShareLinkToast open={shareToastOpen} onDismiss={onDismissShareToast} />
              ) : null}
            </div>

            <div className={styles.menu}>
              <button
                type="button"
                className={
                  pdfMenuOpen
                    ? `${styles.primaryButton} ${styles.menuTriggerActivePrimary}`
                    : styles.primaryButton
                }
                disabled={!canPrintPdf}
                aria-expanded={pdfMenuOpen}
                aria-haspopup="menu"
                onClick={() => {
                  setPdfMenuOpen((v) => !v);
                }}
              >
                {headerUk.pdfDownload}
              </button>
              {pdfMenuOpen ? (
                <div className={styles.menuPanel} role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onPrintPdf(false);
                      closeMenus();
                    }}
                  >
                    {headerUk.pdfFinancial}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onPrintPdf(true);
                      closeMenus();
                    }}
                  >
                    {headerUk.pdfWithTechnical}
                  </button>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className={styles.secondaryButton}
              title={headerUk.exitTitle}
              onClick={() => {
                closeMenus();
                onExit();
              }}
            >
              {headerUk.exit}
            </button>
          </>
        ) : null}
      </div>
    </header>
  );
}
